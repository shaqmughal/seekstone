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
const fail = vi.hoisted(() => ({ blobScan: false, blobRename: '' as '' | 'placed' | 'refused' }));

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
  return {
    ...fs,
    readdirSync,
    renameSync,
    default: { ...fs, readdirSync, renameSync },
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
  fail.blobRename = '';
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
