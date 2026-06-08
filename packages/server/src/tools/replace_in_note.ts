import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseFrontmatter } from '@seekstone/core/frontmatter';
import { z } from 'zod';
import type { ServerContext } from '../context.js';

export const ReplaceInNoteInput = z.object({
  path: z.string().describe('Vault-relative path to the note.'),
  find: z.string().min(1).describe('Text or pattern to find.'),
  replace: z
    .string()
    .describe('Replacement text. Supports $1, $2, … backreferences in regex mode.'),
  regex: z.boolean().default(false).describe('Treat find as a regular expression.'),
  caseSensitive: z.boolean().default(false).describe('Case-sensitive matching.'),
  wholeWord: z
    .boolean()
    .default(false)
    .describe('Match whole words only (\\b word-boundary).'),
  limit: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Maximum number of replacements. Omit to replace all.'),
  dryRun: z
    .boolean()
    .default(false)
    .describe('If true, report matches without writing anything.'),
});
export type ReplaceInNoteInput = z.infer<typeof ReplaceInNoteInput>;

export interface MatchPosition {
  line: number;
  byteOffset: number;
}

export interface ReplaceInNoteResult {
  path: string;
  replacements: number;
  matches: MatchPosition[];
  bytesWritten?: number;
  frontmatterUnchanged: true;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRegex(
  find: string,
  opts: { regex: boolean; caseSensitive: boolean; wholeWord: boolean },
): RegExp {
  let pattern = opts.regex ? find : escapeRegex(find);
  if (opts.wholeWord) pattern = `\\b(?:${pattern})\\b`;
  const flags = `g${opts.caseSensitive ? '' : 'i'}`;
  return new RegExp(pattern, flags);
}

async function atomicWrite(absPath: string, content: string): Promise<void> {
  const tmpPath = `${absPath}.seekstone-replace-tmp`;
  await writeFile(tmpPath, content, 'utf8');
  await rename(tmpPath, absPath);
}

export async function replaceInNote(
  ctx: ServerContext,
  input: ReplaceInNoteInput,
): Promise<ReplaceInNoteResult> {
  const absPath = join(ctx.vaultRoot, input.path);
  if (!absPath.startsWith(ctx.vaultRoot)) {
    throw new Error(`Path outside vault: ${input.path}`);
  }

  // Validate regex before any IO.
  let re: RegExp;
  try {
    re = buildRegex(input.find, {
      regex: input.regex,
      caseSensitive: input.caseSensitive,
      wholeWord: input.wholeWord,
    });
  } catch (err) {
    throw new Error(`Invalid regex: ${err instanceof Error ? err.message : String(err)}`);
  }

  const raw = await readFile(absPath, 'utf8');
  const fm = parseFrontmatter(raw);
  const originalFmRegion = raw.slice(0, fm.bodyStart);
  const body = raw.slice(fm.bodyStart);

  const allMatches = [...body.matchAll(re)];
  const toReplace = input.limit !== undefined ? allMatches.slice(0, input.limit) : allMatches;

  const matches: MatchPosition[] = toReplace.map((m) => {
    const fileOffset = fm.bodyStart + (m.index ?? 0);
    const line = raw.slice(0, fileOffset).split('\n').length;
    return { line, byteOffset: fileOffset };
  });

  if (input.dryRun || toReplace.length === 0) {
    return { path: input.path, replacements: toReplace.length, matches, frontmatterUnchanged: true };
  }

  // Apply replacements left-to-right, resolving backreferences per match.
  const singleRe = new RegExp(re.source, re.flags.replace('g', ''));
  let newBody = '';
  let lastIndex = 0;
  for (const m of toReplace) {
    newBody += body.slice(lastIndex, m.index!);
    newBody += input.regex
      ? m[0].replace(singleRe, input.replace)
      : input.replace;
    lastIndex = m.index! + m[0].length;
  }
  newBody += body.slice(lastIndex);

  const newContent = `${originalFmRegion}${newBody}`;
  await atomicWrite(absPath, newContent);

  const written = await readFile(absPath, 'utf8');
  if (written.slice(0, originalFmRegion.length) !== originalFmRegion) {
    throw new Error('Write-safety violation: frontmatter region changed unexpectedly');
  }

  const cached = ctx.notes.get(input.path);
  if (cached) {
    cached.body = newBody;
    cached.raw = newContent;
    cached.sizeBytes = Buffer.byteLength(newContent, 'utf8');
  }

  return {
    path: input.path,
    replacements: toReplace.length,
    matches,
    bytesWritten: Buffer.byteLength(newContent, 'utf8'),
    frontmatterUnchanged: true,
  };
}
