import { join } from 'node:path';
import { extractLinksWithLines } from '@seekstone/core/extract';
import type { LinkType } from '@seekstone/core/extract';
import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { resolveLink } from '../index/resolve.js';

export const GetLinksInput = z.object({
  path: z.string().describe('Vault-relative path to the note.'),
});
export type GetLinksInput = z.infer<typeof GetLinksInput>;

export interface GetLinksEntry {
  raw: string;
  /** Resolved vault-relative path. Absent when unresolved. */
  target?: string;
  resolved: boolean;
  linkType: LinkType;
  line: number;
}

export interface GetLinksResult {
  path: string;
  links: GetLinksEntry[];
}

export function getLinks(ctx: ServerContext, input: GetLinksInput): GetLinksResult {
  const absPath = join(ctx.vaultRoot, input.path);
  if (!absPath.startsWith(ctx.vaultRoot)) {
    throw new Error(`Path outside vault: ${input.path}`);
  }
  const note = ctx.notes.get(input.path);
  if (note === undefined) throw new Error(`Note not found: ${input.path}`);

  const rawLinks = extractLinksWithLines(note.raw);

  // De-duplicate: one entry per (target string) — keep first occurrence by line
  const seen = new Set<string>();
  const links: GetLinksEntry[] = [];
  for (const link of rawLinks) {
    if (seen.has(link.target)) continue;
    seen.add(link.target);
    const resolvedPath = resolveLink(link.target, ctx.notes);
    const entry: GetLinksEntry = {
      raw: link.raw,
      resolved: resolvedPath !== undefined,
      linkType: link.linkType,
      line: link.line,
    };
    if (resolvedPath !== undefined) entry.target = resolvedPath;
    links.push(entry);
  }

  links.sort((a, b) => a.line - b.line);

  return { path: input.path, links };
}
