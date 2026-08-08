import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseFrontmatter } from '@seekstone/core/frontmatter';
import { buildOutline } from '@seekstone/core/outline';
import { z } from 'zod';
import { atomicWrite } from '../atomic-write.js';
import { assertHashMatch, contentHash } from '../content-hash.js';
import type { ServerContext } from '../context.js';
import { addNoteBacklinks, removeNoteBacklinks } from '../index/backlinks.js';
import { buildDoc, upsertDoc } from '../index/doc.js';
import { resolveLink } from '../index/resolve.js';
import { assertWritable, isWritable } from '../policy.js';
import { resolveVaultPath } from '../vault-path.js';
import { mapUnfencedLines } from './rewrite_links.js';

export const RenameHeadingInput = z.object({
  path: z.string().describe('Vault-relative path of the note containing the heading.'),
  oldHeading: z
    .string()
    .min(1)
    .describe(
      'Current heading text, without # markers. Matched case-insensitively; if the note has duplicate headings the first one wins, mirroring Obsidian link resolution.',
    ),
  newHeading: z
    .string()
    .min(1)
    .refine((s) => !/[\n[\]|#]/.test(s), {
      message:
        'newHeading must not contain newlines, "[", "]", "|", or "#" — those break [[note#heading]] link syntax.',
    })
    .describe('New heading text, without # markers.'),
  prevHash: z
    .string()
    .optional()
    .describe(
      'Optional compare-and-swap guard: the contentHash from a prior read of this note. Fails with hash_conflict if the note changed since.',
    ),
});
export type RenameHeadingInput = z.input<typeof RenameHeadingInput>;

export interface RenameHeadingResult {
  path: string;
  oldHeading: string;
  newHeading: string;
  /** 1-based line of the renamed heading. */
  line: number;
  /**
   * Notes with at least one reference rewritten — includes the renamed note
   * itself when it linked to its own heading. The heading rename alone does
   * not count.
   */
  notesRewritten: number;
  /** Individual [[…#heading]] links and embeds rewritten across the vault. */
  linksRewritten: number;
  /** Referencing notes left untouched because SEEKSTONE_WRITE_PATHS excludes them. */
  skipped?: string[];
  /** sha-256 (hex) of the renamed note's new content — usable as prevHash for a chained edit. */
  contentHash: string;
}

