import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { assertTagExists, normalizeTag, noteHasTag } from '../index/tags.js';
import type { IndexedNote } from '../index/types.js';

const ISO_DATE = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'not a parseable date' });

export const ListTasksInput = z.object({
  path: z
    .string()
    .optional()
    .describe('Vault-relative path to a single note. Omit to search the whole vault.'),
  folder: z
    .string()
    .optional()
    .describe('Restrict to notes under this vault-relative folder prefix.'),
  tag: z
    .string()
    .optional()
    .describe(
      'Restrict to notes with this tag. # optional, case-insensitive, and nested child tags match (e.g. "project" matches #project/alpha).',
    ),
  state: z
    .union([z.enum(['open', 'done', 'any']), z.string().length(1)])
    .default('open')
    .describe(
      'Which tasks to return: "open" (`- [ ]`, the default), "done" (`- [x]` or `- [X]`), ' +
        '"any", or a single custom marker character such as "/" or "-".',
    ),
  modifiedAfter: ISO_DATE.optional().describe(
    'Only tasks in notes modified at or after this ISO 8601 date/time.',
  ),
  limit: z.number().int().min(1).max(500).default(100).describe('Maximum number of tasks.'),
});
export type ListTasksInput = z.infer<typeof ListTasksInput>;

export interface TaskRow {
  path: string;
  /** 1-based line number — pass straight to update_task. */
  line: number;
  /** Raw single-char checkbox marker (` `, `x`, `/`, …). */
  state: string;
  text: string;
  /** Nearest preceding heading, omitted when the task sits above every heading. */
  heading?: string;
}

export interface ListTasksResult {
  tasks: TaskRow[];
  /** Matching tasks before the limit was applied. */
  total: number;
  truncated: boolean;
}

function stateMatches(marker: string, wanted: string): boolean {
  if (wanted === 'any') return true;
  if (wanted === 'open') return marker === ' ';
  if (wanted === 'done') return marker === 'x' || marker === 'X';
  return marker === wanted;
}

/**
 * Enumerate Markdown checkbox items as compact structured rows. Reads the
 * task entries the index extracted at build/watch time — never note files —
 * so a vault-wide listing is a Map iteration, not 10k disk reads.
 */
export function listTasks(ctx: ServerContext, input: ListTasksInput): ListTasksResult {
  const tag = input.tag === undefined ? undefined : normalizeTag(input.tag);
  const after = input.modifiedAfter ? Date.parse(input.modifiedAfter) : undefined;

  let sources: Iterable<[string, IndexedNote]>;
  if (input.path !== undefined) {
    const note = ctx.notes.get(input.path);
    if (!note) {
      throw new Error(
        JSON.stringify({
          error: 'note_not_found',
          path: input.path,
          hint: 'No indexed note at this path. Use resolve_note or list_notes to find the right path.',
        }),
      );
    }
    sources = [[input.path, note]];
  } else {
    sources = ctx.notes;
  }

  const rows: TaskRow[] = [];

  for (const [path, note] of sources) {
    if (input.folder && !path.startsWith(input.folder)) continue;
    if (tag && !noteHasTag(note.tags, tag)) continue;
    if (after !== undefined && note.mtimeMs < after) continue;
    if (note.tasks.length === 0) continue;

    for (const task of note.tasks) {
      if (!stateMatches(task.state, input.state)) continue;
      rows.push({
        path,
        line: task.line,
        state: task.state,
        text: task.text,
        ...(task.heading !== undefined ? { heading: task.heading } : {}),
      });
    }
  }

  // An empty tag-filtered result may be a misspelled tag: say so (SHA-264).
  if (rows.length === 0 && input.tag) assertTagExists(ctx.notes, input.tag);

  rows.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);

  const total = rows.length;
  const tasks = rows.slice(0, input.limit);
  return { tasks, total, truncated: total > input.limit };
}
