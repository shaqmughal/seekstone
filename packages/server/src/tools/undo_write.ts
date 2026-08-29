import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { atomicWrite } from '../atomic-write.js';
import { contentHash } from '../content-hash.js';
import type { ServerContext } from '../context.js';
import { addNoteBacklinks, removeNoteBacklinks } from '../index/backlinks.js';
import { buildDoc, upsertDoc } from '../index/doc.js';
import type { JournalEntry } from '../journal.js';
import { assertWritable } from '../policy.js';
import { resolveVaultPath } from '../vault-path.js';

export const UndoWriteInput = z.object({
  seq: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      'Journal entry to revert (from list_writes). Defaults to the most recent undoable write.',
    ),
  force: z
    .boolean()
    .default(false)
    .describe(
      'Restore even if a file changed after the journaled write. The clobbered state is journaled first, so nothing is lost. Defaults to false — conflicts are refused.',
    ),
});
export type UndoWriteInput = z.input<typeof UndoWriteInput>;

export interface UndoConflict {
  path: string;
  /** Hash the file had right after the journaled write (null = did not exist). */
  expectedHash: string | null;
  /** Hash the file has now (null = does not exist). */
  actualHash: string | null;
  expectedBytes: number | null;
  actualBytes: number | null;
}

export interface UndoWriteResult {
  /** The entry that was reverted. */
  seq: number;
  /** The journal entry recording this undo — undo it to redo. */
  undoSeq: number;
  tool: string;
  restored: { path: string; restoredHash: string | null }[];
  /** Conflicts overridden with force: true (their clobbered state is journaled under undoSeq). */
  overrode?: UndoConflict[];
}

/**
 * Revert a journaled write by restoring every touched file's pre-image.
 * All-or-nothing: the current state of every file is checked against the
 * entry's postHash first (CAS against the journal), and any mismatch refuses
 * the whole undo with a structured `undo_conflict` unless `force` is set.
 * The undo is itself journaled, so undoing the undo redoes the write.
 */
export async function undoWrite(
  ctx: ServerContext,
  rawInput: UndoWriteInput,
): Promise<UndoWriteResult> {
  const input = UndoWriteInput.parse(rawInput);
  const journal = ctx.journal;
  if (!journal) {
    throw new Error('Write journal is disabled (SEEKSTONE_HISTORY=0); nothing to undo.');
  }

  let entry: JournalEntry | undefined;
  if (input.seq === undefined) {
    entry = journal.latestUndoable();
    if (!entry) throw new Error('No undoable writes in the journal.');
  } else {
    entry = journal.get(input.seq);
    if (!entry) throw new Error(`Journal entry ${input.seq} not found.`);
    if (!journal.isUndoable(entry)) {
      throw new Error(
        JSON.stringify({
          error: 'entry_evicted',
          seq: entry.seq,
          hint: 'Its pre-image was evicted by the retention cap (SEEKSTONE_HISTORY_MAX_SIZE); it can no longer be undone.',
        }),
      );
    }
  }

  // Policy applies to every path the undo will write, before anything moves.
  for (const f of entry.files) assertWritable(ctx.policy, f.path);

  // Current state vs. what the journal says the write left behind.
  const current = new Map<string, string | null>();
  const conflicts: UndoConflict[] = [];
  for (const f of entry.files) {
    const abs = resolveVaultPath(ctx.vaultRoot, f.path);
    let cur: string | null = null;
    try {
      cur = await readFile(abs, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    current.set(f.path, cur);
    const actualHash = cur === null ? null : contentHash(cur);
    if (actualHash !== f.postHash) {
      conflicts.push({
        path: f.path,
        expectedHash: f.postHash,
        actualHash,
        expectedBytes: f.postHash === null ? null : await postBytes(journal, f.postHash),
        actualBytes: cur === null ? null : Buffer.byteLength(cur, 'utf8'),
      });
    }
  }
  if (conflicts.length > 0 && !input.force) {
    throw new Error(
      JSON.stringify({
        error: 'undo_conflict',
        seq: entry.seq,
        conflicts,
        hint: 'A file changed after this write (by you or another tool). Re-check it, then pass force: true to restore anyway — the current state is journaled first.',
      }),
    );
  }

  // Load every pre-image before touching disk so a missing blob aborts cleanly.
  const preimages = new Map<string, string | null>();
  for (const f of entry.files) {
    preimages.set(f.path, f.preHash === null ? null : await journal.preimage(f.preHash));
  }

  // Journal the undo (current state → pre-image) — undoing it redoes the write.
  const txn = journal.begin('undo_write', entry.seq);
  for (const f of entry.files) {
    await txn.add(f.path, current.get(f.path) ?? null, preimages.get(f.path) ?? null);
  }
  const undoEntry = await txn.commit();

  const restored: UndoWriteResult['restored'] = [];
  for (const f of entry.files) {
    const abs = resolveVaultPath(ctx.vaultRoot, f.path);
    const pre = preimages.get(f.path) ?? null;
    if (pre === null) {
      await rm(abs, { force: true });
      removeNoteBacklinks(ctx, f.path);
      if (ctx.notes.has(f.path)) {
        ctx.index.discard(f.path);
        ctx.notes.delete(f.path);
      }
      restored.push({ path: f.path, restoredHash: null });
    } else {
      await mkdir(dirname(abs), { recursive: true });
      await atomicWrite(abs, pre);
      if (f.path.endsWith('.md')) {
        removeNoteBacklinks(ctx, f.path);
        upsertDoc(ctx, buildDoc(f.path, pre));
        addNoteBacklinks(ctx, f.path, pre);
      }
      restored.push({ path: f.path, restoredHash: contentHash(pre) });
    }
  }

  const result: UndoWriteResult = {
    seq: entry.seq,
    undoSeq: undoEntry.seq,
    tool: entry.tool,
    restored,
  };
  if (conflicts.length > 0) result.overrode = conflicts;
  return result;
}

/**
 * Byte count of the post-write state, if the journal still holds it (it does
 * whenever a later entry journaled that state as ITS pre-image); otherwise
 * null — the diff summary is best-effort metadata.
 */
async function postBytes(
  journal: NonNullable<ServerContext['journal']>,
  hash: string,
): Promise<number | null> {
  try {
    return Buffer.byteLength(await journal.preimage(hash), 'utf8');
  } catch {
    return null;
  }
}
