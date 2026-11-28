import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contentHash } from './content-hash.js';
import { HISTORY_DIR, Journal } from './journal.js';

// SHA-652: after writeDurable renames a pre-image blob into place, it fsyncs
// the blob folder, so the blob survives a power cut along with the note write.

const FAKE_FD = 9_999;
/** Folders to trace: their open/fsync/close are recorded and faked, renames into them recorded. */
const trace = vi.hoisted(() => ({
  dirs: new Set<string>(),
  events: [] as string[],
  fsyncError: undefined as string | undefined,
}));

vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  const inTraced = (p: string) => [...trace.dirs].some((d) => p.startsWith(`${d}${sep}`));
  const renameSync: typeof fs.renameSync = (from, to) => {
    fs.renameSync(from, to);
    if (inTraced(String(to))) trace.events.push('rename');
  };
  const openSync = ((path: string, flags: string, ...rest: unknown[]) => {
    if (trace.dirs.has(String(path))) {
      trace.events.push(`open ${path} ${flags}`);
      return FAKE_FD;
    }
    return (fs.openSync as (...a: unknown[]) => number)(path, flags, ...rest);
  }) as typeof fs.openSync;
  const fsyncSync: typeof fs.fsyncSync = (fd) => {
    if (fd !== FAKE_FD) return fs.fsyncSync(fd);
    trace.events.push(`fsync ${fd}`);
    if (trace.fsyncError) {
      throw Object.assign(new Error(trace.fsyncError), { code: trace.fsyncError });
    }
  };
  const closeSync: typeof fs.closeSync = (fd) => {
    if (fd !== FAKE_FD) return fs.closeSync(fd);
    trace.events.push(`close ${fd}`);
  };
  const patched = { renameSync, openSync, fsyncSync, closeSync };
  return { ...fs, ...patched, default: { ...fs, ...patched } };
});

const realPlatform = process.platform;
function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
}

let vault: string;
let blobDir: string;

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'seekstone-dir-sync-'));
  blobDir = join(vault, HISTORY_DIR, 'blobs');
  trace.dirs = new Set([blobDir]);
  trace.events = [];
  trace.fsyncError = undefined;
});

afterEach(async () => {
  setPlatform(realPlatform);
  await rm(vault, { recursive: true, force: true });
});

async function journalOne(pre: string): Promise<void> {
  const journal = await Journal.open(vault, { maxBytes: 1e9, maxEntries: 1000 });
  const txn = journal.begin('append_note');
  await txn.add('note.md', pre, `${pre} more`);
  await txn.commit();
}

const synced = () => ['rename', `open ${blobDir} r`, `fsync ${FAKE_FD}`, `close ${FAKE_FD}`];

describe('writeDurable folder fsync (SHA-652)', () => {
  for (const [platform, expected] of [
    ['linux', synced],
    ['darwin', synced],
    ['win32', () => ['rename']],
  ] as const) {
    it(`fsyncs the blob folder read-only after the rename, except on win32: ${platform}`, async () => {
      setPlatform(platform);
      await journalOne('before');
      expect(trace.events).toEqual(expected());
      expect(await readdir(blobDir)).toEqual([contentHash('before')]);
    });
  }

  it('still commits when the folder fsync fails', async () => {
    setPlatform('linux');
    trace.fsyncError = 'EINVAL';
    await journalOne('before');
    expect(trace.events).toEqual(synced());
    const journal = await Journal.open(vault, { maxBytes: 1e9, maxEntries: 1000 });
    expect(journal.list().writes.map((r) => [r.tool, r.undoable])).toEqual([['append_note', true]]);
  });
});
