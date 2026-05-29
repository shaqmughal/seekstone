import { access, mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { buildDoc, upsertDoc } from '../index/doc.js';

export const MoveNoteInput = z.object({
  from: z.string().describe('Vault-relative path of the note to move.'),
  to: z.string().describe('Vault-relative destination path.'),
  overwrite: z
    .boolean()
    .default(false)
    .describe('Overwrite the destination if it exists. Defaults to false.'),
});
export type MoveNoteInput = z.input<typeof MoveNoteInput>;

export interface MoveNoteResult {
  from: string;
  to: string;
}

export async function moveNote(ctx: ServerContext, input: MoveNoteInput): Promise<MoveNoteResult> {
  const absFrom = join(ctx.vaultRoot, input.from);
  const absTo = join(ctx.vaultRoot, input.to);

  if (!absFrom.startsWith(ctx.vaultRoot)) throw new Error(`Path outside vault: ${input.from}`);
  if (!absTo.startsWith(ctx.vaultRoot)) throw new Error(`Path outside vault: ${input.to}`);

  try {
    await access(absFrom);
  } catch {
    throw new Error(`Note not found: ${input.from}`);
  }

  if (!input.overwrite) {
    try {
      await access(absTo);
      throw new Error(
        `Destination already exists: ${input.to}. Pass overwrite: true to replace it.`,
      );
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  await mkdir(dirname(absTo), { recursive: true });
  await rename(absFrom, absTo);

  // Grab raw before removing the old entry.
  const raw = ctx.notes.get(input.from)?.raw ?? '';

  // Remove old index entry.
  if (ctx.notes.has(input.from)) {
    ctx.index.discard(input.from);
    ctx.notes.delete(input.from);
  }
  upsertDoc(ctx, buildDoc(input.to, raw));

  return { from: input.from, to: input.to };
}
