import { basename, extname } from 'node:path';
import { extractInlineTags, frontmatterTags } from '@seekstone/core/extract';
import { parseFrontmatter } from '@seekstone/core/frontmatter';
import { extractTasks } from '@seekstone/core/tasks';
import type { ServerContext } from '../context.js';
import { addNoteBacklinks, dropsLinks, removeNoteBacklinks } from './backlinks.js';
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
    tasks: extractTasks(raw),
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

/**
 * Bring a cached note up to date after a write tool rewrote it in place:
 * size, mtime, tags, tasks and frontmatter are current when this returns.
 * Search terms and newly added links are left to the watcher's re-index of
 * the file. A dropped link can't be: the watcher removes refs using the
 * cached raw, which no longer has it. So when the new content drops a link,
 * this re-registers the note's refs now. Pass `keepsLinks` when the write
 * can't remove a link (an append, a task toggle) to skip that check.
 */
export function refreshCachedNote(
  ctx: ServerContext,
  path: string,
  raw: string,
  opts: { keepsLinks?: boolean } = {},
): void {
  const cached = ctx.notes.get(path);
  if (cached === undefined) return;
  const relink = opts.keepsLinks !== true && dropsLinks(cached.raw, raw);
  if (relink) removeNoteBacklinks(ctx, path);
  Object.assign(cached, buildDoc(path, raw));
  if (relink) addNoteBacklinks(ctx, path, raw);
}

/**
 * upsertDoc for a write that replaces a note's whole content (create with
 * overwrite). Clears the old content's refs first when the new content drops
 * a link, for the same reason as refreshCachedNote.
 */
export function replaceDoc(ctx: ServerContext, path: string, raw: string): void {
  const prev = ctx.notes.get(path);
  const relink = prev !== undefined && dropsLinks(prev.raw, raw);
  if (relink) removeNoteBacklinks(ctx, path);
  upsertDoc(ctx, buildDoc(path, raw));
  if (relink) addNoteBacklinks(ctx, path, raw);
}
