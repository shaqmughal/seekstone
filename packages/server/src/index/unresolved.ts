import type { LinkRecord } from '@seekstone/core/extract';
import type { ServerContext, UnresolvedRef } from '../context.js';
import { cachedResolveMaps } from './generation.js';
import { resolveAttachment, resolveLink } from './resolve.js';

// Unresolved links (SHA-675). The index build and the index/backlinks.ts
// helpers record them as they resolve links, so reading them never scans the vault.
export interface UnresolvedRow extends UnresolvedRef {
  /** Vault-relative path of the note that contains the link. */
  path: string;
}

/**
 * Append `link` to a note's unresolved list, creating the list on first use.
 * The same target twice on one line is recorded once. extractLinksWithLines
 * returns a line's links together, so only the tail on that line is checked.
 */
export function recordUnresolved(
  list: UnresolvedRef[] | undefined,
  link: LinkRecord,
): UnresolvedRef[] {
  const out = list ?? [];
  for (let i = out.length - 1; i >= 0 && out[i]?.line === link.line; i--)
    if (out[i]?.target === link.target) return out;
  out.push({ line: link.line, target: link.target, linkType: link.linkType });
  return out;
}

/**
 * Every unresolved link, sorted by source path, then line. Entries recorded
 * before a matching note or attachment appeared are re-checked and left out.
 * `folder` keeps only sources whose path starts with it (a plain prefix).
 */
export function listUnresolved(
  ctx: ServerContext,
  opts: { folder?: string } = {},
): UnresolvedRow[] {
  const maps = cachedResolveMaps(ctx);
  const rows: UnresolvedRow[] = [];
  for (const [path, refs] of ctx.unresolved) {
    if (opts.folder !== undefined && !path.startsWith(opts.folder)) continue;
    for (const ref of refs) {
      if (resolveLink(ref.target, ctx.notes, maps) !== undefined) continue;
      if (resolveAttachment(ref.target, ctx.attachments) !== undefined) continue;
      rows.push({ path, ...ref });
    }
  }
  // Stable sort: links on the same line keep the order they appear in.
  return rows.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line));
}
