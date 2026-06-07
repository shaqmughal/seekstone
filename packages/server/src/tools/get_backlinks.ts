import { join } from 'node:path';
import { z } from 'zod';
import type { ServerContext } from '../context.js';

export const GetBacklinksInput = z.object({
  path: z.string().describe('Vault-relative path to the target note.'),
  includeContext: z
    .boolean()
    .optional()
    .describe('Include a short excerpt (~200 chars) from the linking line. Default true.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe('Max backlinks to return. Default 50.'),
});
export type GetBacklinksInput = z.infer<typeof GetBacklinksInput>;

export interface BacklinkEntry {
  path: string;
  line: number;
  excerpt?: string;
  linkType: 'wikilink' | 'embed';
}

export interface GetBacklinksResult {
  target: string;
  backlinks: BacklinkEntry[];
  total: number;
}

const EXCERPT_MAX = 200;

export function getBacklinks(ctx: ServerContext, input: GetBacklinksInput): GetBacklinksResult {
  const absPath = join(ctx.vaultRoot, input.path);
  if (!absPath.startsWith(ctx.vaultRoot)) {
    throw new Error(`Path outside vault: ${input.path}`);
  }

  const includeContext = input.includeContext ?? true;
  const limit = input.limit ?? 50;

  const refs = ctx.backlinks.get(input.path) ?? [];
  const total = refs.length;
  const limited = refs.slice(0, limit);

  const backlinks: BacklinkEntry[] = [];
  for (const ref of limited) {
    const entry: BacklinkEntry = { path: ref.path, line: ref.line, linkType: ref.linkType };
    if (includeContext) {
      const srcNote = ctx.notes.get(ref.path);
      if (srcNote !== undefined) {
        const rawLines = srcNote.raw.split('\n');
        const lineText = rawLines[ref.line - 1];
        if (lineText !== undefined) {
          entry.excerpt =
            lineText.length > EXCERPT_MAX ? `${lineText.slice(0, EXCERPT_MAX)}…` : lineText;
        }
      }
    }
    backlinks.push(entry);
  }

  return { target: input.path, backlinks, total };
}
