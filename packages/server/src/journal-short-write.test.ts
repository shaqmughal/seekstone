import { spawnSync } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contentHash } from './content-hash.js';
import {
  HISTORY_DIR,
  inspectLock,
  Journal,
  type JournalEntry,
  journalWrite,
  type LockSnapshot,
} from './journal.js';

// SHA-566: writeSync may write fewer bytes than asked. These tests make it do
// so (or fail) and check the journal never reports a commit it didn't finish.

type Mode =
  | { kind: 'normal' }
  | { kind: 'chunks'; size: number }
  | { kind: 'tornLine' }
  | { kind: 'beforeLockToken'; run: () => void; fail?: boolean }
  | { kind: 'renameClash'; garbage?: boolean }
  | { kind: 'tokensFail' };
const mode = vi.hoisted(() => ({ current: { kind: 'normal' } as Mode }));
/** When set, runs right after the next closeSync (the creator's pause point). */
const afterClose = vi.hoisted(() => ({ run: undefined as (() => void) | undefined }));
/** When set, the next blob read fails with ENOENT although the blob is on disk. */
const staleRead = vi.hoisted(() => ({ next: false }));

vi.mock('node:fs/promises', async (importOriginal) => {
  const fsp = await importOriginal<typeof import('node:fs/promises')>();
  const readFile = ((...args: Parameters<typeof fsp.readFile>) => {
    if (staleRead.next && String(args[0]).includes('blobs')) {
      staleRead.next = false;
      // The read lost a race: another commit restored the blob after it looked.
      return Promise.reject(Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' }));
    }
    return fsp.readFile(...args);
  }) as typeof fsp.readFile;
  return { ...fsp, readFile, default: { ...fsp, readFile } };
});

vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  const writeSync = (fd: number, data: unknown, ...rest: unknown[]): number => {
    const m = mode.current;
    const real = () => (fs.writeSync as (...a: unknown[]) => number)(fd, data, ...rest);
    if (m.kind === 'normal') return real();
    if (m.kind === 'tokensFail') {
      // A full disk: every lock and claim token write fails.
      if (Buffer.isBuffer(data) && data.includes('"host"')) {
        throw Object.assign(new Error('ENOSPC: no space left on device, write'), {
          code: 'ENOSPC',
        });
      }
      return real();
    }
    if (m.kind === 'beforeLockToken') {
      // Lock and claim tokens carry a host; manifest lines and blobs don't.
      if (Buffer.isBuffer(data) && data.includes('"host"')) {
        mode.current = { kind: 'normal' };
        m.run();
        if (m.fail) throw Object.assign(new Error('EIO: i/o error, write'), { code: 'EIO' });
      }
      return real();
    }
    let buf: Buffer;
    let off = 0;
    let len: number;
    if (typeof data === 'string') {
      buf = Buffer.from(data, 'utf8');
      len = buf.length;
    } else {
      buf = data as Buffer;
      off = typeof rest[0] === 'number' ? rest[0] : 0;
      len = typeof rest[1] === 'number' ? rest[1] : buf.length - off;
    }
    if (m.kind === 'chunks') return fs.writeSync(fd, buf, off, Math.min(len, m.size));
    // tornLine: a manifest line gets 7 bytes out, then the disk fails.
    if (!buf.includes('"files"')) return fs.writeSync(fd, buf, off, len);
    if (off > 0) throw Object.assign(new Error('EIO: i/o error, write'), { code: 'EIO' });
    return fs.writeSync(fd, buf, off, Math.min(len, 7));
  };
  // renameClash: another process places the same blob first, and the rename
  // onto it fails the way Windows fails it.
  const renameSync = (from: string, to: string): void => {
    const m = mode.current;
    if (m.kind === 'renameClash' && from.endsWith('.seekstone-tmp')) {
      mode.current = { kind: 'normal' };
      if (m.garbage) fs.writeFileSync(to, 'not the pre-image');
      else fs.copyFileSync(from, to);
      throw Object.assign(new Error('EPERM: operation not permitted, rename'), { code: 'EPERM' });
    }
    fs.renameSync(from, to);
  };
  const closeSync = (fd: number): void => {
    fs.closeSync(fd);
    const run = afterClose.run;
    afterClose.run = undefined;
    run?.();
  };
  return {
    ...fs,
    writeSync,
    renameSync,
    closeSync,
    default: { ...fs, writeSync, renameSync, closeSync },
  };
});

