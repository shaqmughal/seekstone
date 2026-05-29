import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { ServerContext } from '../context.js';

export const DeleteNoteInput = z.object({
  path: z.string().describe('Vault-relative path of the note to delete.'),
});
export type DeleteNoteInput = z.input<typeof DeleteNoteInput>;

export interface DeleteNoteResult {
  path: string;
}

export async function deleteNote(
  ctx: ServerContext,
  input: DeleteNoteInput,
): Promise<DeleteNoteResult> {
  const absPath = join(ctx.vaultRoot, input.path);
  if (!absPath.startsWith(ctx.vaultRoot)) {
    throw new Error(`Path outside vault: ${input.path}`);
  }

  // rm throws ENOENT if the file doesn't exist — let it propagate.
  await rm(absPath);

  if (ctx.notes.has(input.path)) {
    ctx.index.discard(input.path);
    ctx.notes.delete(input.path);
  }

  return { path: input.path };
}
