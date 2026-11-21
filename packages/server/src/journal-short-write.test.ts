import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HISTORY_DIR, Journal, journalWrite } from './journal.js';

// SHA-566: writeSync may write fewer bytes than asked. These tests make it do
// so (or fail) and check the journal never reports a commit it didn't finish.

type Mode = { kind: 'normal' } | { kind: 'chunks'; size: number } | { kind: 'tornLine' };
const mode = vi.hoisted(() => ({ current: { kind: 'normal' } as Mode }));

vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  const writeSync = (fd: number, data: unknown, ...rest: unknown[]): number => {
    const m = mode.current;
    if (m.kind === 'normal')
      return (fs.writeSync as (...a: unknown[]) => number)(fd, data, ...rest);
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
  return { ...fs, writeSync, default: { ...fs, writeSync } };
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
});
