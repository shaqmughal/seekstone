import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerContext } from './context.js';
import { HISTORY_DIR, Journal, journalWrite } from './journal.js';
import { PERMISSIVE_POLICY } from './policy.js';
import { listWrites } from './tools/list_writes.js';
import { undoWrite } from './tools/undo_write.js';

// SHA-650: a journal call that fails must not leave a row that loads as
// committed, and a failed compaction must not fail the write. SHA-662: the
// failed row is replaced by a void row that keeps its seq.

/** One-shot failures, armed by a test and cleared when they fire. */
const fail = vi.hoisted(() => ({
  manifestFsync: false,
  rollbackFsync: false,
  manifestRename: false,
  truncate: false,
  /** The void row's write writes half the row, then throws. 'crash' saves the file first. */
  voidWrite: '' as '' | 'error' | 'crash',
}));
/** The manifest as it was when the failing fsync ran: the row is on disk. */
const seen = vi.hoisted(() => ({
  manifest: '',
  ops: [] as string[],
  calls: [] as string[],
  /** A 'crash' void write: the manifest after the cut, and with half the void row. */
  crash: { cut: '', torn: '' },
}));

vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  /** Open manifest fds → whether opened for append. */
  const manifestFds = new Map<number, { path: string; append: boolean }>();
  const openSync = (path: string, flags: string, ...rest: unknown[]): number => {
    const fd = (fs.openSync as (...a: unknown[]) => number)(path, flags, ...rest);
    if (String(path).endsWith('manifest.jsonl')) {
      manifestFds.set(fd, { path, append: flags === 'a' });
      seen.calls.push(`open:${flags}`);
    }
    return fd;
  };
  const closeSync = (fd: number): void => {
    manifestFds.delete(fd);
    fs.closeSync(fd);
  };
  const writeSync = (fd: number, buf: Buffer, off: number, len: number, pos?: number): number => {
    const m = manifestFds.get(fd);
    if (m !== undefined) seen.calls.push('write');
    if (fail.voidWrite !== '' && m !== undefined && !m.append) {
      const crash = fail.voidWrite === 'crash';
      fail.voidWrite = '';
      if (crash) seen.crash.cut = fs.readFileSync(m.path, 'utf8');
      fs.writeSync(fd, buf, off, Math.floor(len / 2), pos);
      if (crash) seen.crash.torn = fs.readFileSync(m.path, 'utf8');
      throw Object.assign(new Error('EIO: void row write'), { code: 'EIO' });
    }
    return fs.writeSync(fd, buf, off, len, pos);
  };
  // The row is written in full; only the fsync after it fails.
  const fsyncSync = (fd: number): void => {
    const m = manifestFds.get(fd);
    if (m !== undefined) seen.ops.push('fsync');
    if (m !== undefined) seen.calls.push('fsync');
    if (fail.manifestFsync && m?.append) {
      fail.manifestFsync = false;
      seen.manifest = fs.readFileSync(m.path, 'utf8');
      throw Object.assign(new Error('EIO: i/o error, fsync'), { code: 'EIO' });
    }
    if (fail.rollbackFsync && m !== undefined && !m.append) {
      fail.rollbackFsync = false;
      throw Object.assign(new Error('EIO: rollback fsync'), { code: 'EIO' });
    }
    fs.fsyncSync(fd);
  };
  // The compaction rewrite fails the way Windows fails it while another
  // process has the manifest open.
  const renameSync = (from: string, to: string): void => {
    if (fail.manifestRename && String(to).endsWith('manifest.jsonl')) {
      fail.manifestRename = false;
      throw Object.assign(new Error('EPERM: operation not permitted, rename'), { code: 'EPERM' });
    }
    fs.renameSync(from, to);
  };
  const failTruncate = (): void => {
    if (!fail.truncate) return;
    fail.truncate = false;
    throw Object.assign(new Error('EIO: i/o error, truncate'), { code: 'EIO' });
  };
  const truncateSync = (path: string, len?: number): void => {
    if (String(path).endsWith('manifest.jsonl')) seen.calls.push('truncate');
    failTruncate();
    fs.truncateSync(path, len);
  };
  const ftruncateSync = (fd: number, len?: number): void => {
    if (manifestFds.has(fd)) seen.ops.push('ftruncate');
    if (manifestFds.has(fd)) seen.calls.push('ftruncate');
    failTruncate();
    fs.ftruncateSync(fd, len);
  };
  const mocked = { openSync, closeSync, fsyncSync, renameSync, truncateSync, ftruncateSync };
  Object.assign(mocked, { writeSync });
  return { ...fs, ...mocked, default: { ...fs, ...mocked } };
});

