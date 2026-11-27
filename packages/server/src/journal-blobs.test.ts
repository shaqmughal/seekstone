import { mkdtemp, readFile, rm, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contentHash } from './content-hash.js';
import { buildIndex } from './index/build.js';
import { HISTORY_DIR, Journal, type JournalEntry, journalWrite } from './journal.js';
import { PERMISSIVE_POLICY } from './policy.js';
import { appendNote } from './tools/append_note.js';
import { undoWrite } from './tools/undo_write.js';

// SHA-651: a damaged pre-image blob must not be reused, and a failed scan for
// evicted blobs must run again on the next refresh.

/** One-shot failure, armed by a test and cleared when it fires. */
const fail = vi.hoisted(() => ({
  blobScan: false,
  blobStat: false as boolean | string, // true: the next blob; a hash: that blob
  blobStats: 0,
  blobRename: '' as '' | 'placed' | 'refused',
  append: false, // the next manifest append fails
}));

vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  const readdirSync = ((path: string, ...rest: unknown[]) => {
    if (fail.blobScan && String(path).endsWith('blobs')) {
      fail.blobScan = false;
      throw Object.assign(new Error('EIO: i/o error, scandir'), { code: 'EIO' });
    }
    return (fs.readdirSync as (...a: unknown[]) => unknown)(path, ...rest);
  }) as typeof fs.readdirSync;
  // A rename onto a blob that Windows refuses: either another process's rename
  // placed the same blob at that moment ('placed'), or nothing did ('refused').
  const renameSync = ((from: string, to: string) => {
    const mode = fail.blobRename;
    if (mode !== '' && /[\\/]blobs[\\/][0-9a-f]{64}$/.test(String(to))) {
      fail.blobRename = '';
      if (mode === 'placed') fs.renameSync(from, to);
      throw Object.assign(new Error('EPERM: operation not permitted, rename'), { code: 'EPERM' });
    }
    fs.renameSync(from, to);
  }) as typeof fs.renameSync;
  // A stat of a blob that fails with something other than ENOENT.
  const statSync = ((path: string, ...rest: unknown[]) => {
    const isBlob = /[\\/]blobs[\\/][0-9a-f]{64}$/.test(String(path));
    if (isBlob) fail.blobStats++;
    if (
      isBlob &&
      (fail.blobStat === true || (fail.blobStat && String(path).endsWith(fail.blobStat)))
    ) {
      fail.blobStat = false;
      throw Object.assign(new Error('EIO: i/o error, stat'), { code: 'EIO' });
    }
    return (fs.statSync as (...a: unknown[]) => unknown)(path, ...rest);
  }) as typeof fs.statSync;
  const openSync = ((path: string, flags: unknown, ...rest: unknown[]) => {
    if (fail.append && flags === 'a' && String(path).endsWith('manifest.jsonl')) {
      fail.append = false;
      throw Object.assign(new Error('ENOSPC: no space left on device, open'), { code: 'ENOSPC' });
    }
    return (fs.openSync as (...a: unknown[]) => number)(path, flags, ...rest);
  }) as typeof fs.openSync;
  return {
    ...fs,
    readdirSync,
    renameSync,
    statSync,
    openSync,
    default: { ...fs, readdirSync, renameSync, statSync, openSync },
  };
});

let vault: string;
const BIG = { maxBytes: 1e9, maxEntries: 1e6 };
const blob = (content: string) => join(vault, HISTORY_DIR, 'blobs', contentHash(content));

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'seekstone-journal-blobs-'));
});
afterEach(async () => {
  fail.blobScan = false;
  fail.blobStat = false;
  fail.blobRename = '';
  fail.append = false;
  await rm(vault, { recursive: true, force: true });
});

