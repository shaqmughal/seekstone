import { extractLinksWithLines } from '@seekstone/core/extract';
import type { BacklinkRef, ServerContext } from '../context.js';
import { bumpGeneration } from './generation.js';
import { buildResolveMaps, type ResolveMaps, resolveLink } from './resolve.js';
import type { IndexedNote } from './types.js';

/**
 * Incremental backlink-index maintenance, shared by the watcher and the
 * link-aware move path. Remove BEFORE mutating the note's entry in ctx.notes
 * (it reads the old raw); add AFTER the entry is current. Both bump the
 * index generation, since vault_stats counts backlink refs.
 */

export function removeNoteBacklinks(
  ctx: ServerContext,
  relPath: string,
  resolveMaps?: ResolveMaps,
): void {
  const oldDoc = ctx.notes.get(relPath);
  if (oldDoc === undefined) return;
  const links = extractLinksWithLines(oldDoc.raw);
  if (links.length === 0) return;
  bumpGeneration(ctx);
  const maps = resolveMaps ?? buildResolveMaps(ctx.notes);
  for (const link of links) {
    const resolved = resolveLink(link.target, ctx.notes, maps);
    if (resolved === undefined) continue;
    const arr = ctx.backlinks.get(resolved);
    if (arr === undefined) continue;
    const filtered = arr.filter((r) => r.path !== relPath);
    ctx.backlinks.set(resolved, filtered);
  }
}

export function addNoteBacklinks(
  ctx: ServerContext,
  relPath: string,
  raw: string,
  resolveMaps?: ResolveMaps,
): void {
  const seen = new Set<string>();
  const links = extractLinksWithLines(raw);
  if (links.length === 0) return;
  bumpGeneration(ctx);
  const maps = resolveMaps ?? buildResolveMaps(ctx.notes);
  for (const link of links) {
    const resolved = resolveLink(link.target, ctx.notes, maps);
    if (resolved === undefined) continue;
    const dedupeKey = `${relPath}\0${resolved}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    let arr = ctx.backlinks.get(resolved);
    if (arr === undefined) {
      arr = [];
      ctx.backlinks.set(resolved, arr);
    }
    const ref: BacklinkRef = { path: relPath, line: link.line, linkType: link.linkType };
    arr.push(ref);
    arr.sort((a, b) => a.path.localeCompare(b.path));
  }
}

/**
 * Every other note's ref to `path`, read from the notes' current text, as a
 * cold build would list them. Reads every note, so it runs only when a deleted
 * note comes back: links may have been added or removed while it was gone.
 * The note's links to itself are left to its caller's addNoteBacklinks.
 */
export function inboundRefs(notes: Map<string, IndexedNote>, path: string): BacklinkRef[] {
  const maps = buildResolveMaps(notes);
  const refs: BacklinkRef[] = [];
  for (const [src, doc] of notes) {
    if (src === path) continue;
    const link = extractLinksWithLines(doc.raw).find(
      (l) => resolveLink(l.target, notes, maps) === path,
    );
    if (link !== undefined) refs.push({ path: src, line: link.line, linkType: link.linkType });
  }
  return refs.sort((a, b) => a.path.localeCompare(b.path));
}

/** Drop every ref that points at `path` (nothing resolves to it anymore). */
export function clearInboundBacklinks(ctx: ServerContext, path: string): void {
  if (!ctx.backlinks.delete(path)) return;
  bumpGeneration(ctx);
}

/**
 * True when `next` has lost a link target that `prev` had. The watcher's
 * re-index removes a note's refs by reading the cached raw, so a write that
 * replaces the cached raw and drops a link must clear that ref itself, or
 * nothing ever will.
 */
export function dropsLinks(prev: string, next: string): boolean {
  const before = extractLinksWithLines(prev);
  if (before.length === 0) return false;
  const kept = new Set(extractLinksWithLines(next).map((l) => l.target));
  return before.some((l) => !kept.has(l.target));
}
