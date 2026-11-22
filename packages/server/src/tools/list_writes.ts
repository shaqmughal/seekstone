import { z } from 'zod';
import type { ServerContext } from '../context.js';
import type { JournalListRow } from '../journal.js';
import { isReadable } from '../policy.js';

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
  /** Present (true) only when the journal is off: SEEKSTONE_HISTORY=0, or `reason`. */
  disabled?: true;
  /** Why history is off when it isn't SEEKSTONE_HISTORY=0 (a symlinked .seekstone/). */
  reason?: string;
}

/** Recent journal entries — what `undo_write` can revert. */
export function listWrites(ctx: ServerContext, rawInput: ListWritesInput): ListWritesResult {
  const input = ListWritesInput.parse(rawInput);
  if (!ctx.journal) {
    const off: ListWritesResult = { writes: [], total: 0, disabled: true };
    if (ctx.historyOffReason !== undefined) off.reason = ctx.historyOffReason;
    return off;
  }
  const opts: { limit: number; path?: string; visible?: (path: string) => boolean } = {
    limit: input.limit,
  };
  if (input.path !== undefined) opts.path = input.path;
  // Entries that touched a path outside SEEKSTONE_READ_PATHS stay hidden (SHA-291 D3).
  if (ctx.policy.readGlobs) opts.visible = (p) => isReadable(ctx.policy, p);
  return ctx.journal.list(opts);
}
