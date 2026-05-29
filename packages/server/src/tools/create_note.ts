import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { buildDoc, upsertDoc } from '../index/doc.js';

export const CreateNoteInput = z.object({
  path: z
    .string()
    .describe(
      'Vault-relative path for the new note, e.g. "Daily Notes/2026-06-01.md". Parent directories are created automatically.',
    ),
  content: z.string().default('').describe('Body content for the note.'),
  frontmatter: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Frontmatter key-value pairs to write as a YAML block at the top of the note.'),
  overwrite: z
    .boolean()
    .default(false)
    .describe(
      'Overwrite an existing note. Defaults to false — throws if the note already exists.',
    ),
});
export type CreateNoteInput = z.input<typeof CreateNoteInput>;

export interface CreateNoteResult {
  path: string;
  bytesWritten: number;
}

export async function createNote(
  ctx: ServerContext,
  input: CreateNoteInput,
): Promise<CreateNoteResult> {
  const absPath = join(ctx.vaultRoot, input.path);
  if (!absPath.startsWith(ctx.vaultRoot)) {
    throw new Error(`Path outside vault: ${input.path}`);
  }

  if (!input.overwrite) {
    try {
      await access(absPath);
      throw new Error(
        `Note already exists: ${input.path}. Pass overwrite: true to replace it.`,
      );
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  let raw = '';
  if (input.frontmatter && Object.keys(input.frontmatter).length > 0) {
    raw = `---\n${stringifyYaml(input.frontmatter)}---\n`;
  }
  raw += input.content ?? '';

  await mkdir(dirname(absPath), { recursive: true });
  await writeFile(absPath, raw, 'utf8');

  // Sync in-memory index so the new note is immediately searchable.
  upsertDoc(ctx, buildDoc(input.path, raw));

  return { path: input.path, bytesWritten: Buffer.byteLength(raw, 'utf8') };
}
