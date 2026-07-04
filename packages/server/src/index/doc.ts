import { basename, extname } from 'node:path';
import { extractInlineTags, frontmatterTags } from '@seekstone/core/extract';
import { parseFrontmatter } from '@seekstone/core/frontmatter';
import type { IndexedNote } from './types.js';

/** Build an IndexedNote from a vault-relative path and raw file content. */
export function buildDoc(relPath: string, raw: string): IndexedNote {
  const fm = parseFrontmatter(raw);
  const allTags = [...new Set([...extractInlineTags(fm.body), ...frontmatterTags(fm.data)])];
  const title =
    typeof fm.data?.title === 'string' && fm.data.title
      ? fm.data.title
      : basename(relPath, extname(relPath));
  return {
    id: relPath,
    title,
    body: fm.body,
    tags: allTags.join(' '),
    fmKeys: fm.keys.join(' '),
    fm: fm.data,
    raw,
    sizeBytes: Buffer.byteLength(raw, 'utf8'),
    mtimeMs: Date.now(),
  };
}

/** Upsert a document into the context index. Discards any stale entry first. */
export function upsertDoc(
  ctx: {
    index: { discard(id: string): void; add(doc: IndexedNote): void };
    notes: Map<string, IndexedNote>;
  },
  doc: IndexedNote,
): void {
  if (ctx.notes.has(doc.id)) ctx.index.discard(doc.id);
  ctx.notes.set(doc.id, doc);
  ctx.index.add(doc);
}
