import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