describe('Journal: a damaged pre-image blob', () => {
  it('is rewritten when a later write has the same pre-image, so that write can be undone', async () => {
    await writeFile(join(vault, 'Note.md'), 'start\n', 'utf8');
    const ctx = {
      ...(await buildIndex(vault)),
      vaultRoot: vault,
      policy: PERMISSIVE_POLICY,
      journal: await Journal.open(vault, BIG),
    };
    await appendNote(ctx, { path: 'Note.md', content: 'one' }); // seq 1, pre-image 'start\n'
    await undoWrite(ctx, { seq: 1 }); // seq 2: the note is 'start\n' again
    expect(await readFile(join(vault, 'Note.md'), 'utf8')).toBe('start\n');

    await truncate(blob('start\n'), 2); // damaged outside Seekstone
    await appendNote(ctx, { path: 'Note.md', content: 'two' }); // seq 3, same pre-image
    expect(await readFile(blob('start\n'), 'utf8')).toBe('start\n');

    await undoWrite(ctx, { seq: 3 });
    expect(await readFile(join(vault, 'Note.md'), 'utf8')).toBe('start\n');
  });

  it('keeps the size count right after the rewrite', async () => {
    const j = await Journal.open(vault, BIG);
    await journalWrite({ journal: j }, 'a', 'a.md', 'shared', 'x');
    await truncate(blob('shared'), 2);
    const reopened = await Journal.open(vault, BIG);
    expect(reopened.storedBytes).toBe(2);
    await journalWrite({ journal: reopened }, 'b', 'b.md', 'shared', 'y');
    expect(reopened.storedBytes).toBe(6);
    expect(await reopened.preimage(contentHash('shared'))).toBe('shared');
  });

  it('repaired by another process updates the size this process counts', async () => {
    const first = await Journal.open(vault, BIG);
    await journalWrite({ journal: first }, 'a', 'a.md', 'shared', 'x'); // seq 1
    await writeFile(blob('shared'), 'x'.repeat(100)); // damaged: 100 bytes
    const cap = { maxBytes: 20, maxEntries: 1e6 };
    const a = await Journal.open(vault, cap);
    expect(a.storedBytes).toBe(100);
    const b = await Journal.open(vault, cap);
    await journalWrite({ journal: b }, 'b', 'b.md', 'shared', 'y'); // seq 2 repairs it
    expect(await readFile(blob('shared'), 'utf8')).toBe('shared');

    expect(await a.refresh()).toBe(true);
    expect(a.storedBytes).toBe(6);
    // 6 + 7 bytes fit the 20-byte cap, so nothing may be evicted.
    await journalWrite({ journal: a }, 'c', 'c.md', 'other12', 'z'); // seq 3
    expect(a.storedBytes).toBe(13);
    expect(await readFile(blob('shared'), 'utf8')).toBe('shared');
    expect(a.isUndoable(a.get(1) as JournalEntry)).toBe(true);
  });

  it('is kept when another process places the same blob while the rewrite renames', async () => {
    const j = await Journal.open(vault, BIG);
    await journalWrite({ journal: j }, 'a', 'a.md', 'shared', 'x');
    await truncate(blob('shared'), 2);
    fail.blobRename = 'placed';
    await journalWrite({ journal: j }, 'b', 'b.md', 'shared', 'y');
    expect(fail.blobRename).toBe('');
    expect(await j.preimage(contentHash('shared'))).toBe('shared');
    expect(j.storedBytes).toBe(6);
  });

  it('fails the write when the rewrite fails and the blob is still damaged', async () => {
    const j = await Journal.open(vault, BIG);
    await journalWrite({ journal: j }, 'a', 'a.md', 'shared', 'x');
    await truncate(blob('shared'), 2);
    fail.blobRename = 'refused';
    await expect(journalWrite({ journal: j }, 'b', 'b.md', 'shared', 'y')).rejects.toThrow(/EPERM/);
    expect(j.lastSeq).toBe(1);
  });
});

describe('Journal: a failed blob scan', () => {
  it('runs again on the next refresh even when the manifest has not changed', async () => {
    const a = await Journal.open(vault, BIG);
    await journalWrite({ journal: a }, 'a', 'a.md', 'shared', 'x'); // seq 1: a caches the blob
    // Another process with a small cap commits and evicts seq 1's blob.
    const b = await Journal.open(vault, { maxBytes: 10, maxEntries: 1e6 });
    await journalWrite({ journal: b }, 'b', 'b.md', 'other12', 'z');
    await expect(readFile(blob('shared'))).rejects.toThrow(/ENOENT/);

    fail.blobScan = true;
    await expect(a.refresh()).rejects.toThrow(/EIO/);
    expect(fail.blobScan).toBe(false);
    expect(a.isUndoable(a.get(1) as JournalEntry)).toBe(true); // still cached

    expect(await a.refresh()).toBe(true);
    expect(a.isUndoable(a.get(1) as JournalEntry)).toBe(false);
    expect(a.list().writes.find((w) => w.seq === 1)?.undoable).toBe(false);
    expect(a.storedBytes).toBe(7);
    // With the scan done, a refresh with nothing new is a no-op again.
    expect(await a.refresh()).toBe(false);
  });
});

