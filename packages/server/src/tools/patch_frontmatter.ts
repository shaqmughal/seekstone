import { readFile } from 'node:fs/promises';
import { parseFrontmatter } from '@seekstone/core/frontmatter';
import { parseDocument } from 'yaml';
import { z } from 'zod';
import { atomicWrite } from '../atomic-write.js';
import { assertHashMatch, contentHash } from '../content-hash.js';
import type { ServerContext } from '../context.js';
import { assertWritable } from '../policy.js';
import { resolveVaultPath } from '../vault-path.js';

export const PatchFrontmatterInput = z.object({
  path: z.string().describe('Vault-relative path to the note.'),
  patch: z
    .record(z.string(), z.unknown())
    .describe(
      'Key-value pairs to set in the frontmatter. Existing keys not in the patch are unchanged. Pass null as a value to remove a key.',
    ),
  prevHash: z
    .string()
    .optional()
    .describe(
      'Optional compare-and-swap guard: the contentHash from a prior read. Fails with hash_conflict if the note changed since.',
    ),
});
export type PatchFrontmatterInput = z.infer<typeof PatchFrontmatterInput>;

export interface PatchFrontmatterResult {
  path: string;
  keysChanged: string[];
  keysAdded: string[];
  keysRemoved: string[];
  /** sha-256 (hex) of the new content — usable as prevHash for a chained edit. */
  contentHash: string;
}

/**
 * Edit frontmatter values without reordering existing keys or changing
 * quote style. Uses yaml.parseDocument which preserves the CST, so round-trips
 * are byte-faithful for keys not touched by the patch.
 *
 * Patch semantics:
 *   - Key present in patch, value non-null → set/update
 *   - Key present in patch, value null → delete
 *   - Key absent from patch → untouched
 *
 * If the note has no frontmatter, a new `---` block is created at the top.
 */
export async function patchFrontmatter(
  ctx: ServerContext,
  input: PatchFrontmatterInput,
): Promise<PatchFrontmatterResult> {
  const absPath = resolveVaultPath(ctx.vaultRoot, input.path);
  assertWritable(ctx.policy, input.path);

  const original = await readFile(absPath, 'utf8');
  if (input.prevHash !== undefined) assertHashMatch(original, input.prevHash, input.path);
  const fm = parseFrontmatter(original);

  const keysChanged: string[] = [];
  const keysAdded: string[] = [];
  const keysRemoved: string[] = [];

  let newContent: string;

  if (!fm.present) {
    // No existing FM — create a minimal block with just the patch keys.
    const doc = parseDocument('');
    for (const [k, v] of Object.entries(input.patch)) {
      if (v !== null) {
        doc.set(k, v);
        keysAdded.push(k);
      }
    }
    newContent = `---\n${doc.toString({ lineWidth: 0 })}---\n${original}`;
  } else {
    // Parse the existing FM block preserving source tokens.
    const opensWithCRLF = original.startsWith('---\r\n');
    const openLen = opensWithCRLF ? 5 : 4;
    const closeLen = opensWithCRLF ? 7 : 5;
    const yamlText = original.slice(openLen, fm.bodyStart - closeLen);

    const doc = parseDocument(yamlText, { keepSourceTokens: true });

    for (const [k, v] of Object.entries(input.patch)) {
      const existing = doc.has(k);
      if (v === null) {
        if (existing) {
          doc.delete(k);
          keysRemoved.push(k);
        }
      } else if (existing) {
        doc.set(k, v);
        keysChanged.push(k);
      } else {
        doc.set(k, v);
        keysAdded.push(k);
      }
    }

    const head = opensWithCRLF ? '---\r\n' : '---\n';
    const tail = opensWithCRLF ? '---\r\n' : '---\n';
    newContent = `${head}${doc.toString({ lineWidth: 0 })}${tail}${fm.body}`;
  }

  await atomicWrite(absPath, newContent);

  // Update in-memory cache.
  const cached = ctx.notes.get(input.path);
  if (cached) {
    const updated = parseFrontmatter(newContent);
    cached.raw = newContent;
    cached.fmKeys = updated.keys.join(' ');
  }

  return {
    path: input.path,
    keysChanged,
    keysAdded,
    keysRemoved,
    contentHash: contentHash(newContent),
  };
}
