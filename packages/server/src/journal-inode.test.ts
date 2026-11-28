import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Journal, journalWrite } from './journal.js';

// SHA-686: on Windows an NTFS file id exceeds 2^53, so as a JavaScript number
// two different files can have the same `ino`. Simulated here on any platform:
// a number-mode stat of the manifest always reports the same rounded id past
// 2^53, as NTFS ids do, while a bigint-mode stat reports the real one.
const LOSSY_INO = 2 ** 60;
const isManifest = (p: unknown) => String(p).endsWith('manifest.jsonl');
const lossy = <T extends { ino: number | bigint }>(st: T, bigint: boolean): T =>
  bigint ? st : Object.assign(Object.create(Object.getPrototypeOf(st)), st, { ino: LOSSY_INO });

vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  const statSync = ((path: string, opts?: { bigint?: boolean }) => {
    const st = (fs.statSync as (...a: unknown[]) => import('node:fs').Stats | undefined)(
      path,
      opts,
    );
    return st && isManifest(path) ? lossy(st, opts?.bigint === true) : st;
  }) as typeof fs.statSync;
  return { ...fs, statSync, default: { ...fs, statSync } };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const fsp = await importOriginal<typeof import('node:fs/promises')>();
  const open = (async (...args: Parameters<typeof fsp.open>) => {
    const fh = await fsp.open(...args);
    if (!isManifest(args[0])) return fh;
    const stat = fh.stat.bind(fh);
    fh.stat = (async (opts?: { bigint?: boolean }) =>
      lossy(await stat(opts as never), opts?.bigint === true)) as typeof fh.stat;
    return fh;
  }) as typeof fsp.open;
  return { ...fsp, open, default: { ...fsp, open } };
});

let vault: string;
beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'seekstone-journal-inode-'));
});
afterEach(async () => {
  await rm(vault, { recursive: true, force: true });
});

describe('Journal: another process compacts the manifest to the same size', () => {
  it('is seen even when the inode as a number is the same', async () => {
    const a = await Journal.open(vault, { maxBytes: 1e9, maxEntries: 1e6 });
    for (const n of [1, 2, 3])
      await journalWrite({ journal: a }, `w${n}`, `n${n}.md`, `p${n}`, 'x');
    // b keeps 3 rows: its seq 4 drops seq 1, and every row has the same
    // length, so the rewritten manifest is exactly as long as a's.
    const b = await Journal.open(vault, { maxBytes: 1e9, maxEntries: 3 });
    await journalWrite({ journal: b }, 'w4', 'n4.md', 'p4', 'x');

    expect(await a.refresh()).toBe(true);
    expect(a.list().writes.map((w) => w.seq)).toEqual([4, 3, 2]);
    await journalWrite({ journal: a }, 'w5', 'n5.md', 'p5', 'x');
    expect(a.lastSeq).toBe(5);

    const reopened = await Journal.open(vault, { maxBytes: 1e9, maxEntries: 1e6 });
    expect(reopened.list().writes.map((w) => w.seq)).toEqual([5, 4, 3, 2]);
  });
});
