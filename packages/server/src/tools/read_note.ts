import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { ServerContext } from '../context.js';

export const ReadNoteInput = z.object({
  path: z.string().describe('Vault-relative path to the note, e.g. "Daily Notes/2026-05-29.md".'),
});
export type ReadNoteInput = z.infer<typeof ReadNoteInput>;

export interface ReadNoteResult {
  path: string;
  content: string;
  sizeBytes: number;
}

export async function readNote(ctx: ServerContext, input: ReadNoteInput): Promise<ReadNoteResult> {
  // Prevent path traversal — the path must not escape the vault root.
  const absPath = join(ctx.vaultRoot, input.path);
  if (!absPath.startsWith(ctx.vaultRoot)) {
    throw new Error(`Path outside vault: ${input.path}`);
  }

  const content = await readFile(absPath, 'utf8');
  return {
    path: input.path,
    content,
    sizeBytes: Buffer.byteLength(content, 'utf8'),
  };
}