describe('Journal: a failed stat of a cached blob while reading new rows', () => {
  it('neither fails the refresh nor lets the next commit reuse a seq', async () => {
    const a = await Journal.open(vault, BIG);
    await journalWrite({ journal: a }, 'a', 'a.md', 'shared', 'x'); // seq 1: a caches the blob
    const b = await Journal.open(vault, BIG);
    await journalWrite({ journal: b }, 'b', 'b.md', 'shared', 'y'); // seq 2, same blob

    fail.blobStat = true;
    await journalWrite({ journal: a }, 'c', 'c.md', 'third', 'z'); // reads seq 2 first
    expect(fail.blobStat).toBe(false);
    expect(a.lastSeq).toBe(3);

    const reopened = await Journal.open(vault, BIG);
    expect(reopened.list().writes.map((w) => w.seq)).toEqual([3, 2, 1]);
  });
});

describe('Journal: rereading the manifest after another process compacts', () => {
  it('stats only the blobs of rows that are new to this process', async () => {
    const a = await Journal.open(vault, BIG);
    for (const n of [1, 2, 3])
      await journalWrite({ journal: a }, `w${n}`, `n${n}.md`, `pre${n}`, 'x');
    // b keeps 3 rows, so its commit drops the oldest and rewrites the manifest.
    const b = await Journal.open(vault, { maxBytes: 1e9, maxEntries: 3 });
    await journalWrite({ journal: b }, 'w4', 'n4.md', 'pre4', 'x');

    fail.blobStats = 0;
    expect(await a.refresh()).toBe(true);
    expect(fail.blobStats).toBe(1); // seq 4's blob, not again for seqs 2 and 3
    expect(a.list().writes.map((w) => w.seq)).toEqual([4, 3, 2]);
  });
});

describe('Journal: byte-cap eviction counts real sizes', () => {
  // a caches a damaged 100-byte copy of 'shared'; on disk it is 6 bytes again.
  // With a 20-byte cap, a's next 7-byte pre-image makes its count 107 if it
  // trusts the old size, and eviction would delete the repaired blob.
  async function damagedThenRepaired(): Promise<Journal> {
    const first = await Journal.open(vault, BIG);
    await journalWrite({ journal: first }, 'a', 'a.md', 'shared', 'x'); // seq 1
    await writeFile(blob('shared'), 'x'.repeat(100));
    const a = await Journal.open(vault, { maxBytes: 20, maxEntries: 1e6 });
    expect(a.storedBytes).toBe(100);
    return a;
  }

  it('after a stat failed while reading a repair by another process', async () => {
    const a = await damagedThenRepaired();
    const b = await Journal.open(vault, BIG);
    await journalWrite({ journal: b }, 'b', 'b.md', 'shared', 'y'); // seq 2 repairs it
    fail.blobStat = true;
    expect(await a.refresh()).toBe(true);
    expect(a.storedBytes).toBe(100); // the stat failed, so the old size stayed

    await journalWrite({ journal: a }, 'c', 'c.md', 'other12', 'z');
    expect(await readFile(blob('shared'), 'utf8')).toBe('shared');
    expect(a.storedBytes).toBe(13);
    expect(a.isUndoable(a.get(1) as JournalEntry)).toBe(true);
  });

  it('after a reread kept a cached size that a rolled-back repair made stale', async () => {
    const first = await Journal.open(vault, BIG);
    await journalWrite({ journal: first }, 'f', 'f.md', 'f1', 'x'); // seq 1, a filler
    await journalWrite({ journal: first }, 'a', 'a.md', 'shared', 'x'); // seq 2
    await writeFile(blob('shared'), 'x'.repeat(100));
    const a = await Journal.open(vault, { maxBytes: 20, maxEntries: 1e6 });
    expect(a.storedBytes).toBe(102);
    // What a rolled-back commit leaves: the blob rewritten, no row for it.
    await writeFile(blob('shared'), 'shared');
    // Another process keeps 2 rows: it drops seq 1 and rewrites the manifest,
    // so a rereads seq 2 and keeps its cached 100 bytes for 'shared'.
    const b = await Journal.open(vault, { maxBytes: 1e9, maxEntries: 2 });
    await journalWrite({ journal: b }, 'b', 'b.md', 'u', 'y'); // seq 3
    expect(await a.refresh()).toBe(true);

    // On disk: 6 + 1 + 3 bytes, under the cap. Trusting 100 would evict seq 2.
    await journalWrite({ journal: a }, 'c', 'c.md', 'o12', 'z');
    expect(await readFile(blob('shared'), 'utf8')).toBe('shared');
    expect(a.storedBytes).toBe(10);
    expect(a.isUndoable(a.get(2) as JournalEntry)).toBe(true);
  });

  it('evicts nothing for size while some size cannot be read', async () => {
    const a = await damagedThenRepaired();
    const b = await Journal.open(vault, BIG);
    await journalWrite({ journal: b }, 'b', 'b.md', 'shared', 'y');
    fail.blobStat = true;
    await a.refresh(); // leaves the size possibly stale
    fail.blobStat = contentHash('shared'); // and the re-measure fails too
    await journalWrite({ journal: a }, 'c', 'c.md', 'other12', 'z');
    expect(await readFile(blob('shared'), 'utf8')).toBe('shared');
  });

  it('when a repair left the manifest unchanged, so nothing was reread', async () => {
    const a = await damagedThenRepaired();
    // A rolled-back repair leaves the manifest byte-identical, so a never
    // rereads it.
    await writeFile(blob('shared'), 'shared');
    await journalWrite({ journal: a }, 'c', 'c.md', 'other12', 'z');
    expect(await readFile(blob('shared'), 'utf8')).toBe('shared');
    expect(a.storedBytes).toBe(13);
    expect(a.isUndoable(a.get(1) as JournalEntry)).toBe(true);
  });
});

