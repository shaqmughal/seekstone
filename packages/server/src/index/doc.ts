import { basename, extname, join } from 'node:path';
import { extractInlineTags, frontmatterAliases, frontmatterTags } from '@seekstone/core/extract';
import { parseFrontmatter } from '@seekstone/core/frontmatter';
import { extractTasks } from '@seekstone/core/tasks';
import type { BacklinkRef, ServerContext } from '../context.js';
import type { PathCheck } from '../policy.js';
import { symlinkTarget } from '../symlinks.js';
import { addNoteBacklinks, dropsLinks, removeNoteBacklinks } from './backlinks.js';
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
 * A note that comes back after removeDoc gets its parked inbound refs back.
 */
export function upsertDoc(
  ctx: {
    /** When set, a path that crosses a symlink is kept out of the index. */
    vaultRoot?: string;
    index: { discard(id: string): void; add(doc: IndexedNote): void };
    notes: Map<string, IndexedNote>;
    generation: number;
    backlinks?: Map<string, BacklinkRef[]>;
    parkedBacklinks?: Map<string, BacklinkRef[]>;
  },
  doc: IndexedNote,
  check?: PathCheck,
): boolean {
  // The index holds only paths that cross no symlink, like the boot walk
  // (SHA-575). resolveVaultPath skips its symlink check for indexed notes,
  // so a write through a link (allowed when the link stays in the vault, or
  // with SEEKSTONE_FOLLOW_SYMLINKS) must not add its linked path here. A
  // write tool passes what assertWritable found; anyone else gets a walk.
  const viaLink =
    check !== undefined
      ? check.viaLink
      : ctx.vaultRoot !== undefined &&
        symlinkTarget(ctx.vaultRoot, join(ctx.vaultRoot, doc.id)) !== undefined;
  if (viaLink) {
    // A path that was indexed before its folder became a link leaves the
    // usual way, so its outgoing refs are cleared and inbound ones parked.
    if (ctx.backlinks !== undefined) removeDoc(ctx as ServerContext, doc.id);
    else if (ctx.notes.has(doc.id)) {
      bumpGeneration(ctx);
      ctx.index.discard(doc.id);
      ctx.notes.delete(doc.id);
    }
    return false;
  }
  bumpGeneration(ctx);
  if (ctx.notes.has(doc.id)) ctx.index.discard(doc.id);
  else if (ctx.backlinks !== undefined)
    unparkBacklinks(ctx.backlinks, ctx.parkedBacklinks, doc.id, ctx.notes);
  ctx.notes.set(doc.id, doc);
  ctx.index.add(doc);
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
  const inbound = ctx.backlinks.get(path);
  if (inbound === undefined) return;
  ctx.backlinks.delete(path);
  if (inbound.length === 0) return;
  ctx.parkedBacklinks ??= new Map();
  ctx.parkedBacklinks.set(path, inbound);
}

function unparkBacklinks(
  backlinks: Map<string, BacklinkRef[]>,
  parked: Map<string, BacklinkRef[]> | undefined,
  path: string,
  notes: Map<string, IndexedNote>,
): void {
  const refs = parked?.get(path);
  if (refs === undefined) return;
  parked?.delete(path);
  // A source deleted while this note was gone couldn't clear its ref.
  const merged = refs.filter((r) => notes.has(r.path));
  for (const r of backlinks.get(path) ?? []) {
    if (!merged.some((m) => m.path === r.path)) merged.push(r);
  }
  merged.sort((a, b) => a.path.localeCompare(b.path));
  if (merged.length > 0) backlinks.set(path, merged);
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
export function replaceDoc(ctx: ServerContext, path: string, raw: string, check?: PathCheck): void {
  const prev = ctx.notes.get(path);
  const relink = prev !== undefined && dropsLinks(prev.raw, raw);
  if (relink) removeNoteBacklinks(ctx, path);
  if (upsertDoc(ctx, buildDoc(path, raw), check) && relink) addNoteBacklinks(ctx, path, raw);
}
