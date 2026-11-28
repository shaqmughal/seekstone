import { mkdir, mkdtemp, open, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';
import { classify, walkVault } from '@seekstone/core/walk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { atomicWrite, renameWithRetry } from './atomic-write.js';

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'seekstone-atomic-write-'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('atomicWrite', () => {
  it('creates a new file with the exact content', async () => {
    const p = join(dir, 'new.md');
    await atomicWrite(p, '# New\ncontent — exact\n');
    expect(await readFile(p, 'utf8')).toBe('# New\ncontent — exact\n');
  });

  it('replaces an existing file', async () => {
    const p = join(dir, 'existing.md');
    await writeFile(p, 'old', 'utf8');
    await atomicWrite(p, 'replacement');
    expect(await readFile(p, 'utf8')).toBe('replacement');
  });

  it('leaves no temp file behind on success', async () => {
    await atomicWrite(join(dir, 'clean.md'), 'x');
    const entries = await readdir(dir);
    expect(entries.some((e) => e.includes('.seekstone-tmp'))).toBe(false);
  });

  it('removes the temp file when the write finally fails', async () => {
    // Renaming a file over a non-empty directory fails on every platform.
    const sub = await mkdtemp(join(dir, 'blocked-'));
    const target = join(sub, 'occupied');
    await mkdir(target);
    await writeFile(join(target, 'keep.md'), 'x', 'utf8');
    await expect(atomicWrite(target, 'new')).rejects.toThrow();
    expect((await readdir(sub)).some((e) => e.includes('.seekstone-tmp'))).toBe(false);
  });

  /** Real `open`, with every handle call and the rename recorded in order. */
  function traced() {
    const events: string[] = [];
    const openFn = async (path: string, flags: string) => {
      const fh = await open(path, flags);
      events.push(`open ${flags}`);
      return new Proxy(fh, {
        get(target, prop, receiver) {
          const value = Reflect.get(target, prop, receiver);
          if (typeof value !== 'function') return value;
          return (...args: unknown[]) => {
            events.push(String(prop));
            return value.apply(target, args);
          };
        },
      });
    };
    const renameFn = async (from: string, to: string) => {
      events.push('rename');
      await rename(from, to);
    };
    return { events, openFn, renameFn };
  }

  it('syncs the temp file to disk before renaming it over the note (SHA-561)', async () => {
    const p = join(dir, 'synced.md');
    await writeFile(p, 'old', 'utf8');
    const { events, openFn, renameFn } = traced();
    await atomicWrite(p, 'durable', { openFn, renameFn });
    expect(events).toEqual(['open wx', 'writeFile', 'sync', 'close', 'rename']);
    expect(await readFile(p, 'utf8')).toBe('durable');
  });

  it('keeps the old note and removes the temp file when the sync fails', async () => {
    const sub = await mkdtemp(join(dir, 'sync-fail-'));
    const p = join(sub, 'note.md');
    await writeFile(p, 'old', 'utf8');
    const openFn = async (path: string, flags: string) => {
      const fh = await open(path, flags);
      return Object.assign(fh, {
        sync: async () => {
          throw Object.assign(new Error('EIO'), { code: 'EIO' });
        },
      });
    };
    await expect(atomicWrite(p, 'new', { openFn })).rejects.toThrow('EIO');
    expect(await readFile(p, 'utf8')).toBe('old');
    expect(await readdir(sub)).toEqual(['note.md']);
  });
});

describe('atomicWrite folder fsync (SHA-652)', () => {
  const FAKE_FD = 9_999;

  /** Fake folder open/fsync/close on `platform`, recorded after a real, recorded rename. */
  function tracedDirSync(platform: NodeJS.Platform, fsyncError?: string) {
    const events: string[] = [];
    const renameFn = async (from: string, to: string) => {
      await rename(from, to);
      events.push('rename');
    };
    const dirSync = {
      platform,
      openSync: (path: string, flags: string) => {
        events.push(`open ${path} ${flags}`);
        return FAKE_FD;
      },
      fsyncSync: (fd: number) => {
        events.push(`fsync ${fd}`);
        if (fsyncError) throw Object.assign(new Error(fsyncError), { code: fsyncError });
      },
      closeSync: (fd: number) => {
        events.push(`close ${fd}`);
      },
    };
    return { events, renameFn, dirSync };
  }

  for (const platform of ['linux', 'darwin', 'win32'] as const) {
    it(`fsyncs the note's folder read-only after the rename, except on win32: ${platform}`, async () => {
      const sub = await mkdtemp(join(dir, `dirsync-${platform}-`));
      const p = join(sub, 'note.md');
      const { events, renameFn, dirSync } = tracedDirSync(platform);
      await atomicWrite(p, 'new', { renameFn, dirSync });
      const synced = ['rename', `open ${sub} r`, `fsync ${FAKE_FD}`, `close ${FAKE_FD}`];
      expect(events).toEqual(platform === 'win32' ? ['rename'] : synced);
      expect(await readFile(p, 'utf8')).toBe('new');
    });
  }

  it('still succeeds when the folder fsync fails, and closes the folder', async () => {
    const sub = await mkdtemp(join(dir, 'dirsync-einval-'));
    const p = join(sub, 'note.md');
    const { events, renameFn, dirSync } = tracedDirSync('linux', 'EINVAL');
    await atomicWrite(p, 'new', { renameFn, dirSync });
    expect(await readFile(p, 'utf8')).toBe('new');
    expect(events).toEqual(['rename', `open ${sub} r`, `fsync ${FAKE_FD}`, `close ${FAKE_FD}`]);
  });
});

describe('atomicWrite temp files (SHA-567)', () => {
  const fsError = (code: string) => Object.assign(new Error(code), { code });

  /** Real `open` that records every temp path atomicWrite asks for. */
  function recordingOpen() {
    const paths: string[] = [];
    const openFn = async (path: string, flags: string) => {
      paths.push(path);
      return open(path, flags);
    };
    return { paths, openFn };
  }

  it('a failed open never removes a file this call did not create', async () => {
    const sub = await mkdtemp(join(dir, 'open-fail-'));
    const p = join(sub, 'note.md');
    await writeFile(p, 'old', 'utf8');
    // Someone else's file sits at the temp path when our open fails.
    let tmp = '';
    const openFn = async (path: string) => {
      tmp = path;
      await writeFile(path, 'not ours', 'utf8');
      throw fsError('EACCES');
    };
    await expect(atomicWrite(p, 'new', { openFn })).rejects.toThrow('EACCES');
    expect(await readFile(tmp, 'utf8')).toBe('not ours');
    expect(await readFile(p, 'utf8')).toBe('old');
  });

  it("a writer whose open fails leaves a concurrent writer's temp file alone", async () => {
    const sub = await mkdtemp(join(dir, 'overlap-'));
    const p = join(sub, 'note.md');
    await writeFile(p, 'old', 'utf8');

    // Writer A opens its temp file, then pauses before writing until B is done.
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    let opened!: () => void;
    const aOpened = new Promise<void>((r) => {
      opened = r;
    });
    const openA = async (path: string, flags: string) => {
      const fh = await open(path, flags);
      opened();
      await gate;
      return fh;
    };
    const a = atomicWrite(p, 'from A', { openFn: openA });
    await aOpened;

    // Writer B fails to open (disk full, permissions, a lock).
    const openB = async () => {
      throw fsError('ENOSPC');
    };
    await expect(atomicWrite(p, 'from B', { openFn: openB })).rejects.toThrow('ENOSPC');

    release();
    await a;
    expect(await readFile(p, 'utf8')).toBe('from A');
    expect(await readdir(sub)).toEqual(['note.md']);
  });

  it('concurrent writes to one note all succeed and leave no temp files', async () => {
    const sub = await mkdtemp(join(dir, 'concurrent-'));
    const p = join(sub, 'note.md');
    await writeFile(p, 'old', 'utf8');
    const contents = Array.from({ length: 16 }, (_, i) => `version ${i}\n`);
    await Promise.all(contents.map((c) => atomicWrite(p, c)));
    expect(contents).toContain(await readFile(p, 'utf8'));
    expect(await readdir(sub)).toEqual(['note.md']);
  });

  it("uses a different temp file for every call, in the note's own directory", async () => {
    const p = join(dir, 'unique.md');
    const { paths, openFn } = recordingOpen();
    await atomicWrite(p, 'one', { openFn });
    await atomicWrite(p, 'two', { openFn });
    expect(paths).toHaveLength(2);
    expect(paths[0]).not.toBe(paths[1]);
    for (const tmp of paths) expect(dirname(tmp)).toBe(dirname(p));
  });

  it('opens the temp file exclusively, so it never writes into an existing file', async () => {
    const { paths, openFn } = recordingOpen();
    const flags: string[] = [];
    await atomicWrite(join(dir, 'exclusive.md'), 'x', {
      openFn: (path, flag) => {
        flags.push(flag);
        return openFn(path, flag);
      },
    });
    expect(paths).toHaveLength(1);
    expect(flags).toEqual(['wx']);
  });

  it('names a leftover temp file so the index, the watcher and Obsidian skip it', async () => {
    // A crash between open and rename leaves the temp file behind. Simulate it.
    const vault = await mkdtemp(join(dir, 'crash-'));
    await mkdir(join(vault, 'Projects'));
    const p = join(vault, 'Projects', 'plan.md');
    let tmp = '';
    // Copy the temp file aside, then fail the rename so atomicWrite cleans up.
    const renameFn = async (from: string) => {
      tmp = from;
      await writeFile(`${from}.kept`, await readFile(from));
      throw fsError('EIO');
    };
    await expect(atomicWrite(p, '# Plan\n', { renameFn })).rejects.toThrow('EIO');
    await rename(`${tmp}.kept`, tmp);

    const name = basename(tmp);
    // Obsidian and the watcher skip every dot-prefixed name.
    expect(name.startsWith('.')).toBe(true);
    expect(name.endsWith('.seekstone-tmp')).toBe(true);
    // The index walk sees it but never treats it as a note.
    const rel = relative(vault, tmp).split('\\').join('/');
    expect(classify(rel)).not.toBe('note');
    const notes = (await walkVault(vault)).filter((e) => e.kind === 'note');
    expect(notes).toEqual([]);
  });

  it('keeps the temp file name within the 255-byte limit for a long note name', async () => {
    const sub = await mkdtemp(join(dir, 'long-'));
    // 250 bytes: fits as a note name, but not with a suffix appended.
    const p = join(sub, `${'é'.repeat(100)}${'a'.repeat(47)}.md`);
    expect(Buffer.byteLength(basename(p))).toBe(250);
    const { paths, openFn } = recordingOpen();
    await atomicWrite(p, 'long', { openFn });
    expect(await readFile(p, 'utf8')).toBe('long');
    expect(Buffer.byteLength(basename(paths[0] ?? ''))).toBeLessThanOrEqual(255);
    expect(await readdir(sub)).toEqual([basename(p)]);
  });
});

describe('renameWithRetry (SHA-531)', () => {
  const locked = (code: string) => Object.assign(new Error(code), { code });

  /** A rename that fails with `code` for the first `n` calls, then succeeds. */
  function flaky(n: number, code = 'EPERM') {
    const calls: string[] = [];
    const renameFn = async (from: string, to: string) => {
      calls.push(`${from}->${to}`);
      if (calls.length <= n) throw locked(code);
    };
    return { calls, renameFn };
  }

  const slept: number[] = [];
  const sleep = async (ms: number) => {
    slept.push(ms);
  };

  it('renames once with no delay when nothing is locked', async () => {
    slept.length = 0;
    const { calls, renameFn } = flaky(0);
    await renameWithRetry('a', 'b', { platform: 'win32', renameFn, sleep });
    expect(calls).toHaveLength(1);
    expect(slept).toEqual([]);
  });

  it.each(['EPERM', 'EACCES', 'EBUSY'])('retries a transient %s on Windows', async (code) => {
    slept.length = 0;
    const { calls, renameFn } = flaky(3, code);
    await renameWithRetry('a', 'b', { platform: 'win32', renameFn, sleep });
    expect(calls).toHaveLength(4);
    expect(slept).toEqual([10, 20, 40]);
  });

  it('gives up after the backoff runs out and throws the original error', async () => {
    slept.length = 0;
    const { calls, renameFn } = flaky(Number.POSITIVE_INFINITY);
    await expect(renameWithRetry('a', 'b', { platform: 'win32', renameFn, sleep })).rejects.toThrow(
      'EPERM',
    );
    expect(calls).toHaveLength(8);
    expect(slept.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(1300);
  });

  it('waits with real timers by default', async () => {
    const { calls, renameFn } = flaky(1);
    const t0 = Date.now();
    await renameWithRetry('a', 'b', { platform: 'win32', renameFn });
    expect(calls).toHaveLength(2);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(5);
  });

  it('never retries an unrelated error code', async () => {
    slept.length = 0;
    const { calls, renameFn } = flaky(1, 'ENOENT');
    await expect(renameWithRetry('a', 'b', { platform: 'win32', renameFn, sleep })).rejects.toThrow(
      'ENOENT',
    );
    expect(calls).toHaveLength(1);
  });

  it('never retries off Windows', async () => {
    const { calls, renameFn } = flaky(1, 'EPERM');
    for (const platform of ['linux', 'darwin'] as const) {
      calls.length = 0;
      await expect(renameWithRetry('a', 'b', { platform, renameFn, sleep })).rejects.toThrow();
      expect(calls).toHaveLength(1);
    }
  });
});