// Heading-link shape: optional embed bang, optional target (empty = same-note
// anchor like [[#Heading]]), required #fragment, optional |alias. Bounds
// mirror LINK_WITH_LINES_RE in @seekstone/core/extract.
const HEADING_LINK_RE = /(!?)\[\[([^\]|#\n]{0,512})(#[^\]|\n]{1,512})(\|[^\]\n]{1,512})?\]\]/g;

/**
 * Rewrite `[[target#fragment]]` links on unfenced lines. `matchesTarget`
 * decides whether a link's target refers to the renamed note; the fragment
 * must equal `oldHeading` case-insensitively (Obsidian heading links are
 * case-insensitive). Block refs (`#^id`) and nested heading paths (`#A#B`)
 * are never touched.
 */
function rewriteHeadingLinks(
  raw: string,
  oldHeading: string,
  newHeading: string,
  matchesTarget: (target: string) => boolean,
): { content: string; count: number } {
  const oldLower = oldHeading.toLowerCase();
  let count = 0;
  const content = mapUnfencedLines(raw, (line) =>
    line.replace(
      HEADING_LINK_RE,
      (full, bang: string, target: string, frag: string, alias?: string) => {
        const fragText = frag.slice(1);
        if (fragText.startsWith('^') || fragText.includes('#')) return full;
        if (fragText.trim().toLowerCase() !== oldLower) return full;
        if (!matchesTarget(target.trim())) return full;
        count++;
        return `${bang}[[${target}#${newHeading}${alias ?? ''}]]`;
      },
    ),
  );
  return { content, count };
}

export async function renameHeading(
  ctx: ServerContext,
  rawInput: RenameHeadingInput,
): Promise<RenameHeadingResult> {
  // Parse here (not only in dispatch) so validation applies to direct callers
  // too — same pattern as move_note.
  const input = RenameHeadingInput.parse(rawInput);
  const absPath = resolveVaultPath(ctx.vaultRoot, input.path);
  assertWritable(ctx.policy, input.path);

  let raw: string;
  try {
    raw = await readFile(absPath, 'utf8');
  } catch {
    throw new Error(`Note not found: ${input.path}`);
  }
  if (input.prevHash !== undefined) assertHashMatch(raw, input.prevHash, input.path);

  const outline = buildOutline(raw, { includeBlocks: false });
  const heading = outline.headings.find(
    (h) => h.text.toLowerCase() === input.oldHeading.toLowerCase(),
  );
  if (!heading) {
    throw new Error(
      JSON.stringify({
        error: 'heading_not_found',
        target: input.oldHeading,
        available: outline.headings.map((h) => h.text),
      }),
    );
  }

  // Rename the heading line surgically by offset, preserving the marker run,
  // the whitespace after it, and any trailing whitespace (incl. CR).
  const nl = raw.indexOf('\n', heading.byteOffset);
  const lineEnd = nl === -1 ? raw.length : nl;
  const lineText = raw.slice(heading.byteOffset, lineEnd);
  const markerPrefix = /^#{1,6}\s+/.exec(lineText)?.[0] ?? '';
  const trailing = /\s*$/.exec(lineText)?.[0] ?? '';
  const newLineText = `${markerPrefix}${input.newHeading}${trailing}`;
  let newRaw = raw.slice(0, heading.byteOffset) + newLineText + raw.slice(lineEnd);

  // Rewrite the note's own references to the renamed heading — same-note
  // anchors ([[#Heading]]) and self-links by name — in the body region only,
  // so the frontmatter stays byte-identical.
  const fm = parseFrontmatter(newRaw);
  const bodyRegion = newRaw.slice(fm.bodyStart);
  const selfRewrite = rewriteHeadingLinks(
    bodyRegion,
    input.oldHeading,
    input.newHeading,
    (target) => target === '' || resolveLink(target, ctx.notes) === input.path,
  );
  newRaw = newRaw.slice(0, fm.bodyStart) + selfRewrite.content;

  const originalFmRegion = raw.slice(0, fm.bodyStart);
  await atomicWrite(absPath, newRaw);
  const written = await readFile(absPath, 'utf8');
  if (written.slice(0, originalFmRegion.length) !== originalFmRegion) {
    throw new Error('Write-safety violation: frontmatter region changed unexpectedly');
  }

  // Refresh the renamed note's index entry. removeNoteBacklinks reads the old
  // raw out of ctx.notes, so it must run before upsertDoc replaces the entry.
  removeNoteBacklinks(ctx, input.path);
  upsertDoc(ctx, buildDoc(input.path, newRaw));
  addNoteBacklinks(ctx, input.path, newRaw);

  let notesRewritten = selfRewrite.count > 0 ? 1 : 0;
  let linksRewritten = selfRewrite.count;
  const skipped: string[] = [];

  // Referencing notes come straight off the warm backlink index — no scan.
  // Heading links are wikilinks/embeds, which the index fully covers
  // (markdown anchors like [t](note.md#h) are out of scope, as documented).
  const candidates = new Set<string>();
  for (const ref of ctx.backlinks.get(input.path) ?? []) candidates.add(ref.path);
  candidates.delete(input.path);

  for (const path of [...candidates].sort()) {
    const doc = ctx.notes.get(path);
    if (doc === undefined) continue;
    const { content, count } = rewriteHeadingLinks(
      doc.raw,
      input.oldHeading,
      input.newHeading,
      (target) => target !== '' && resolveLink(target, ctx.notes) === input.path,
    );
    if (count === 0) continue;
    if (!isWritable(ctx.policy, path)) {
      // Out of write scope: leave the note untouched but report it, so the
      // caller knows which references were NOT updated.
      skipped.push(path);
      continue;
    }
    await atomicWrite(join(ctx.vaultRoot, path), content);
    // Fragment rewrites change neither link resolution nor line numbers, so
    // the backlink index needs no refresh — only the notes/search entries.
    upsertDoc(ctx, buildDoc(path, content));
    notesRewritten++;
    linksRewritten += count;
  }

  const result: RenameHeadingResult = {
    path: input.path,
    oldHeading: input.oldHeading,
    newHeading: input.newHeading,
    line: heading.line,
    notesRewritten,
    linksRewritten,
    contentHash: contentHash(newRaw),
  };
  if (skipped.length > 0) result.skipped = skipped;
  return result;
}
