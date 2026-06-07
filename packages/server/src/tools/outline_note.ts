import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildOutline } from '@seekstone/core/outline';
import { z } from 'zod';
import type { ServerContext } from '../context.js';

export const OutlineNoteInput = z.object({
  path: z.string().describe('Vault-relative path to the note.'),
  includeBlocks: z
    .boolean()
    .default(true)
    .describe('Include block-reference anchors (^id). Default true.'),
  includeSizes: z
    .boolean()
    .default(false)
    .describe('Include per-section character length in each heading entry. Default false.'),
});
export type OutlineNoteInput = z.infer<typeof OutlineNoteInput>;

export async function outlineNote(ctx: ServerContext, input: OutlineNoteInput) {
  const absPath = join(ctx.vaultRoot, input.path);
  if (!absPath.startsWith(ctx.vaultRoot)) {
    throw new Error(`Path outside vault: ${input.path}`);
  }

  const raw = await readFile(absPath, 'utf8');
  return buildOutline(raw, {
    includeBlocks: input.includeBlocks,
    includeSizes: input.includeSizes,
  });
}
