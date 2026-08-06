import { access, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { z } from 'zod';
import { atomicWrite } from '../atomic-write.js';
import { assertHashMatch, contentHash } from '../content-hash.js';
import type { ServerContext } from '../context.js';
import { buildDoc, upsertDoc } from '../index/doc.js';
import { assertWritable } from '../policy.js';

export const CreateNoteInput = z
  .object({
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
    prevHash: z
      .string()
      .optional()
      .describe(
        'Optional compare-and-swap guard for overwrite: true — the contentHash of the note being replaced. Fails with hash_conflict if it changed since it was read.',
      ),
  })
  .refine((v) => v.prevHash === undefined || v.overwrite === true, {
    message:
      'prevHash only makes sense with overwrite: true (a fresh create has no prior version).',
  });
export type CreateNoteInput = z.input<typeof CreateNoteInput>;

export interface CreateNoteResult {
  path: string;
  bytesWritten: number;
  /** sha-256 (hex) of the written content — usable as prevHash for a chained edit. */
  contentHash: string;
}

export async function createNote(
  ctx: ServerContext,
  rawInput: CreateNoteInput,
): Promise<CreateNoteResult> {
  const input = CreateNoteInput.parse(rawInput);
  const absPath = join(ctx.vaultRoot, input.path);
  if (!absPath.startsWith(ctx.vaultRoot)) {
    throw new Error(`Path outside vault: ${input.path}`);
  }
  assertWritable(ctx.policy, input.path);

  if (!input.overwrite) {
    try {
      await access(absPath);
      throw new Error(`Note already exists: ${input.path}. Pass overwrite: true to replace it.`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  } else if (input.prevHash !== undefined) {
    // CAS on the note being replaced; a missing file is a conflict too (the
    // version the caller read no longer exists).
    let existing: string;
    try {
      existing = await readFile(absPath, 'utf8');
    } catch {
      throw new Error(
        JSON.stringify({
          error: 'hash_conflict',
          path: input.path,
          expected: input.prevHash,
          actual: null,
          hint: 'The note no longer exists on disk. Re-check before overwriting.',
        }),
      );
    }
    assertHashMatch(existing, input.prevHash, input.path);
  }

  let raw = '';
  if (input.frontmatter && Object.keys(input.frontmatter).length > 0) {
    raw = `---\n${stringifyYaml(input.frontmatter, { lineWidth: 0 })}---\n`;
  }
  raw += input.content ?? '';

  await mkdir(dirname(absPath), { recursive: true });
  await atomicWrite(absPath, raw);

  // Sync in-memory index so the new note is immediately searchable.
  upsertDoc(ctx, buildDoc(input.path, raw));

  return {
    path: input.path,
    bytesWritten: Buffer.byteLength(raw, 'utf8'),
    contentHash: contentHash(raw),
  };
}