let vault: string;
const BIG = { maxBytes: 1e9, maxEntries: 1e6 };
const write = (j: Journal, tool: string, pre: string | null, post: string) =>
  journalWrite({ journal: j }, tool, `${tool}.md`, pre, post);

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'seekstone-journal-short-'));
  mode.current = { kind: 'normal' };
});
afterEach(async () => {
  mode.current = { kind: 'normal' };
  await rm(vault, { recursive: true, force: true });
});

describe('Journal with short writes', () => {
  it('writes the whole manifest line when writeSync returns early', async () => {
    const j = await Journal.open(vault, BIG);
    mode.current = { kind: 'chunks', size: 7 };
    await write(j, 'a', 'v1', 'v2');
    await write(j, 'b', 'v2', 'v3');
    mode.current = { kind: 'normal' };
    const raw = await readFile(join(vault, HISTORY_DIR, 'manifest.jsonl'), 'utf8');
    expect(
      raw
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l).seq),
    ).toEqual([1, 2]);
    expect((await Journal.open(vault, BIG)).list().writes.map((w) => w.tool)).toEqual(['b', 'a']);
  });

  it('fails the commit, and leaves no lock, when a write makes no progress', async () => {
    const j = await Journal.open(vault, BIG);
    mode.current = { kind: 'chunks', size: 0 };
    await expect(write(j, 'a', 'v1', 'v2')).rejects.toThrow(/no progress/);
    mode.current = { kind: 'normal' };
    expect(await readdir(join(vault, HISTORY_DIR))).not.toContain('manifest.lock');
    await write(j, 'b', 'v1', 'v2');
    expect(j.list().writes.map((w) => `${w.seq}${w.tool}`)).toEqual(['1b']);
  });

  it('fails the commit when the manifest line is torn, and the next commit still lands', async () => {
    const j = await Journal.open(vault, BIG);
    mode.current = { kind: 'tornLine' };
    await expect(write(j, 'a', 'v1', 'v2')).rejects.toThrow(/EIO/);
    mode.current = { kind: 'normal' };
    await write(j, 'b', 'v1', 'v2');
    expect(j.list().writes.map((w) => `${w.seq}${w.tool}`)).toEqual(['1b']);
    expect((await Journal.open(vault, BIG)).list().writes.map((w) => `${w.seq}${w.tool}`)).toEqual([
      '1b',
    ]);
  });

  // SHA-566 review: a process paused between creating a lock or claim file
  // and writing its token can have the empty file reclaimed by a waiter. When
  // it resumes it must neither use nor delete the file now at that path.
  const other = JSON.stringify({ pid: process.pid, host: hostname(), id: 'waiter' });

  /**
   * Start a commit that pauses (31 s of fake time) just before writing its
   * first token, while a waiter replaces the file at `path`. Resolves once
   * that happened, with the commit's promise.
   */
  async function pauseAtToken(j: Journal, path: () => string, fail = false) {
    const realNow = Date.now;
    let paused!: () => void;
    const reached = new Promise<void>((r) => {
      paused = r;
    });
    mode.current = {
      kind: 'beforeLockToken',
      fail,
      run: () => {
        vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 31_000);
        unlinkSync(path());
        writeFileSync(path(), other);
        paused();
      },
    };
    let done = false;
    const pending = write(j, 'a', 'v1', 'v2').then(
      () => {
        done = true;
      },
      (err: unknown) => {
        done = true;
        throw err;
      },
    );
    pending.catch(() => {}); // the test awaits it; don't report it unhandled meanwhile
    await reached;
    await new Promise((r) => setTimeout(r, 50)); // let it act on what it finds
    return { pending, isDone: () => done };
  }

  it('a creator paused before writing its token does not use a lock reclaimed meanwhile', async () => {
    const j = await Journal.open(vault, BIG);
    const lock = join(vault, HISTORY_DIR, 'manifest.lock');
    try {
      const { pending, isDone } = await pauseAtToken(j, () => lock);
      expect(isDone()).toBe(false);
      expect(await readFile(lock, 'utf8')).toBe(other);
      await rm(lock);
      await pending;
      expect(j.list().total).toBe(1);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('a creator whose token write fails after a long pause leaves the new lock alone', async () => {
    const j = await Journal.open(vault, BIG);
    const lock = join(vault, HISTORY_DIR, 'manifest.lock');
    try {
      const { pending } = await pauseAtToken(j, () => lock, true);
      await expect(pending).rejects.toThrow(/EIO/);
      expect(await readFile(lock, 'utf8')).toBe(other);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('a waiter paused before writing its claim does not use a claim reclaimed meanwhile', async () => {
    const j = await Journal.open(vault, BIG);
    const lock = join(vault, HISTORY_DIR, 'manifest.lock');
    const deadPid = spawnSync(process.execPath, ['-e', '']).pid;
    const dead = JSON.stringify({ pid: deadPid, host: hostname(), id: 'dead' });
    writeFileSync(lock, dead);
    const claim = `${lock}.${(inspectLock(lock) as LockSnapshot).key}.claim`;
    try {
      const { pending, isDone } = await pauseAtToken(j, () => claim);
      // The live waiter now holds the claim: the dead lock and its claim stay.
      expect(isDone()).toBe(false);
      expect(await readFile(claim, 'utf8')).toBe(other);
      expect(await readFile(lock, 'utf8')).toBe(dead);
      await rm(claim);
      await pending;
      expect(j.list().total).toBe(1);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('accepts a blob another process renamed into place first', async () => {
    const j = await Journal.open(vault, BIG);
    mode.current = { kind: 'renameClash' };
    await write(j, 'a', 'shared pre-image', 'v2');
    expect(mode.current.kind).toBe('normal'); // the clash happened
    expect(j.isUndoable(j.get(1) as JournalEntry)).toBe(true);
    expect(await j.preimage(contentHash('shared pre-image'))).toBe('shared pre-image');
    const blobs = await readdir(join(vault, HISTORY_DIR, 'blobs'));
    expect(blobs.every((n) => /^[0-9a-f]{64}$/.test(n))).toBe(true);
  });

  it('fails the write when the blob found after a failed rename has other bytes', async () => {
    const j = await Journal.open(vault, BIG);
    mode.current = { kind: 'renameClash', garbage: true };
    await expect(write(j, 'a', 'shared pre-image', 'v2')).rejects.toThrow(/EPERM/);
    expect(j.list().total).toBe(0);
  });

  // SHA-566 review: a pre-image read can fail with ENOENT after a concurrent
  // commit has already restored the blob. The cache must not forget a blob
  // that is on disk.
  it('keeps a blob in the cache when a failed read races its restore', async () => {
    const j = await Journal.open(vault, BIG);
    await write(j, 'a', 'restored pre-image', 'v2');
    const bytes = j.storedBytes;
    staleRead.next = true;
    await expect(j.preimage(contentHash('restored pre-image'))).rejects.toThrow(/ENOENT/);
    expect(j.isUndoable(j.get(1) as JournalEntry)).toBe(true);
    expect(j.storedBytes).toBe(bytes);
    expect(await j.preimage(contentHash('restored pre-image'))).toBe('restored pre-image');
  });

  // SHA-566 review: the token write fails, then the creator pauses before its
  // cleanup. A waiter reclaims the tokenless lock by age and takes a new one.
  // The creator's cleanup must not delete that new lock.
  it('cleanup after a failed token write never deletes a lock that replaced it', async () => {
    const j = await Journal.open(vault, BIG);
    const lock = join(vault, HISTORY_DIR, 'manifest.lock');
    mode.current = {
      kind: 'beforeLockToken',
      fail: true,
      run: () => {
        afterClose.run = () => {
          unlinkSync(lock);
          writeFileSync(lock, other);
        };
      },
    };
    await expect(write(j, 'a', 'v1', 'v2')).rejects.toThrow(/EIO/);
    expect(await readFile(lock, 'utf8')).toBe(other);
    expect(j.list().total).toBe(0);
  });

  it('a lock left by a failed token write on a full disk is reclaimed by age', async () => {
    const j = await Journal.open(vault, BIG);
    const lock = join(vault, HISTORY_DIR, 'manifest.lock');
    mode.current = { kind: 'tokensFail' };
    await expect(write(j, 'a', 'v1', 'v2')).rejects.toThrow(/ENOSPC/);
    mode.current = { kind: 'normal' };
    expect(await readFile(lock, 'utf8')).toBe('');
    // The cleanup's claim token couldn't be written either, so the empty lock
    // (and an empty claim) stay until LOCK_STALE_MS old; then the next commit
    // reclaims both.
    const realNow = Date.now;
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 31_000);
    try {
      await write(j, 'b', 'v1', 'v2');
      expect(j.list().writes.map((w) => `${w.seq}${w.tool}`)).toEqual(['1b']);
      expect((await readdir(join(vault, HISTORY_DIR))).sort()).toEqual(['blobs', 'manifest.jsonl']);
    } finally {
      vi.restoreAllMocks();
    }
  });
});