let vault: string;
let warnings: string[];
const log = {
  level: 'debug' as const,
  error: () => {},
  warn: (m: string) => void warnings.push(m),
  info: () => {},
  debug: () => {},
};
const BIG = { maxBytes: 1e9, maxEntries: 1e6 };
const write = (j: Journal, tool: string) =>
  journalWrite({ journal: j }, tool, `${tool}.md`, 'v1', 'v2');
const tools = (j: Journal) => j.list({ limit: 100 }).writes.map((w) => `${w.seq}${w.tool}`);
const manifestRows = async () =>
  (await readFile(join(vault, HISTORY_DIR, 'manifest.jsonl'), 'utf8'))
    .split('\n')
    .filter((l) => l !== '')
    .map((l) => JSON.parse(l).tool as string);

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'seekstone-journal-rollback-'));
  warnings = [];
});
afterEach(async () => {
  fail.manifestFsync = false;
  fail.rollbackFsync = false;
  fail.manifestRename = false;
  fail.truncate = false;
  fail.voidWrite = '';
  await rm(vault, { recursive: true, force: true });
});

describe('Journal: a failed append', () => {
  it('leaves no row when the fsync after the append fails', async () => {
    const j = await Journal.open(vault, BIG, { log });
    await write(j, 'a');
    fail.manifestFsync = true;
    await expect(write(j, 'b')).rejects.toThrow(/EIO/);
    expect(fail.manifestFsync).toBe(false);
    // SHA-662: a void row keeps b's seq, so it is never handed out again.
    expect(await manifestRows()).toEqual(['a', 'void']);
    expect(tools(await Journal.open(vault, BIG))).toEqual(['1a']);
    // The running journal carries on at the seq after the void row.
    await write(j, 'c');
    expect(tools(j)).toEqual(['3c', '1a']);
    expect(tools(await Journal.open(vault, BIG))).toEqual(['3c', '1a']);
  });

  it('leaves no row when the first append to a new manifest fails', async () => {
    const j = await Journal.open(vault, BIG, { log });
    fail.manifestFsync = true;
    await expect(write(j, 'a')).rejects.toThrow(/EIO/);
    expect(await manifestRows()).toEqual(['void']);
    expect(tools(await Journal.open(vault, BIG))).toEqual([]);
  });

  it('fsyncs the manifest after cutting the row off', async () => {
    const j = await Journal.open(vault, BIG, { log });
    await write(j, 'a');
    fail.manifestFsync = true;
    seen.ops = [];
    await expect(write(j, 'b')).rejects.toThrow(/EIO/);
    // The failed append's fsync, then the cut, then the fsync that makes it durable.
    expect(seen.ops).toEqual(['fsync', 'ftruncate', 'fsync']);
  });

  it('reports the append error when the fsync after the cut fails too', async () => {
    const j = await Journal.open(vault, BIG, { log });
    fail.manifestFsync = true;
    fail.rollbackFsync = true;
    await expect(write(j, 'a')).rejects.toThrow('EIO: i/o error, fsync');
    expect(fail.rollbackFsync).toBe(false);
    expect(warnings.some((w) => w.includes('roll back'))).toBe(true);
    await write(j, 'b');
    expect(tools(j)).toEqual(tools(await Journal.open(vault, BIG)));
  });

  it('warns and rereads the manifest when the rollback itself fails', async () => {
    const j = await Journal.open(vault, BIG, { log });
    fail.manifestFsync = true;
    fail.truncate = true;
    await expect(write(j, 'a')).rejects.toThrow(/fsync/);
    expect(fail.truncate).toBe(false);
    expect(warnings.some((w) => w.includes('roll back'))).toBe(true);
    // The row stayed on disk, so it loads as committed; the next seq follows it.
    await write(j, 'b');
    expect(tools(j)).toEqual(['2b', '1a']);
  });
});

const CAP = { maxBytes: 1e9, maxEntries: 2 };
const manifest = () => join(vault, HISTORY_DIR, 'manifest.jsonl');

/**
 * A appends row b and its fsync fails. B refreshes while b is on disk
 * (replayed here in place, same inode), then A rolls b back. Returns B,
 * which has b cached. With `voidFails`, the void row's write fails too, so
 * the rollback is the cut alone and b's seq is free again.
 */
async function staleAfterRollback(config: typeof CAP, voidFails = false) {
  const a = await Journal.open(vault, config, { log });
  const b = await Journal.open(vault, config, { log });
  await write(a, 'a');
  fail.manifestFsync = true;
  if (voidFails) fail.voidWrite = 'error';
  await expect(write(a, 'b')).rejects.toThrow(/EIO/);
  const rolledBack = await readFile(manifest(), 'utf8');
  await writeFile(manifest(), seen.manifest);
  await b.refresh();
  expect(tools(b)).toEqual(['2b', '1a']);
  await writeFile(manifest(), rolledBack);
  return { a, b };
}

