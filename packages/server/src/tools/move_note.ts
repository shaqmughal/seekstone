import { mkdir, readFile, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { atomicWrite } from '../atomic-write.js';
import { assertHashMatch, contentHash } from '../content-hash.js';
import type { ServerContext } from '../context.js';
import { addNoteBacklinks, removeNoteBacklinks } from '../index/backlinks.js';
import { buildDoc, upsertDoc } from '../index/doc.js';
import { assertWritable, isWritable } from '../policy.js';
import { resolveVaultPath } from '../vault-path.js';
import { hasMarkdownLinkTo, rewriteNoteLinks } from './rewrite_links.js';

export const MoveNoteInput = z.object({
  from: z.string().describe('Vault-relative path of the note to move.'),
  to: z.string().describe('Vault-relative destination path.'),
  overwrite: z
    .boolean()
    .default(false)
    .describe('Overwrite the destination if it exists. Defaults to false.'),
  rewriteLinks: z
    .boolean()
    .default(true)
    .describe(
      'Rewrite wikilinks and markdown links in other notes that point at the moved note, so nothing breaks. Defaults to true; pass false to move the file only.',
    ),
  prevHash: z
    .string()
    .optional()
    .describe(
      'Optional compare-and-swap guard on the source note: the contentHash from a prior read. Fails with hash_conflict if the note changed since.',
    ),
});
export type MoveNoteInput = z.input<typeof MoveNoteInput>;

export interface MoveNoteResult {
  from: string;
  to: string;
  /** Referencing notes whose content was rewritten. */
  notesRewritten: number;
  /** Individual links rewritten across those notes. */
  linksRewritten: number;
  /** Referencing notes left untouched because SEEKSTONE_WRITE_PATHS excludes them. */
  skipped?: string[];
  /** sha-256 (hex) of the note at its new path — a move never changes content, so this is usable as prevHash for a chained edit at `to`. */
  contentHash: string;
}

export async function moveNote(
  ctx: ServerContext,
  rawInput: MoveNoteInput,
): Promise<MoveNoteResult> {
  // Parse here (not only in dispatch) so defaults like rewriteLinks apply to
  // direct callers too — same pattern as periodic_note.
  const input = MoveNoteInput.parse(rawInput);
  const absFrom = resolveVaultPath(ctx.vaultRoot, input.from);
  const absTo = resolveVaultPath(ctx.vaultRoot, input.to);
  assertWritable(ctx.policy, input.from);
  assertWritable(ctx.policy, input.to);

  // Read the source bytes up front: they are the CAS identity, the result
  // hash (a rename never changes content), and the truth the index entry at
  // the new path is rebuilt from (more reliable than a possibly-lagging
  // ctx.notes cache).
  let raw: string;
  try {
    raw = await readFile(absFrom, 'utf8');
  } catch {
    throw new Error(`Note not found: ${input.from}`);
  }
  if (input.prevHash !== undefined) assertHashMatch(raw, input.prevHash, input.from);

  // Pre-image of the destination (only ever non-null with overwrite: true).
  let existingAtTo: string | null = null;
  try {
    existingAtTo = await readFile(absTo, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  if (existingAtTo !== null && !input.overwrite) {
    throw new Error(`Destination already exists: ${input.to}. Pass overwrite: true to replace it.`);
  }

  // Snapshot pre-move state: link resolution before/after the move differs,
  // and the rewriter needs both views to rewrite only what breaks.
  const preNotes = new Map(ctx.notes);

  // Candidate referencing notes: wikilink sources from the backlink index,
  // plus a scan for markdown links (which the backlink index doesn't cover).
  // The moved note's own outgoing links are untouched by design — wikilinks
  // are path-independent, and rewriting its relative markdown links is a
  // separate concern from "don't orphan the note in the graph".
  const candidates = new Set<string>();
  if (input.rewriteLinks) {
    for (const ref of ctx.backlinks.get(input.from) ?? []) candidates.add(ref.path);
    for (const [path, doc] of preNotes) {
      if (path === input.from || candidates.has(path)) continue;
      if (hasMarkdownLinkTo(doc.raw, path, input.from)) candidates.add(path);
    }
    candidates.delete(input.from);
  }

  // Compute every link rewrite against the post-move resolution view BEFORE
  // touching disk, so the whole operation can be journaled under one seq
  // (undo restores all touched files or none) before the first byte changes.
  const postNotes = new Map(preNotes);
  postNotes.delete(input.from);
  postNotes.set(input.to, buildDoc(input.to, raw));

  const rewrites: { path: string; pre: string; content: string; count: number }[] = [];
  const skipped: string[] = [];
  for (const path of [...candidates].sort()) {
    const doc = preNotes.get(path);
    if (doc === undefined) continue;
    if (!isWritable(ctx.policy, path)) {
      // Out of write scope: leave the note untouched but report it, so the
      // caller knows which references were NOT updated.
      skipped.push(path);
      continue;
    }
    const { content, count } = rewriteNoteLinks(
      doc.raw,
      path,
      input.from,
      input.to,
      preNotes,
      postNotes,
    );
    rewrites.push({ path, pre: doc.raw, content, count });
  }

  if (ctx.journal) {
    const txn = ctx.journal.begin('move_note');
    await txn.add(input.from, raw, null);
    await txn.add(input.to, existingAtTo, raw);
    for (const r of rewrites) if (r.count > 0) await txn.add(r.path, r.pre, r.content);
    await txn.commit();
  }

  await mkdir(dirname(absTo), { recursive: true });
  await rename(absFrom, absTo);

  // Clear the moved note's own outgoing backlink refs while its old entry is
  // still readable — otherwise they stay registered under the stale source
  // path forever.
  removeNoteBacklinks(ctx, input.from);

  if (ctx.notes.has(input.from)) {
    ctx.index.discard(input.from);
    ctx.notes.delete(input.from);
  }
  upsertDoc(ctx, buildDoc(input.to, raw));
  addNoteBacklinks(ctx, input.to, raw);

  let notesRewritten = 0;
  let linksRewritten = 0;

  for (const { path, content, count } of rewrites) {
    const doc = ctx.notes.get(path);
    if (doc === undefined) continue;
    // Re-register this note's backlinks against post-move resolution even
    // when nothing was rewritten (basename links now resolve to the new
    // path); remove reads the old raw, so call it before updating the entry.
    removeNoteBacklinks(ctx, path);
    if (count > 0) {
      await atomicWrite(join(ctx.vaultRoot, path), content);
      upsertDoc(ctx, buildDoc(path, content));
      notesRewritten++;
      linksRewritten += count;
      addNoteBacklinks(ctx, path, content);
    } else {
      addNoteBacklinks(ctx, path, doc.raw);
    }
  }

  // Nothing resolves to the old path anymore — drop the stale key.
  ctx.backlinks.delete(input.from);

  const result: MoveNoteResult = {
    from: input.from,
    to: input.to,
    notesRewritten,
    linksRewritten,
    contentHash: contentHash(raw),
  };
  if (skipped.length > 0) result.skipped = skipped;
  return result;
}
