import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HISTORY_DIR, Journal, journalWrite } from './journal.js';

// SHA-650: a journal call that fails must not leave a row that loads as
// committed, and a failed compaction must not fail the write.

/** One-shot failures, armed by a test and cleared when they fire. */
const fail = vi.hoisted(() => ({ manifestFsync: false, manifestRename: false, truncate: false }));

vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  const manifestFds = new Set<number>();
  const openSync = (path: string, flags: string, ...rest: unknown[]): number => {
    const fd = (fs.openSync as (...a: unknown[]) => number)(path, flags, ...rest);
    if (String(path).endsWith('manifest.jsonl') && flags === 'a') manifestFds.add(fd);
    return fd;
  };
  const closeSync = (fd: number): void => {
    manifestFds.delete(fd);
    fs.closeSync(fd);
  };
  // The row is written in full; only the fsync after it fails.
  const fsyncSync = (fd: number): void => {
    if (fail.manifestFsync && manifestFds.has(fd)) {
      fail.manifestFsync = false;
      throw Object.assign(new Error('EIO: i/o error, fsync'), { code: 'EIO' });
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
  const truncateSync = (path: string, len?: number): void => {
    if (fail.truncate) {
      fail.truncate = false;
      throw Object.assign(new Error('EIO: i/o error, truncate'), { code: 'EIO' });
    }
    fs.truncateSync(path, len);
  };
  const mocked = { openSync, closeSync, fsyncSync, renameSync, truncateSync };
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
  fail.manifestRename = false;
  fail.truncate = false;
  await rm(vault, { recursive: true, force: true });
});

describe('Journal: a failed append', () => {
  it('leaves no row when the fsync after the append fails', async () => {
    const j = await Journal.open(vault, BIG, { log });
    await write(j, 'a');
    fail.manifestFsync = true;
    await expect(write(j, 'b')).rejects.toThrow(/EIO/);
    expect(fail.manifestFsync).toBe(false);
    expect(await manifestRows()).toEqual(['a']);
    expect(tools(await Journal.open(vault, BIG))).toEqual(['1a']);
    // The running journal carries on at the next seq.
    await write(j, 'c');
    expect(tools(j)).toEqual(['2c', '1a']);
    expect(tools(await Journal.open(vault, BIG))).toEqual(['2c', '1a']);
  });

  it('leaves no row when the first append to a new manifest fails', async () => {
    const j = await Journal.open(vault, BIG, { log });
    fail.manifestFsync = true;
    await expect(write(j, 'a')).rejects.toThrow(/EIO/);
    expect(await manifestRows()).toEqual([]);
    expect(tools(await Journal.open(vault, BIG))).toEqual([]);
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