describe('Journal: another process saw the rolled-back row', () => {
  it('a locked commit notices a same-length row in place of the cached one', async () => {
    const { a, b } = await staleAfterRollback(CAP, true);
    // Same length as b, and the same seq: B's size check can't tell them apart.
    await write(a, 'c');
    await write(b, 'd');
    expect(await manifestRows()).toEqual(['c', 'd']);
    expect(tools(b)).toEqual(tools(await Journal.open(vault, CAP)));
    expect(tools(b).map((t) => t.slice(-1))).toEqual(['d', 'c']);
  });

  it('a refresh rereads from the start when the cached last row changed', async () => {
    const { a, b } = await staleAfterRollback({ maxBytes: 1e9, maxEntries: 100 }, true);
    // Longer than b: a reread from B's old offset would start mid-row.
    await write(a, 'longer-c');
    await b.refresh();
    expect(tools(b)).toEqual(['2longer-c', '1a']);
  });
});

describe('Journal: a void row keeps a rolled-back seq (SHA-662)', () => {
  const ctxOf = (j: Journal) =>
    ({ vaultRoot: vault, journal: j, policy: PERMISSIVE_POLICY }) as unknown as ServerContext;
  const failedRowTs = () => JSON.parse(seen.manifest.trimEnd().split('\n').at(-1) ?? '').ts;

  it('a process that saw the failed row finds a void entry under its seq', async () => {
    const { a, b } = await staleAfterRollback(BIG);
    await write(a, 'longer-c');
    // undo_write refreshes first, and its seq now names the void row, not c.
    await expect(undoWrite(ctxOf(b), { seq: 2 })).rejects.toThrow(/"error":"nothing_to_undo"/);
    expect(b.get(2)).toEqual({ seq: 2, ts: failedRowTs(), tool: 'void', files: [] });
    expect(tools(b)).toEqual(['3longer-c', '1a']);
  });

  it('a process that never saw the failed row takes the next seq', async () => {
    const a = await Journal.open(vault, BIG, { log });
    await write(a, 'a');
    const c = await Journal.open(vault, BIG, { log });
    fail.manifestFsync = true;
    await expect(write(a, 'b')).rejects.toThrow(/EIO/);
    await write(c, 'c');
    expect(tools(c)).toEqual(['3c', '1a']);
    expect(await manifestRows()).toEqual(['a', 'void', 'c']);
  });

  it('keeps the real write when a process that cached the failed row compacts', async () => {
    for (const order of ['a first', 'b first']) {
      await rm(join(vault, HISTORY_DIR), { recursive: true, force: true });
      const { a, b } = await staleAfterRollback(CAP);
      if (order === 'a first') await write(a, 'c');
      await write(b, 'd');
      if (order === 'b first') await write(a, 'c');
      const want = order === 'a first' ? ['c', 'd'] : ['d', 'c'];
      expect(await manifestRows()).toEqual(want);
      expect(tools(await Journal.open(vault, CAP)).map((t) => t.slice(-1))).toEqual(
        want.toReversed(),
      );
    }
  });

  it('a crash between the cut and the void row leaves no phantom row', async () => {
    const j = await Journal.open(vault, BIG, { log });
    await write(j, 'a');
    fail.manifestFsync = true;
    fail.voidWrite = 'crash';
    await expect(write(j, 'b')).rejects.toThrow('EIO: i/o error, fsync');
    const aRow = seen.crash.cut;
    expect(aRow.split('\n')).toHaveLength(2);
    expect(seen.crash.torn.length).toBeGreaterThan(aRow.length);
    for (const state of [seen.crash.cut, seen.crash.torn]) {
      await writeFile(manifest(), state);
      warnings = [];
      const fresh = await Journal.open(vault, BIG, { log });
      expect(tools(fresh)).toEqual(['1a']);
      // Half a void row is a torn line: skipped with a warning, cut off by the next write.
      expect(warnings.includes('journal: skipping malformed manifest line')).toBe(state !== aRow);
      await write(fresh, 'c');
      expect(await manifestRows()).toEqual(['a', 'c']);
      expect(tools(fresh)).toEqual(['2c', '1a']);
    }
  });

  it('reports the append error and leaves no partial line when the void row fails', async () => {
    const j = await Journal.open(vault, BIG, { log });
    await write(j, 'a');
    const aRow = await readFile(manifest(), 'utf8');
    fail.manifestFsync = true;
    fail.voidWrite = 'error';
    await expect(write(j, 'b')).rejects.toThrow('EIO: i/o error, fsync');
    expect(fail.voidWrite).toBe('');
    expect(await readFile(manifest(), 'utf8')).toBe(aRow);
    expect(warnings.some((w) => w.includes('void row'))).toBe(true);
    await write(j, 'c');
    expect(tools(j)).toEqual(['2c', '1a']);
    expect(tools(await Journal.open(vault, BIG))).toEqual(['2c', '1a']);
  });

  it('list_writes hides it, default undo skips it, undo by seq has nothing to undo', async () => {
    const j = await Journal.open(vault, BIG, { log });
    fail.manifestFsync = true;
    await expect(write(j, 'a')).rejects.toThrow(/EIO/);
    await expect(undoWrite(ctxOf(j), {})).rejects.toThrow('No undoable writes in the journal.');
    await write(j, 'b');
    fail.manifestFsync = true;
    await expect(write(j, 'c')).rejects.toThrow(/EIO/);
    expect(await manifestRows()).toEqual(['void', 'b', 'void']);
    expect(listWrites(ctxOf(j), {})).toEqual({
      writes: [expect.objectContaining({ seq: 2, tool: 'b' })],
      total: 1,
    });
    expect(j.latestUndoable()?.seq).toBe(2);
    // b.md was never written, so the default undo stops at a conflict on seq 2.
    await expect(undoWrite(ctxOf(j), {})).rejects.toThrow(/"error":"undo_conflict","seq":2/);
    for (const seq of [1, 3]) {
      const err = await undoWrite(ctxOf(j), { seq }).catch((e: Error) => JSON.parse(e.message));
      expect(err).toEqual({
        error: 'nothing_to_undo',
        seq,
        hint: expect.stringMatching(/failed/),
      });
    }
  });

  it('a void row counts toward the entry cap but keeps the newest real write', async () => {
    const j = await Journal.open(vault, CAP, { log });
    await write(j, 'x');
    await write(j, 'a');
    // The first compaction fails, the second drops x but keeps a and its void rows.
    for (const rows of ['x a void', 'a void void']) {
      fail.manifestFsync = true;
      fail.manifestRename = rows.startsWith('x');
      await expect(write(j, 'b')).rejects.toThrow('EIO: i/o error, fsync');
      expect((await manifestRows()).join(' ')).toBe(rows);
    }
    expect(warnings.filter((w) => w.includes('compaction failed'))).toHaveLength(1);
    await write(j, 'd');
    expect(await manifestRows()).toEqual(['void', 'd']);
  });

  it('leaves the byte cap to the next commit after a void row', async () => {
    const j = await Journal.open(vault, { maxBytes: 6, maxEntries: 1 }, { log });
    await journalWrite({ journal: j }, 'a', 'a.md', 'aaaa', 'v2');
    // b's pre-image is stored before the append fails: 8 bytes, over the cap.
    fail.manifestFsync = true;
    await expect(journalWrite({ journal: j }, 'b', 'b.md', 'bbbb', 'v2')).rejects.toThrow(/EIO/);
    expect(j.list({}).writes).toEqual([expect.objectContaining({ tool: 'a', undoable: true })]);
  });

  it('adds no manifest calls to a normal commit', async () => {
    const j = await Journal.open(vault, BIG, { log });
    await write(j, 'a');
    seen.calls = [];
    await write(j, 'b');
    // The cache check, then the append and its fsync.
    expect(seen.calls).toEqual(['open:r', 'open:a', 'write', 'fsync']);
  });
});

describe('Journal: a failed compaction', () => {
  const CAP = { maxBytes: 1e9, maxEntries: 2 };

  it('does not fail the write, and the next commit compacts to the cap', async () => {
    const j = await Journal.open(vault, CAP, { log });
    await write(j, 'a');
    await write(j, 'b');
    fail.manifestRename = true;
    const entry = await write(j, 'c').then(() => j.get(3));
    expect(fail.manifestRename).toBe(false);
    expect(entry?.tool).toBe('c');
    expect(warnings.some((w) => w.includes('compaction failed'))).toBe(true);
    expect(await manifestRows()).toEqual(['a', 'b', 'c']);

    // The running journal and a fresh open agree on what is listed.
    await j.refresh();
    const fresh = await Journal.open(vault, CAP);
    expect(tools(j)).toContain('3c');
    expect(tools(j)).toEqual(tools(fresh));

    await write(j, 'd');
    expect(await manifestRows()).toEqual(['c', 'd']);
    expect(tools(j)).toEqual(['4d', '3c']);
    expect(tools(await Journal.open(vault, CAP))).toEqual(['4d', '3c']);
  });
});
