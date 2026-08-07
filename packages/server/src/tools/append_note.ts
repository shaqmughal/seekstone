import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseFrontmatter } from '@seekstone/core/frontmatter';
import { z } from 'zod';
import { atomicWrite } from '../atomic-write.js';
import { assertHashMatch, contentHash } from '../content-hash.js';
import type { ServerContext } from '../context.js';
import { assertWritable } from '../policy.js';
import { resolveVaultPath } from '../vault-path.js';

export const AppendNoteInput = z.object({
  path: z.string().describe('Vault-relative path to the note.'),
  content: z
    .string()
    .min(1)
    .describe(
      'Text to append to the note body. Will be separated from existing content by a blank line.',
    ),
  prevHash: z
    .string()
    .optional()
    .describe(
      'Optional compare-and-swap guard: the contentHash from a prior read. Fails with hash_conflict if the note changed since.',
    ),
});
export type AppendNoteInput = z.infer<typeof AppendNoteInput>;

export interface AppendNoteResult {
  path: string;
  bytesWritten: number;
  /** sha-256 (hex) of the new content — usable as prevHash for a chained edit. */
  contentHash: string;
}

/**
 * Append text to a note body without touching the frontmatter.
 *
 * The write contract:
 *   - The frontmatter block (if any) is preserved byte-for-byte.
 *   - A blank line is inserted before the appended content if the body
 *     does not already end with one (keeps Obsidian's visual spacing).
 *   - The file is written atomically (temp file + rename).
 */
export async function appendNote(
  ctx: ServerContext,
  input: AppendNoteInput,
): Promise<AppendNoteResult> {
  const absPath = resolveVaultPath(ctx.vaultRoot, input.path);
  assertWritable(ctx.policy, input.path);

  const original = await readFile(absPath, 'utf8');
  if (input.prevHash !== undefined) assertHashMatch(original, input.prevHash, input.path);
  const fm = parseFrontmatter(original);

  // Ensure body ends with exactly one trailing newline before appending.
  const body = fm.body.endsWith('\n') ? fm.body : `${fm.body}\n`;
  const separator = body.endsWith('\n\n') ? '' : '\n';
  const newBody = `${body}${separator}${input.content}`;

  // Reconstruct: original header (FM + delimiters) + new body.
  const header = original.slice(0, fm.bodyStart);
  const newContent = `${header}${newBody}`;

  await atomicWrite(absPath, newContent);

  // Update the in-memory index entry so subsequent searches reflect the change.
  const cached = ctx.notes.get(input.path);
  if (cached) {
    cached.body = newBody;
    cached.raw = newContent;
  }

  return {
    path: input.path,
    bytesWritten: Buffer.byteLength(newContent, 'utf8'),
    contentHash: contentHash(newContent),
  };
}
