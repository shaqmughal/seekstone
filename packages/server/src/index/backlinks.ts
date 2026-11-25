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
 * Rebuild the inbound refs of a note that came back after a delete, from every
 * other note's current text, as a cold build would list them. Links may have
 * been added or removed while it was gone. Reads every note, so it runs only
 * on that return. The note's links to itself are left to its caller's
 * addNoteBacklinks. The caller bumps the generation.
 */
export function restoreInboundRefs(
  backlinks: Map<string, BacklinkRef[]>,
  notes: Map<string, IndexedNote>,
  path: string,
): void {
  const maps = buildResolveMaps(notes);
  const refs: BacklinkRef[] = [];
  // Each linking note's current targets.
  const targetsOf = new Map<string, Set<string>>();
  for (const [src, doc] of notes) {
    if (src === path) continue;
    let ref: BacklinkRef | undefined;
    const targets = new Set<string>();
    for (const link of extractLinksWithLines(doc.raw)) {
      const resolved = resolveLink(link.target, notes, maps);
      if (resolved === undefined) continue;
      targets.add(resolved);
      if (resolved === path && ref === undefined)
        ref = { path: src, line: link.line, linkType: link.linkType };
    }
    if (ref === undefined) continue;
    refs.push(ref);
    targetsOf.set(src, targets);
  }
  if (refs.length > 0)
    backlinks.set(
      path,
      refs.sort((a, b) => a.path.localeCompare(b.path)),
    );
  else backlinks.delete(path);
  if (targetsOf.size === 0) return;
  // The note can take a link over from a note with the same basename or
  // alias. Drop the linker from any target its links no longer resolve to.
  for (const [target, arr] of backlinks) {
    if (target === path) continue;
    const kept = arr.filter((r) => targetsOf.get(r.path)?.has(target) !== false);
    if (kept.length !== arr.length) backlinks.set(target, kept);
  }
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
