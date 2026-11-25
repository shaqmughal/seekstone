import { basename, extname, join } from 'node:path';
import { extractInlineTags, frontmatterAliases, frontmatterTags } from '@seekstone/core/extract';
import { parseFrontmatter } from '@seekstone/core/frontmatter';
import { extractTasks } from '@seekstone/core/tasks';
import type { BacklinkRef, ServerContext } from '../context.js';
import { crossesLink } from '../symlinks.js';
import { addNoteBacklinks, dropsLinks, inboundRefs, removeNoteBacklinks } from './backlinks.js';
import { bumpGeneration } from './generation.js';
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

/**
 * Upsert a document into the context index. Discards any stale entry first.
 * A note that comes back after removeDoc gets its inbound refs back, read
 * from the linking notes as they are now.
 *
 * Returns false, and keeps the path out of the index, when it crosses a
 * symlink below the vault root (SHA-575). The check is synchronous, with no
 * await between it and the commit, so no caller can hand in a stale answer.
 * An entry already indexed under that path leaves the usual way. Callers
 * register backlinks and semantic updates only when this returns true.
 */
export function upsertDoc(
  ctx: {
    /** A path that crosses a symlink below this root is kept out of the index. */
    vaultRoot: string;
    index: { discard(id: string): void; add(doc: IndexedNote): void };
    notes: Map<string, IndexedNote>;
    generation: number;
    backlinks?: Map<string, BacklinkRef[]>;
    parkedBacklinks?: Map<string, BacklinkRef[]>;
  },
  doc: IndexedNote,
): boolean {
  if (crossesLink(ctx.vaultRoot, join(ctx.vaultRoot, doc.id)) !== undefined) {
    if (ctx.notes.has(doc.id)) {
      if (ctx.backlinks !== undefined) removeDoc(ctx as ServerContext, doc.id);
      else {
        bumpGeneration(ctx);
        ctx.index.discard(doc.id);
        ctx.notes.delete(doc.id);
      }
    }
    return false;
  }
  bumpGeneration(ctx);
  const indexed = ctx.notes.has(doc.id);
  const returning = !indexed && ctx.parkedBacklinks?.delete(doc.id) === true;
  if (indexed) ctx.index.discard(doc.id);
  ctx.notes.set(doc.id, doc);
  ctx.index.add(doc);
  // Links to the note may have changed while it was gone, so the parked refs
  // are re-read from the linking notes' current text instead of put back.
  if (returning && ctx.backlinks !== undefined) {
    const refs = inboundRefs(ctx.notes, doc.id);
    if (refs.length > 0) ctx.backlinks.set(doc.id, refs);
    else ctx.backlinks.delete(doc.id);
  }
  return true;
}

/**
 * Drop a note from the index and park its inbound refs (see parkedBacklinks).
 * move_note passes `parkInbound: false`: it re-registers the old path's
 * linkers against the new path itself, so nothing should come back if a note
 * later appears at the old path.
 */
export function removeDoc(
  ctx: ServerContext,
  path: string,
  opts: { parkInbound?: boolean } = {},
): void {
  // Clear the note's own outgoing refs while its entry is still readable.
  removeNoteBacklinks(ctx, path);
  if (!ctx.notes.has(path)) return;
  bumpGeneration(ctx);
  ctx.index.discard(path);
  ctx.notes.delete(path);
  if (opts.parkInbound === false) return;
  // Parked even with no inbound refs: a link added while the note is gone
  // must count when it comes back.
  const inbound = ctx.backlinks.get(path) ?? [];
  ctx.backlinks.delete(path);
  ctx.parkedBacklinks ??= new Map();
  ctx.parkedBacklinks.set(path, inbound);
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
  const next = buildDoc(path, raw);
  // A changed alias can change where this note's own links resolve.
  const relink =
    opts.keepsLinks !== true &&
    (dropsLinks(cached.raw, raw) || aliasKey(cached.fm) !== aliasKey(next.fm));
  if (relink) removeNoteBacklinks(ctx, path);
  // In-place update: tags, aliases and sizes change without a set().
  bumpGeneration(ctx);
  Object.assign(cached, next);
  if (relink) addNoteBacklinks(ctx, path, raw);
}

function aliasKey(fm: IndexedNote['fm']): string {
  return frontmatterAliases(fm).join('\0');
}

/**
 * upsertDoc for a write that replaces a note's whole content (create with
 * overwrite). Clears the old content's refs first when the new content drops
 * a link, for the same reason as refreshCachedNote.
 */
export function replaceDoc(ctx: ServerContext, path: string, raw: string): boolean {
  const prev = ctx.notes.get(path);
  const relink = prev !== undefined && dropsLinks(prev.raw, raw);
  if (relink) removeNoteBacklinks(ctx, path);
  const admitted = upsertDoc(ctx, buildDoc(path, raw));
  if (relink && admitted) addNoteBacklinks(ctx, path, raw);
  return admitted;
}
