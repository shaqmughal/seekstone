import { spawnSync } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contentHash } from './content-hash.js';
import { buildIndex } from './index/build.js';
import {
  HISTORY_DIR,
  inspectLock,
  Journal,
  type JournalEntry,
  journalWrite,
  type LockSnapshot,
} from './journal.js';
import { PERMISSIVE_POLICY } from './policy.js';
import { appendNote } from './tools/append_note.js';
import { undoWrite } from './tools/undo_write.js';

// SHA-566: writeSync may write fewer bytes than asked. These tests make it do
// so (or fail) and check the journal never reports a commit it didn't finish.

type Mode =
  | { kind: 'normal' }
  | { kind: 'chunks'; size: number }
  | { kind: 'tornLine' }
  | { kind: 'tornNewline' }
  | { kind: 'beforeLockToken'; run: () => void; fail?: boolean }
  | { kind: 'renameClash'; garbage?: Buffer }
  | { kind: 'tokensFail' };
const mode = vi.hoisted(() => ({ current: { kind: 'normal' } as Mode }));
/**
 * When set, runs right after the next closeSync whose fd was opened with
 * `path` and `flags` matching `when` (any close if `when` is unset). This is
 * where a test plays the other process while ours is paused.
 */
const afterClose = vi.hoisted(() => ({
  run: undefined as (() => void) | undefined,
  when: undefined as ((path: string, flags: string) => boolean) | undefined,
}));
/**
 * Scripted blob reads, one step per read: 'stale' fails with ENOENT although
 * the blob is on disk (the read lost a race with a restore); a function runs
 * first and then the read goes ahead.
 */
const staleRead = vi.hoisted(() => ({ script: [] as Array<'stale' | (() => void)> }));
/** While above zero, opening a claim file for reading fails with EACCES. */
const unreadableClaims = vi.hoisted(() => ({ left: 0 }));
/** Set when a zero-byte write was injected into a manifest append. */
const manifestZero = vi.hoisted(() => ({ armed: false, fired: false }));

vi.mock('node:fs/promises', async (importOriginal) => {
  const fsp = await importOriginal<typeof import('node:fs/promises')>();
  const readFile = ((...args: Parameters<typeof fsp.readFile>) => {
    const step = String(args[0]).includes('blobs') ? staleRead.script.shift() : undefined;
    if (step === 'stale') {
      return Promise.reject(Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' }));
    }
    step?.();
    return fsp.readFile(...args);
  }) as typeof fsp.readFile;
  return { ...fsp, readFile, default: { ...fsp, readFile } };
});

vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  const writeSync = (fd: number, data: unknown, ...rest: unknown[]): number => {
    const m = mode.current;
    const real = () => (fs.writeSync as (...a: unknown[]) => number)(fd, data, ...rest);
    if (manifestZero.armed && Buffer.isBuffer(data) && data.includes('"files"')) {
      manifestZero.armed = false;
      manifestZero.fired = true;
      return 0;
    }
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
    let pos: number | undefined;
    if (typeof data === 'string') {
      buf = Buffer.from(data, 'utf8');
      len = buf.length;
    } else {
      buf = data as Buffer;
      off = typeof rest[0] === 'number' ? rest[0] : 0;
      len = typeof rest[1] === 'number' ? rest[1] : buf.length - off;
      pos = typeof rest[2] === 'number' ? rest[2] : undefined;
    }
    if (m.kind === 'chunks') return fs.writeSync(fd, buf, off, Math.min(len, m.size), pos);
    // tornLine: a manifest line gets 7 bytes out, then the disk fails.
    // tornNewline: all of it but the final newline gets out, then it fails.
    if (!buf.includes('"files"')) return fs.writeSync(fd, buf, off, len, pos);
    if (off > 0) throw Object.assign(new Error('EIO: i/o error, write'), { code: 'EIO' });
    return fs.writeSync(fd, buf, off, m.kind === 'tornLine' ? Math.min(len, 7) : len - 1, pos);
  };
  // renameClash: another process places the same blob first, and the rename
  // onto it fails the way Windows fails it.
  const renameSync = (from: string, to: string): void => {
    const m = mode.current;
    if (m.kind === 'renameClash' && from.endsWith('.seekstone-tmp')) {
      mode.current = { kind: 'normal' };
      if (m.garbage) fs.writeFileSync(to, m.garbage);
      else fs.copyFileSync(from, to);
      throw Object.assign(new Error('EPERM: operation not permitted, rename'), { code: 'EPERM' });
    }
    fs.renameSync(from, to);
  };
  const opened = new Map<number, [string, string]>();
  const openSync = (path: string, flags: string, ...rest: unknown[]): number => {
    if (unreadableClaims.left > 0 && flags === 'r' && String(path).endsWith('.claim')) {
      unreadableClaims.left--;
      throw Object.assign(new Error('EACCES: permission denied, open'), { code: 'EACCES' });
    }
    const fd = (fs.openSync as (...a: unknown[]) => number)(path, flags, ...rest);
    opened.set(fd, [String(path), String(flags)]);
    return fd;
  };
  const closeSync = (fd: number): void => {
    const [path, flags] = opened.get(fd) ?? ['', ''];
    opened.delete(fd);
    fs.closeSync(fd);
    const { run, when } = afterClose;
    if (run && (!when || when(path, flags))) {
      afterClose.run = undefined;
      afterClose.when = undefined;
      run();
    }
  };
  return {
    ...fs,
    writeSync,
    renameSync,
    openSync,
    closeSync,
    default: { ...fs, writeSync, renameSync, openSync, closeSync },
  };
});

