import { readFile } from 'node:fs/promises';
import { parseFrontmatter } from '@seekstone/core/frontmatter';
import { extractTasks } from '@seekstone/core/tasks';
import { z } from 'zod';
import { atomicWrite } from '../atomic-write.js';
import { assertHashMatch, contentHash } from '../content-hash.js';
import type { ServerContext } from '../context.js';
import { journalWrite } from '../journal.js';
import { assertWritable } from '../policy.js';
import { resolveVaultPath } from '../vault-path.js';

export const UpdateTaskInput = z.object({
  path: z.string().describe('Vault-relative path to the note.'),
  line: z
    .number()
    .int()
    .min(1)
    .describe('1-based line number of the task, as returned by list_tasks.'),
  expectText: z
    .string()
    .optional()
    .describe(
      'Optional guard: the task text list_tasks returned. Fails with task_text_mismatch if the line’s text changed since.',
    ),
  state: z
    .string()
    .length(1)
    .refine((s) => !/[\]\r\n]/.test(s), {
      message: 'state must be a single character other than "]" or a line break',
    })
    .describe('New marker character: "x" (done), " " (open), or a custom marker like "/".'),
  prevHash: z
    .string()
    .optional()
    .describe(
      'Optional compare-and-swap guard: the contentHash from a prior read. Fails with hash_conflict if the note changed since.',
    ),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskInput>;

export interface UpdateTaskResult {
  path: string;
  line: number;
  oldState: string;
  newState: string;
  /** sha-256 (hex) of the note content after the write — usable as prevHash for a chained edit. */
  contentHash: string;
}

/** Character offset of the start of a 1-based line. The line is known to exist. */
function lineStartOffset(raw: string, line: number): number {
  let offset = 0;
  for (let n = 1; n < line; n++) {
    offset = raw.indexOf('\n', offset) + 1;
  }
  return offset;
}

/**
 * Set the state of one checkbox, rewriting exactly one character position.
 *
 * The write contract:
 *   - The target line is re-validated against the same scanner list_tasks
 *     uses, so a line the read tool would not report (prose, fenced code,
 *     frontmatter) is refused — never spliced blind.
 *   - Everything except the single marker character is byte-identical by
 *     construction; the frontmatter region is re-read and verified after
 *     the write like the other body-edit tools.
 *   - Setting a task to its current state is a success no-op: no journal
 *     entry, no write.
 */
export async function updateTask(
  ctx: ServerContext,
  input: UpdateTaskInput,
): Promise<UpdateTaskResult> {
  const absPath = resolveVaultPath(ctx.vaultRoot, input.path);
  assertWritable(ctx.policy, input.path);

  const original = await readFile(absPath, 'utf8');
  if (input.prevHash !== undefined) assertHashMatch(original, input.prevHash, input.path);

  const lineCount = original.split('\n').length;
  if (input.line > lineCount) {
    throw new Error(
      JSON.stringify({
        error: 'line_out_of_range',
        path: input.path,
        line: input.line,
        lineCount,
        hint: 'The note has fewer lines than the requested task line. Re-run list_tasks.',
      }),
    );
  }

  const task = extractTasks(original).find((t) => t.line === input.line);
  if (!task) {
    throw new Error(
      JSON.stringify({
        error: 'not_a_task',
        path: input.path,
        line: input.line,
        hint: 'Line is not a Markdown checkbox (or is inside frontmatter or a code fence). Re-run list_tasks.',
      }),
    );
  }

  if (input.expectText !== undefined && task.text !== input.expectText) {
    throw new Error(
      JSON.stringify({
        error: 'task_text_mismatch',
        path: input.path,
        line: input.line,
        expected: input.expectText,
        actual: task.text,
        hint: 'The task text changed since it was listed. Re-run list_tasks and retry.',
      }),
    );
  }

  if (task.state === input.state) {
    return {
      path: input.path,
      line: input.line,
      oldState: task.state,
      newState: task.state,
      contentHash: contentHash(original),
    };
  }

  const markerOffset = lineStartOffset(original, input.line) + task.col;
  const newContent = `${original.slice(0, markerOffset)}${input.state}${original.slice(markerOffset + 1)}`;

  const fm = parseFrontmatter(original);
  const originalFmRegion = original.slice(0, fm.bodyStart);

  await journalWrite(ctx, 'update_task', input.path, original, newContent);
  await atomicWrite(absPath, newContent);

  const written = await readFile(absPath, 'utf8');
  if (written.slice(0, originalFmRegion.length) !== originalFmRegion) {
    throw new Error('Write-safety violation: frontmatter region changed unexpectedly');
  }

  const cached = ctx.notes.get(input.path);
  if (cached) {
    cached.body = newContent.slice(fm.bodyStart);
    cached.raw = newContent;
    cached.tasks = extractTasks(newContent);
    cached.sizeBytes = Buffer.byteLength(newContent, 'utf8');
  }

  return {
    path: input.path,
    line: input.line,
    oldState: task.state,
    newState: input.state,
    contentHash: contentHash(newContent),
  };
}