describe('Journal: a repair whose commit is rolled back in another process', () => {
  it('never lets this process evict over the damaged size', async () => {
    const first = await Journal.open(vault, BIG);
    await journalWrite({ journal: first }, 'f', 'f.md', 'f1', 'x'); // seq 1
    await journalWrite({ journal: first }, 'a', 'a.md', 'shared', 'x'); // seq 2
    await writeFile(blob('shared'), 'x'.repeat(100)); // damaged outside Seekstone
    const a = await Journal.open(vault, { maxBytes: 20, maxEntries: 1e6 });
    expect(a.storedBytes).toBe(102);

    // b repairs 'shared', then its append fails and the row is rolled back:
    // the manifest is unchanged, and only the blob says a repair happened.
    const b = await Journal.open(vault, BIG);
    fail.append = true;
    await expect(journalWrite({ journal: b }, 'b', 'b.md', 'shared', 'y')).rejects.toThrow(
      /ENOSPC/,
    );
    expect(await readFile(blob('shared'), 'utf8')).toBe('shared');

    // On disk: 2 + 6 + 3 bytes, under the cap. Trusting 100 for 'shared'
    // would evict seq 1's blob (and 'shared' is never a candidate here).
    await journalWrite({ journal: a }, 'c', 'c.md', 'o12', 'z');
    expect(await readFile(blob('f1'), 'utf8')).toBe('f1');
    expect(a.storedBytes).toBe(11);
    expect(a.isUndoable(a.get(1) as JournalEntry)).toBe(true);
  });
});

describe('Journal: byte-cap eviction after damage outside Seekstone, with no repair', () => {
  it('measures every blob, so a shrunken newer blob cannot cost an older entry its undo', async () => {
    const j = await Journal.open(vault, { maxBytes: 20, maxEntries: 1e6 });
    await journalWrite({ journal: j }, 'a', 'a.md', 'f1', 'x'); // seq 1, 2 bytes
    await journalWrite({ journal: j }, 'b', 'b.md', 'sixteen-bytes-xx', 'x'); // seq 2
    await truncate(blob('sixteen-bytes-xx'), 1); // 18 bytes counted, 3 on disk
    await journalWrite({ journal: j }, 'c', 'c.md', 'o12', 'x'); // counted 21 > 20
    expect(await readFile(blob('f1'), 'utf8')).toBe('f1');
    expect(j.storedBytes).toBe(6);
    expect(j.isUndoable(j.get(1) as JournalEntry)).toBe(true);
  });
});

describe('Journal: the cost of counting real sizes', () => {
  it('measures nothing while the journal is under its byte cap', async () => {
    const a = await Journal.open(vault, { maxBytes: 1e9, maxEntries: 5 });
    const b = await Journal.open(vault, { maxBytes: 1e9, maxEntries: 5 });
    const counts: number[] = [];
    for (let n = 0; n < 12; n++) {
      fail.blobStats = 0;
      await journalWrite({ journal: n % 2 ? b : a }, `w${n}`, `n${n}.md`, `pre-${n}`, 'x');
      counts.push(fail.blobStats);
    }
    // Its own pre-image and the other process's new row: never every blob,
    // even when the entry cap compacts the manifest on every commit.
    expect(Math.max(...counts)).toBeLessThanOrEqual(2);
  });
});
