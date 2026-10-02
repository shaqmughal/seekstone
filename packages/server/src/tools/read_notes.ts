import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { ReadNoteInput, type ReadNoteResult, readNote } from './read_note.js';

export const DEFAULT_BUDGET_BYTES = 16384;

export const ReadNotesInput = z.object({
  items: z
    .array(ReadNoteInput)
    .min(1)
    .max(20)
    .describe(
      'Notes to read, 1–20, each with the same options as read_note (path plus at most one of section, block, or lines).',
    ),
  budgetBytes: z
    .number()
    .int()
    .min(256)
    .max(65536)
    .default(DEFAULT_BUDGET_BYTES)
    .describe(
      'Cap on the total note text returned across all items (UTF-8 bytes). When exceeded, each item is truncated to a fair share.',
    ),
});
export type ReadNotesInput = z.infer<typeof ReadNotesInput>;

/** A successful item: read_note's result, plus `truncated` when the budget cut it. */
export type ReadNotesItem = ReadNoteResult & { truncated?: true };

/** A failed item. It uses no budget and does not fail the batch. */
export interface ReadNotesError {
  path: string;
  error: string;
  [detail: string]: unknown;
}

export interface ReadNotesResult {
  notes: (ReadNotesItem | ReadNotesError)[];
  budgetBytes: number;
  /** Sum of `bytesReturned` across successful items; never exceeds budgetBytes. */
  bytesUsed: number;
}

/**
 * Batch read (SHA-293). Each item goes through readNote() unchanged, so span
 * semantics, contentHash and error shapes can't diverge from the single read.
 * Items are read in parallel and returned in request order.
 */
export async function readNotes(
  ctx: ServerContext,
  input: ReadNotesInput,
): Promise<ReadNotesResult> {
  const budget = input.budgetBytes;
  const results = await Promise.all(
    input.items.map((item) => readNote(ctx, item).catch((err) => toItemError(item.path, err))),
  );

  const entries = results
    .filter((r): r is ReadNoteResult => !('error' in r))
    .map((r) => ({ r, size: r.bytesReturned, alloc: 0 }));
  allocate(entries, budget);
  const cut = new Map<ReadNoteResult, ReadNotesItem>(
    entries.map((e) => [e.r, truncateItem(e.r, e.alloc)]),
  );

  const notes = results.map((r) => cut.get(r as ReadNoteResult) ?? (r as ReadNotesError));
  const bytesUsed = [...cut.values()].reduce((sum, r) => sum + r.bytesReturned, 0);
  return { notes, budgetBytes: budget, bytesUsed };
}

/** Map a readNote() failure to a per-item error object. readNote only throws Errors. */
function toItemError(path: string, err: unknown): ReadNotesError {
  const { message, code } = err as NodeJS.ErrnoException;
  // section_not_found / block_not_found already carry a structured JSON payload.
  if (message.startsWith('{')) return { path, ...(JSON.parse(message) as { error: string }) };
  if (message.startsWith('Path outside vault')) return { path, error: 'outside_vault' };
  if (code === 'ENOENT') return { path, error: 'not_found' };
  return { path, error: 'read_failed', message };
}

/**
 * Split a byte budget across entries by setting each entry's `alloc`
 * (water-filling). If everything fits, every entry keeps its full size.
 * Otherwise each unfilled entry gets an even share; entries smaller than the
 * share keep their full size and their slack is shared among the rest, until
 * the allocation is stable. Every non-empty entry gets a non-zero share
 * whenever budget >= the entry count.
 */
export function allocate(entries: { size: number; alloc: number }[], budget: number): void {
  let pending = entries.filter((e) => e.size > 0);
  let remaining = budget;
  for (const e of entries) e.alloc = e.size;
  if (entries.reduce((sum, e) => sum + e.size, 0) <= budget) return;
  while (pending.length > 0) {
    const share = Math.floor(remaining / pending.length);
    const fits = pending.filter((e) => e.size <= share);
    if (fits.length === 0) {
      // Everyone left is bigger than the share: split what remains evenly, and
      // hand the leftover bytes of the division to the first entries in order.
      const extra = remaining - share * pending.length;
      for (const [k, e] of pending.entries()) e.alloc = share + (k < extra ? 1 : 0);
      return;
    }
    for (const e of fits) remaining -= e.size;
    pending = pending.filter((e) => e.size > share);
  }
}

/** Cut an item's content to `maxBytes` without splitting a UTF-8 character. */
function truncateItem(r: ReadNoteResult, maxBytes: number): ReadNotesItem {
  if (r.bytesReturned <= maxBytes) return r;
  const buf = Buffer.from(r.content, 'utf8');
  let end = maxBytes;
  // Back off continuation bytes (10xxxxxx) so the cut lands on a character start.
  while (end > 0 && (buf.readUInt8(end) & 0xc0) === 0x80) end--;
  const content = buf.toString('utf8', 0, end);
  return { ...r, content, bytesReturned: end, truncated: true };
}
