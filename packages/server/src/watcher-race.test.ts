import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerContext } from './context.js';
import { buildAttachmentIndex } from './index/resolve.js';
import type { IndexedNote } from './index/types.js';
import { PERMISSIVE_POLICY } from './policy.js';
import { startWatcher } from './watcher.js';

// Holds the watcher's next read of a file named `hold.file` after the read
// itself is done, until the test calls `release`. That lets a test land an
// unlink or a newer change while the read is still in flight.
const hold = vi.hoisted(() => ({
  file: undefined as string | undefined,
  entered: false,
  release: () => {},
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const fsp = await importOriginal<typeof import('node:fs/promises')>();
  const readFile = (async (...args: Parameters<typeof fsp.readFile>) => {
    const raw = await fsp.readFile(...args);
    if (hold.file !== undefined && String(args[0]).endsWith(hold.file)) {
      hold.file = undefined;
      hold.entered = true;
      await new Promise<void>((resolve) => {
        hold.release = resolve;
      });
    }
    return raw;
  }) as typeof fsp.readFile;
  return { ...fsp, readFile, default: { ...fsp, readFile } };
});

let tmpDir: string;

function freshCtx(vaultRoot: string): ServerContext {
  return {
    vaultRoot,
    index: new MiniSearch<IndexedNote>({
      idField: 'id',
      fields: ['title', 'body', 'tags', 'fmKeys'],
      storeFields: ['id'],
    }),
    notes: new Map(),
    generation: 0,
    backlinks: new Map(),
    attachments: buildAttachmentIndex([]),
    policy: PERMISSIVE_POLICY,
  };
}

// Same as watcher.test.ts: under usePolling, chokidar rescans a folder only
// when its mtime changes, and on Windows one create can go unseen. Every ~2 s
// the nudge adds a new non-note file, which changes the folder's mtime.
async function waitFor(condition: () => boolean, nudge?: () => Promise<void>): Promise<void> {
  const deadline = Date.now() + 60_000;
  let ticks = 0;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('waitFor timeout');
    ticks += 1;
    if (nudge && ticks % 100 === 0) await nudge();
    await new Promise((r) => setTimeout(r, 20));
  }
}

function dirNudger(dir: string): () => Promise<void> {
  let n = 0;
  return async () => {
    n += 1;
    await writeFile(join(dir, `nudge-${n}.tmp`), String(n), 'utf8');
  };
}

// Lets the released read and anything it awaits settle.
const settle = () => new Promise((r) => setTimeout(r, 100));

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'seekstone-watcher-race-'));
  hold.file = undefined;
  hold.entered = false;
});

afterEach(async () => {
  hold.release();
  await rm(tmpDir, { recursive: true, force: true });
});

// Unlike watcher.test.ts, this suite also runs in the coverage gate: the held
// read fixes the event order, so instrumentation lag only adds wait time.
describe('watcher reads in flight', () => {
  it('drops a read that finishes after the note was deleted', async () => {
    const ctx = freshCtx(tmpDir);
    const events: string[] = [];
    const { stop, ready } = startWatcher(ctx, undefined, {
      usePolling: true,
      pollInterval: 50,
      onRawEvent: (event, _abs, rel) => events.push(`${event} ${rel}`),
    });
    try {
      await ready;
      hold.file = 'Foo.MD';
      await writeFile(join(tmpDir, 'Foo.MD'), 'gonetext', 'utf8');
      await waitFor(() => hold.entered, dirNudger(tmpDir));
      await rm(join(tmpDir, 'Foo.MD'));
      await waitFor(() => events.includes('unlink Foo.MD'), dirNudger(tmpDir));
      hold.release();
      await settle();
      expect(ctx.notes.has('Foo.MD')).toBe(false);
      expect(ctx.index.search('gonetext')).toEqual([]);
    } finally {
      await stop();
    }
  });

  it('keeps the newer content when an older read finishes last', async () => {
    const ctx = freshCtx(tmpDir);
    const { stop, ready } = startWatcher(ctx, undefined, { usePolling: true, pollInterval: 50 });
    try {
      await ready;
      hold.file = 'Foo.MD';
      await writeFile(join(tmpDir, 'Foo.MD'), 'oldtext', 'utf8');
      await waitFor(() => hold.entered, dirNudger(tmpDir));
      await writeFile(join(tmpDir, 'Foo.MD'), 'newtext plus more words', 'utf8');
      await waitFor(() => ctx.index.search('newtext').length === 1, dirNudger(tmpDir));
      hold.release();
      await settle();
      expect(ctx.index.search('oldtext')).toEqual([]);
      expect(ctx.index.search('newtext').map((h) => h.id)).toEqual(['Foo.MD']);
    } finally {
      await stop();
    }
  });
});
