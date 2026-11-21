import { extractLinksWithLines } from '@seekstone/core/extract';
import type { BacklinkRef, ServerContext } from '../context.js';
import { buildResolveMaps, resolveLink } from './resolve.js';

/**
 * Incremental backlink-index maintenance, shared by the watcher and the
 * link-aware move path. Remove BEFORE mutating the note's entry in ctx.notes
 * (it reads the old raw); add AFTER the entry is current.
 */

export function removeNoteBacklinks(ctx: ServerContext, relPath: string): void {
  const oldDoc = ctx.notes.get(relPath);
  if (oldDoc === undefined) return;
  const links = extractLinksWithLines(oldDoc.raw);
  if (links.length === 0) return;
  const maps = buildResolveMaps(ctx.notes);
  for (const link of links) {
    const resolved = resolveLink(link.target, ctx.notes, maps);
    if (resolved === undefined) continue;
    const arr = ctx.backlinks.get(resolved);
    if (arr === undefined) continue;
    const filtered = arr.filter((r) => r.path !== relPath);
    ctx.backlinks.set(resolved, filtered);
  }
}

export function addNoteBacklinks(ctx: ServerContext, relPath: string, raw: string): void {
  const seen = new Set<string>();
  const links = extractLinksWithLines(raw);
  if (links.length === 0) return;
  const maps = buildResolveMaps(ctx.notes);
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