/** A stall of `ms`: both the wall clock and the monotonic clock move on. */
function stall(ms: number): void {
  const realNow = Date.now;
  const realPerf = performance.now.bind(performance);
  vi.spyOn(Date, 'now').mockImplementation(() => realNow() + ms);
  vi.spyOn(performance, 'now').mockImplementation(() => realPerf() + ms);
}

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
  afterClose.run = undefined;
  afterClose.when = undefined;
  staleRead.script = [];
  unreadableClaims.left = 0;
  manifestZero.armed = false;
  manifestZero.fired = false;
  vi.restoreAllMocks();
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

  it('a manifest append that makes no progress fails the commit and releases the lock', async () => {
    const j = await Journal.open(vault, BIG);
    manifestZero.armed = true;
    await expect(write(j, 'a', null, 'x')).rejects.toThrow(/no progress/);
    expect(manifestZero.fired).toBe(true);
    expect(await readdir(join(vault, HISTORY_DIR))).not.toContain('manifest.lock');
    await write(j, 'b', 'v1', 'v2');
    // SHA-662: a void row keeps the failed append's seq 1, so b takes 2.
    expect(j.list().writes.map((w) => `${w.seq}${w.tool}`)).toEqual(['2b']);
    expect(j.get(1)?.tool).toBe('void');
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
    let paused!: () => void;
    const reached = new Promise<void>((r) => {
      paused = r;
    });
    mode.current = {
      kind: 'beforeLockToken',
      fail,
      run: () => {
        stall(31_000);
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
    mode.current = { kind: 'renameClash', garbage: Buffer.from('not the pre-image') };
    await expect(write(j, 'a', 'shared pre-image', 'v2')).rejects.toThrow(/EPERM/);
    expect(j.list().total).toBe(0);
  });

  // SHA-566 review: a pre-image read can fail with ENOENT after a concurrent
  // commit has already restored the blob. The blob is on disk, so the read is
  // retried and the cache keeps it.
  it('keeps a blob in the cache when a failed read races its restore', async () => {
    const j = await Journal.open(vault, BIG);
    await write(j, 'a', 'restored pre-image', 'v2');
    const bytes = j.storedBytes;
    staleRead.script = ['stale'];
    expect(await j.preimage(contentHash('restored pre-image'))).toBe('restored pre-image');
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
        afterClose.when = (p, flags) => p === lock && flags === 'wx';
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

  // SHA-566 review: a waiter can match a stale empty lock and pause before
  // unlinking it. If the creator then publishes its token and reads it back,
  // it would run while the waiter deletes its lock and a third process enters.
  // A creator that took that long to write never uses the file.
  it('a creator that wrote its token late never uses the file', async () => {
    const j = await Journal.open(vault, BIG);
    const lock = join(vault, HISTORY_DIR, 'manifest.lock');
    let swapped!: () => void;
    const reached = new Promise<void>((r) => {
      swapped = r;
    });
    mode.current = {
      kind: 'beforeLockToken',
      run: () => {
        stall(31_000);
        // The paused waiter resumes after our next look at the lock: it
        // deletes it, and a third process takes a new one.
        afterClose.when = (p, flags) => p === lock && flags === 'r';
        afterClose.run = () => {
          unlinkSync(lock);
          writeFileSync(lock, other);
          swapped();
        };
      },
    };
    let done = false;
    const pending = write(j, 'a', 'v1', 'v2').then(() => {
      done = true;
    });
    await reached;
    await new Promise((r) => setTimeout(r, 50));
    expect(done).toBe(false);
    expect(await readFile(lock, 'utf8')).toBe(other);
    await rm(lock);
    await pending;
    expect(j.list().total).toBe(1);
    expect((await readdir(join(vault, HISTORY_DIR))).sort()).toEqual(['blobs', 'manifest.jsonl']);
  });

  // SHA-566 review: hash the bytes, not their UTF-8 decoding. An invalid byte
  // decodes to U+FFFD, so a corrupt blob could match a pre-image containing it.
  it('rejects a blob whose bytes differ even when they decode to the same text', async () => {
    const j = await Journal.open(vault, BIG);
    mode.current = { kind: 'renameClash', garbage: Buffer.from([0x61, 0xff, 0x62]) };
    await expect(write(j, 'a', 'a�b', 'v2')).rejects.toThrow(/EPERM/);
    expect(j.list().total).toBe(0);
  });

  // SHA-566 review: an append that fails on the final newline leaves a whole
  // JSON row without it. The next commit must cut it off, not complete it.
  it('cuts off a torn last line before the next append, and a restart agrees', async () => {
    const j = await Journal.open(vault, BIG);
    mode.current = { kind: 'tornNewline' };
    await expect(write(j, 'a', 'v1', 'v2')).rejects.toThrow(/EIO/);
    mode.current = { kind: 'normal' };
    await write(j, 'b', 'v1', 'v2');
    const seqs = (x: Journal) => x.list().writes.map((w) => `${w.seq}${w.tool}`);
    expect(seqs(j)).toEqual(['1b']);
    expect(seqs(await Journal.open(vault, BIG))).toEqual(['1b']);
  });

  it('cuts off a torn last line left before a restart', async () => {
    const j = await Journal.open(vault, BIG);
    await write(j, 'a', 'v1', 'v2');
    mode.current = { kind: 'tornNewline' };
    await expect(write(j, 'b', 'v2', 'v3')).rejects.toThrow(/EIO/);
    mode.current = { kind: 'normal' };
    const restarted = await Journal.open(vault, BIG); // as after a crash
    await write(restarted, 'c', 'v2', 'v3');
    const seqs = (x: Journal) => x.list().writes.map((w) => `${w.seq}${w.tool}`);
    expect(seqs(restarted)).toEqual(['2c', '1a']);
    expect(seqs(await Journal.open(vault, BIG))).toEqual(['2c', '1a']);
  });

  // SHA-566 review: deleting the lock file by hand is only safe with every
  // server stopped; the timeout error says so.
  it('the lock timeout tells the operator to stop every server first', async () => {
    const j = await Journal.open(vault, BIG);
    const lock = join(vault, HISTORY_DIR, 'manifest.lock');
    writeFileSync(lock, other); // held by a live process
    const realNow = Date.now;
    afterClose.when = (p, flags) => p === lock && flags === 'r';
    afterClose.run = () => {
      vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 61_000);
    };
    await expect(write(j, 'a', 'v1', 'v2')).rejects.toThrow(
      /timed out .*stop every seekstone server that shares this vault, then delete the file/,
    );
  });

  // SHA-566 review: undo_write must not report entry_evicted for a read that
  // only raced a restore.
  it('undo_write succeeds when its pre-image read races a restore', async () => {
    await writeFile(join(vault, 'Note.md'), 'start\n', 'utf8');
    const built = await buildIndex(vault);
    const j = await Journal.open(vault, BIG);
    const ctx = { ...built, vaultRoot: vault, policy: PERMISSIVE_POLICY, journal: j };
    await appendNote(ctx, { path: 'Note.md', content: 'more' });
    staleRead.script = ['stale'];
    expect((await undoWrite(ctx, { seq: 1 })).undoSeq).toBe(2);
    expect(await readFile(join(vault, 'Note.md'), 'utf8')).toBe('start\n');
  });

  // SHA-566 review: the create-to-write interval is measured on a monotonic
  // clock. A stall followed by a wall-clock step back must still count.
  it('a long stall counts even if the wall clock steps back meanwhile', async () => {
    const j = await Journal.open(vault, BIG);
    const lock = join(vault, HISTORY_DIR, 'manifest.lock');
    const realPerf = performance.now.bind(performance);
    let swapped!: () => void;
    const reached = new Promise<void>((r) => {
      swapped = r;
    });
    mode.current = {
      kind: 'beforeLockToken',
      run: () => {
        // 31 s pass, but the wall clock is stepped back by the same amount.
        vi.spyOn(performance, 'now').mockImplementation(() => realPerf() + 31_000);
        unlinkSync(lock);
        writeFileSync(lock, other); // a waiter reclaimed it and took its own
        swapped();
      },
    };
    let done = false;
    const pending = write(j, 'a', 'v1', 'v2').then(() => {
      done = true;
    });
    await reached;
    await new Promise((r) => setTimeout(r, 50));
    expect(done).toBe(false);
    expect(await readFile(lock, 'utf8')).toBe(other);
    await rm(lock);
    await pending;
    expect(j.list().total).toBe(1);
  });

  // SHA-566 review: a claim that exists but can't be read must not make the
  // lock loop retry at once forever; it waits and honours the deadline.
  it('an unreadable claim leads to the lock timeout, not a busy loop', async () => {
    const j = await Journal.open(vault, BIG);
    const lock = join(vault, HISTORY_DIR, 'manifest.lock');
    const deadPid = spawnSync(process.execPath, ['-e', '']).pid;
    const dead = (id: string) => JSON.stringify({ pid: deadPid, host: hostname(), id });
    writeFileSync(lock, dead('lock'));
    writeFileSync(`${lock}.${(inspectLock(lock) as LockSnapshot).key}.claim`, dead('claim'));
    unreadableClaims.left = 2000;
    const realNow = Date.now;
    afterClose.when = (p, flags) => p === lock && flags === 'r';
    afterClose.run = () => {
      vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 61_000);
    };
    await expect(write(j, 'a', 'v1', 'v2')).rejects.toThrow(/timed out/);
    expect(unreadableClaims.left).toBeGreaterThan(1990);
  });

  // SHA-566 review: a reread that also fails must still tell eviction (blob
  // gone: clear the cache) from a blob that keeps coming back (retryable).
  it('a reread that finds the blob gone clears the cache', async () => {
    const j = await Journal.open(vault, BIG);
    await write(j, 'a', 'pre-image', 'v2');
    const blob = join(vault, HISTORY_DIR, 'blobs', contentHash('pre-image'));
    staleRead.script = ['stale', () => unlinkSync(blob)];
    await expect(j.preimage(contentHash('pre-image'))).rejects.toThrow(/ENOENT/);
    expect(j.isUndoable(j.get(1) as JournalEntry)).toBe(false);
  });

  it('a blob that keeps vanishing and reappearing gives a retryable error, not eviction', async () => {
    const j = await Journal.open(vault, BIG);
    await write(j, 'a', 'pre-image', 'v2');
    staleRead.script = ['stale', 'stale', 'stale', 'stale'];
    const err = await j.preimage(contentHash('pre-image')).catch((e: unknown) => e);
    expect(String(err)).toMatch(/try again/);
    expect((err as NodeJS.ErrnoException).code).not.toBe('ENOENT');
    expect(j.isUndoable(j.get(1) as JournalEntry)).toBe(true);
  });

  // SHA-566 review: age-based recovery must work in a process that never saw
  // the failure (no record of abandoned files): it waits while the leftovers
  // are fresh and reclaims them once they are LOCK_STALE_MS old.
  it('a fresh process waits on fresh leftovers and reclaims them once old', async () => {
    const j = await Journal.open(vault, BIG);
    mode.current = { kind: 'tokensFail' };
    await expect(write(j, 'a', 'v1', 'v2')).rejects.toThrow(/ENOSPC/);
    mode.current = { kind: 'normal' };
    vi.resetModules(); // a new module instance: nothing recorded as abandoned
    const fresh = await import('./journal.js');
    const other2 = await fresh.Journal.open(vault, BIG);
    let done = false;
    const pending = fresh.journalWrite({ journal: other2 }, 'b', 'b.md', 'w1', 'w2').then(() => {
      done = true;
    });
    // Proof it got as far as the lock: its pre-image is stored.
    const blob = join(vault, HISTORY_DIR, 'blobs', contentHash('w1'));
    while (!(await readFile(blob).catch(() => undefined))) {
      await new Promise((r) => setTimeout(r, 5));
    }
    await new Promise((r) => setTimeout(r, 50));
    expect(done).toBe(false);
    const realNow = Date.now;
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 31_000);
    await pending;
    expect(other2.list().writes.map((w) => `${w.seq}${w.tool}`)).toEqual(['1b']);
    expect((await readdir(join(vault, HISTORY_DIR))).sort()).toEqual(['blobs', 'manifest.jsonl']);
  });
});
