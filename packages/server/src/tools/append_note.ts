import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseFrontmatter } from '@seekstone/core/frontmatter';
import { z } from 'zod';
import type { ServerContext } from '../context.js';

export const AppendNoteInput = z.object({
  path: z.string().describe('Vault-relative path to the note.'),
  content: z
    .string()
    .min(1)
    .describe(
      'Text to append to the note body. Will be separated from existing content by a blank line.',
    ),
});
export type AppendNoteInput = z.infer<typeof AppendNoteInput>;

export interface AppendNoteResult {
  path: string;
  bytesWritten: number;
}

/**
 * Append text to a note body without touching the frontmatter.
 *
 * The write contract:
 *   - The frontmatter block (if any) is preserved byte-for-byte.
 *   - A blank line is inserted before the appended content if the body
 *     does not already end with one (keeps Obsidian's visual spacing).
 *   - The file is written atomically (overwrite in place, same path).
 */
export async function appendNote(
  ctx: ServerContext,
  input: AppendNoteInput,
): Promise<AppendNoteResult> {
  const absPath = join(ctx.vaultRoot, input.path);
  if (!absPath.startsWith(ctx.vaultRoot)) {
    throw new Error(`Path outside vault: ${input.path}`);
  }

  const original = await readFile(absPath, 'utf8');
  const fm = parseFrontmatter(original);

  // Ensure body ends with exactly one trailing newline before appending.
  const body = fm.body.endsWith('\n') ? fm.body : `${fm.body}\n`;
  const separator = body.endsWith('\n\n') ? '' : '\n';
  const newBody = `${body}${separator}${input.content}`;

  // Reconstruct: original header (FM + delimiters) + new body.
  const header = original.slice(0, fm.bodyStart);
  const newContent = `${header}${newBody}`;

  await writeFile(absPath, newContent, 'utf8');

  // Update the in-memory index entry so subsequent searches reflect the change.
  const cached = ctx.notes.get(input.path);
  if (cached) {
    cached.body = newBody;
    cached.raw = newContent;
  }

  return { path: input.path, bytesWritten: Buffer.byteLength(newContent, 'utf8') };
}
