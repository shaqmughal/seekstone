import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HISTORY_DIR, Journal, journalWrite } from './journal.js';

// SHA-650: a journal call that fails must not leave a row that loads as
// committed, and a failed compaction must not fail the write.

/** One-shot failures, armed by a test and cleared when they fire. */
const fail = vi.hoisted(() => ({ manifestFsync: false, manifestRename: false, truncate: false }));
/** The manifest as it was when the failing fsync ran: the row is on disk. */
const seen = vi.hoisted(() => ({ manifest: '' }));

vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  const manifestFds = new Map<number, string>();
  const openSync = (path: string, flags: string, ...rest: unknown[]): number => {
    const fd = (fs.openSync as (...a: unknown[]) => number)(path, flags, ...rest);
    if (String(path).endsWith('manifest.jsonl') && flags === 'a') manifestFds.set(fd, path);
    return fd;
  };
  const closeSync = (fd: number): void => {
    manifestFds.delete(fd);
    fs.closeSync(fd);
  };
  // The row is written in full; only the fsync after it fails.
  const fsyncSync = (fd: number): void => {
    const path = manifestFds.get(fd);
    if (fail.manifestFsync && path !== undefined) {
      fail.manifestFsync = false;
      seen.manifest = fs.readFileSync(path, 'utf8');
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

describe('Journal: another process saw the rolled-back row', () => {
  const CAP = { maxBytes: 1e9, maxEntries: 2 };
  const manifest = () => join(vault, HISTORY_DIR, 'manifest.jsonl');

  /**
   * A appends row b and its fsync fails. B refreshes while b is on disk
   * (replayed here in place, same inode), then A rolls b back. Returns B,
   * which has b cached.
   */
  async function staleAfterRollback(config: typeof CAP) {
    const a = await Journal.open(vault, config, { log });
    const b = await Journal.open(vault, config, { log });
    await write(a, 'a');
    fail.manifestFsync = true;
    await expect(write(a, 'b')).rejects.toThrow(/EIO/);
    const rolledBack = await readFile(manifest(), 'utf8');
    await writeFile(manifest(), seen.manifest);
    await b.refresh();
    expect(tools(b)).toEqual(['2b', '1a']);
    await writeFile(manifest(), rolledBack);
    return { a, b };
  }

  it('a locked commit notices a same-length row in place of the cached one', async () => {
    const { a, b } = await staleAfterRollback(CAP);
    // Same length as b, and the same seq: B's size check can't tell them apart.
    await write(a, 'c');
    await write(b, 'd');
    expect(await manifestRows()).toEqual(['c', 'd']);
    expect(tools(b)).toEqual(tools(await Journal.open(vault, CAP)));
    expect(tools(b).map((t) => t.slice(-1))).toEqual(['d', 'c']);
  });

  it('a refresh rereads from the start when the cached last row changed', async () => {
    const { a, b } = await staleAfterRollback({ maxBytes: 1e9, maxEntries: 100 });
    // Longer than b: a reread from B's old offset would start mid-row.
    await write(a, 'longer-c');
    await b.refresh();
    expect(tools(b)).toEqual(['2longer-c', '1a']);
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
