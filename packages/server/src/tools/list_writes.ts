import { z } from 'zod';
import type { ServerContext } from '../context.js';
import type { JournalListRow } from '../journal.js';

export const ListWritesInput = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(20)
    .describe('Max entries to return, newest first (1–200, default 20).'),
  path: z.string().optional().describe('Only entries that touched this vault-relative path.'),
});
export type ListWritesInput = z.input<typeof ListWritesInput>;

export interface ListWritesResult {
  /** Newest first. Metadata only — no note content. */
  writes: JournalListRow[];
  /** Total matching entries in the journal (before `limit`). */
  total: number;
  /** Present (true) only when the journal is disabled via SEEKSTONE_HISTORY=0. */
  disabled?: true;
}

/** Recent journal entries — what `undo_write` can revert. */
export function listWrites(ctx: ServerContext, rawInput: ListWritesInput): ListWritesResult {
  const input = ListWritesInput.parse(rawInput);
  if (!ctx.journal) return { writes: [], total: 0, disabled: true };
  const opts: { limit: number; path?: string } = { limit: input.limit };
  if (input.path !== undefined) opts.path = input.path;
  return ctx.journal.list(opts);
}
