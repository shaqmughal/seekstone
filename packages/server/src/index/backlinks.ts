import {
  extractLinksWithLines,
  frontmatterAliases,
  type LinkRecord,
} from '@seekstone/core/extract';
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
 * been added or removed while it was gone. Runs only on that return. Only
 * notes whose text mentions the note's basename or an alias are parsed (see
 * mayLinkTo). The note's links to itself are left to its caller's
 * addNoteBacklinks. The caller bumps the generation.
 */
export function restoreInboundRefs(
  backlinks: Map<string, BacklinkRef[]>,
  notes: Map<string, IndexedNote>,
  path: string,
): void {
  const keys = linkKeys(path, notes.get(path)?.fm ?? null);
  let maps: ResolveMaps | undefined;
  const refs: BacklinkRef[] = [];
  // Each linking note's current targets, with the first link to each: the
  // one a cold build records.
  const targetsOf = new Map<string, Map<string, LinkRecord>>();
  for (const [src, doc] of notes) {
    if (src === path || !mayLinkTo(doc.raw, keys)) continue;
    maps ??= buildResolveMaps(notes);
    const targets = new Map<string, LinkRecord>();
    for (const link of extractLinksWithLines(doc.raw)) {
      const resolved = resolveLink(link.target, notes, maps);
      if (resolved !== undefined && !targets.has(resolved)) targets.set(resolved, link);
    }
    const first = targets.get(path);
    if (first === undefined) continue;
    refs.push({ path: src, line: first.line, linkType: first.linkType });
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
  // alias. Drop the linker from any target its links no longer resolve to,
  // and point a kept ref at the first link that still does.
  for (const [target, arr] of backlinks) {
    if (target === path) continue;
    let next: BacklinkRef[] | undefined;
    for (let i = 0; i < arr.length; i++) {
      const r = arr[i] as BacklinkRef;
      const targets = targetsOf.get(r.path);
      if (targets === undefined) {
        next?.push(r);
        continue;
      }
      const link = targets.get(target);
      const same = link !== undefined && link.line === r.line && link.linkType === r.linkType;
      if (same) {
        next?.push(r);
        continue;
      }
      next ??= arr.slice(0, i);
      if (link !== undefined) next.push({ path: r.path, line: link.line, linkType: link.linkType });
    }
    if (next !== undefined) backlinks.set(target, next);
  }
}

interface LinkKeys {
  /** Lowercased basename without `.md`, then each lowercased alias. */
  keys: string[];
  /** Matches any key, case-insensitively, when every key is ASCII. */
  re: RegExp | undefined;
  /** Keys with whitespace or a quote, whitespace removed, for frontmatter. */
  squeezed: string[];
}

function linkKeys(path: string, fm: Record<string, unknown> | null): LinkKeys {
  const pathNoExt = path.replace(/\.md$/i, '').toLowerCase();
  const keys = [pathNoExt.split('/').pop() ?? pathNoExt];
  for (const alias of frontmatterAliases(fm)) keys.push(alias.toLowerCase());
  // For ASCII keys a case-insensitive regex finds what toLowerCase would,
  // without copying every note: the only character that lowercases to ASCII
  // and doesn't match under /iu is U+0130, whose lowercase adds U+0307, so it
  // can't be part of a link that matches an ASCII key.
  const ascii = keys.every((k) => /^[\x20-\x7e]*$/.test(k));
  const escaped = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return {
    keys,
    re: ascii ? new RegExp(escaped.join('|'), 'iu') : undefined,
    // Folding only splits a key at whitespace, and single quoting doubles a quote.
    squeezed: keys.filter((k) => /[\s']/.test(k)).map((k) => k.replace(/\s+/g, '')),
  };
}

/**
 * False only when no link in `raw` can resolve to the note with these keys.
 * resolveLink reaches a note by its path, path without `.md`, basename or
 * alias, and every one of those targets contains the lowercased basename or
 * equals an alias, so a link to the note puts a key in the text. That covers
 * a link the note takes over from another note with the same basename or
 * alias too, so the other note's bucket is reconciled. Frontmatter links are
 * read from parsed YAML, where folding turns a line break into a space and
 * quoting can escape characters. So the block passes outright when it holds
 * a backslash, and a key with whitespace or a quote is also looked for in it
 * with whitespace removed.
 */
function mayLinkTo(raw: string, { keys, re, squeezed }: LinkKeys): boolean {
  if (re !== undefined) {
    if (re.test(raw)) return true;
  } else {
    const lower = raw.toLowerCase();
    if (keys.some((key) => lower.includes(key))) return true;
  }
  // parseFrontmatter allows a leading BOM.
  const start = raw.charCodeAt(0) === 0xfeff ? 1 : 0;
  if (!raw.startsWith('---', start)) return false;
  const end = raw.indexOf('\n---', start + 3);
  const slash = raw.indexOf('\\');
  if (slash !== -1 && (end === -1 || slash < end)) return true;
  if (squeezed.length === 0) return false;
  const block = (end === -1 ? raw : raw.slice(0, end)).toLowerCase();
  const flat = block.replace(/\s+/g, '').replaceAll("''", "'");
  return squeezed.some((key) => flat.includes(key));
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
