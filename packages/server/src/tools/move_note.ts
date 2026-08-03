import { access, mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { atomicWrite } from '../atomic-write.js';
import type { ServerContext } from '../context.js';
import { addNoteBacklinks, removeNoteBacklinks } from '../index/backlinks.js';
import { buildDoc, upsertDoc } from '../index/doc.js';
import { assertWritable, isWritable } from '../policy.js';
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
}

export async function moveNote(
  ctx: ServerContext,
  rawInput: MoveNoteInput,
): Promise<MoveNoteResult> {
  // Parse here (not only in dispatch) so defaults like rewriteLinks apply to
  // direct callers too — same pattern as periodic_note.
  const input = MoveNoteInput.parse(rawInput);
  const absFrom = join(ctx.vaultRoot, input.from);
  const absTo = join(ctx.vaultRoot, input.to);

  if (!absFrom.startsWith(ctx.vaultRoot)) throw new Error(`Path outside vault: ${input.from}`);
  if (!absTo.startsWith(ctx.vaultRoot)) throw new Error(`Path outside vault: ${input.to}`);
  assertWritable(ctx.policy, input.from);
  assertWritable(ctx.policy, input.to);

  try {
    await access(absFrom);
  } catch {
    throw new Error(`Note not found: ${input.from}`);
  }

  if (!input.overwrite) {
    try {
      await access(absTo);
      throw new Error(
        `Destination already exists: ${input.to}. Pass overwrite: true to replace it.`,
      );
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
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

  await mkdir(dirname(absTo), { recursive: true });
  await rename(absFrom, absTo);

  // Grab raw before removing the old entry, and clear the moved note's own
  // outgoing backlink refs while its old entry is still readable — otherwise
  // they stay registered under the stale source path forever.
  const raw = ctx.notes.get(input.from)?.raw ?? '';
  removeNoteBacklinks(ctx, input.from);

  if (ctx.notes.has(input.from)) {
    ctx.index.discard(input.from);
    ctx.notes.delete(input.from);
  }
  upsertDoc(ctx, buildDoc(input.to, raw));
  addNoteBacklinks(ctx, input.to, raw);

  let notesRewritten = 0;
  let linksRewritten = 0;
  const skipped: string[] = [];

  for (const path of [...candidates].sort()) {
    const doc = ctx.notes.get(path);
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
      ctx.notes,
    );
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

  const result: MoveNoteResult = { from: input.from, to: input.to, notesRewritten, linksRewritten };
  if (skipped.length > 0) result.skipped = skipped;
  return result;
}
