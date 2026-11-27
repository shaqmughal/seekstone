import { lstat, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { atomicWrite } from '../atomic-write.js';
import { contentHash } from '../content-hash.js';
import type { ServerContext } from '../context.js';
import { addNoteBacklinks, removeNoteBacklinks } from '../index/backlinks.js';
import { buildDoc, removeDoc, upsertDoc } from '../index/doc.js';
import type { JournalEntry } from '../journal.js';
import { assertWritable, isReadable, reservedFolder } from '../policy.js';
import { keyOnDisk, resolveVaultPath, vaultRelative } from '../vault-path.js';

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
 * The conflict check is all-or-nothing: the current state of every file is
 * checked against the entry's postHash first (CAS against the journal), and
 * any mismatch refuses the whole undo with a structured `undo_conflict`
 * unless `force` is set. The restore is not: it writes the files one at a
 * time, so a failure partway through can leave some restored and others not
 * (WRITE-SAFETY §9).
 * The undo is itself journaled, so undoing the undo redoes the write.
 */
export async function undoWrite(
  ctx: ServerContext,
  rawInput: UndoWriteInput,
): Promise<UndoWriteResult> {
  const input = UndoWriteInput.parse(rawInput);
  const journal = ctx.journal;
  if (!journal) {
    throw new Error(
      ctx.historyOffReason !== undefined
        ? `${ctx.historyOffReason} Nothing to undo.`
        : 'Write journal is disabled (SEEKSTONE_HISTORY=0); nothing to undo.',
    );
  }
  // Another server process on this vault may have written since we last looked.
  await journal.refresh();

  // Entries that touched a path outside SEEKSTONE_READ_PATHS are invisible:
  // skipped as "latest", and not found by seq (SHA-291 D3).
  const visible = ctx.policy.readGlobs ? (p: string) => isReadable(ctx.policy, p) : undefined;
  let entry: JournalEntry | undefined;
  if (input.seq === undefined) {
    entry = journal.latestUndoable(visible);
    if (!entry) throw new Error('No undoable writes in the journal.');
  } else {
    entry = journal.get(input.seq);
    if (entry && visible && !entry.files.every((f) => visible(f.path))) entry = undefined;
    if (!entry) throw new Error(`Journal entry ${input.seq} not found.`);
    if (!journal.isUndoable(entry)) throw evicted(entry.seq);
  }

  // Policy applies to every path the undo will write, before anything moves.
  // These paths come from the journal, not the caller, so `.trash/` is allowed:
  // undoing a restore puts Seekstone's own earlier state back, the same as
  // delete_note's move into `.trash/`. `.seekstone/` stays refused.
  for (const f of entry.files) assertWritable(ctx.policy, f.path, ctx.vaultRoot, '.trash');

  // Current state vs. what the journal says the write left behind.
  const current = new Map<string, string | null>();
  const conflicts: UndoConflict[] = [];
  for (const f of entry.files) {
    const abs = resolveVaultPath(ctx, f.path);
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
    try {
      preimages.set(f.path, f.preHash === null ? null : await journal.preimage(f.preHash));
    } catch (err) {
      // Another server process on this vault evicted it since we last looked.
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') throw evicted(entry.seq);
      throw err;
    }
  }

  // Journal the undo (current state → pre-image) — undoing it redoes the write.
  const txn = journal.begin('undo_write', entry.seq);
  for (const f of entry.files) {
    await txn.add(f.path, current.get(f.path) ?? null, preimages.get(f.path) ?? null);
  }
  const undoEntry = await txn.commit();

  const restored: UndoWriteResult['restored'] = [];
  for (const f of entry.files) {
    const abs = resolveVaultPath(ctx, f.path);
    const pre = preimages.get(f.path) ?? null;
    if (pre === null) {
      const key = await indexKey(ctx, abs);
      await rm(abs, { force: true });
      removeDoc(ctx, key);
      restored.push({ path: f.path, restoredHash: null });
    } else {
      await mkdir(dirname(abs), { recursive: true });
      await atomicWrite(abs, pre);
      // A note put back into .trash/ stays out of the index, as the walker
      // and watcher leave it out.
      if (f.path.endsWith('.md') && reservedFolder(f.path, ctx.vaultRoot) === undefined) {
        const key = await indexKey(ctx, abs);
        removeNoteBacklinks(ctx, key);
        if (upsertDoc(ctx, buildDoc(key, pre))) addNoteBacklinks(ctx, key, pre);
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
 * The index key for a journaled path (`./x.md`, `X.md`). Use the disk's
 * spelling only if the path exists, so a missing `X.md` can't fold onto `x.md`.
 */
async function indexKey(ctx: ServerContext, abs: string): Promise<string> {
  const key = vaultRelative(ctx.vaultRoot, abs);
  if (ctx.notes.has(key)) return key;
  const st = await lstat(abs).catch(() => undefined);
  return st === undefined ? key : keyOnDisk(ctx.vaultRoot, key);
}

function evicted(seq: number): Error {
  return new Error(
    JSON.stringify({
      error: 'entry_evicted',
      seq,
      hint: 'Its pre-image was evicted by the retention cap (SEEKSTONE_HISTORY_MAX_SIZE); it can no longer be undone.',
    }),
  );
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
