import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ServerContext } from './context.js';
import type { IndexedNote } from './index/types.js';
import { startWatcher } from './watcher.js';

// Each test gets its own vault dir. We await the watcher's `ready` promise
// before mutating files, so events are deterministic (no retries needed).
let tmpDir: string;

function freshCtx(vaultRoot: string): ServerContext {
  const index = new MiniSearch<IndexedNote>({
    idField: 'id',
    fields: ['title', 'body', 'tags', 'fmKeys'],
    storeFields: ['id', 'title', 'tags', 'sizeBytes', 'mtimeMs'],
    searchOptions: { boost: { title: 3, tags: 2, body: 1 }, fuzzy: 0.2, prefix: true },
  });
  return { vaultRoot, index, notes: new Map(), backlinks: new Map() };
}

async function waitFor(condition: () => boolean, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 20));
  }
}

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'seekstone-watcher-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// Real-filesystem integration tests. The coverage gate skips them
// (SEEKSTONE_COVERAGE=1): watcher.ts is excluded from coverage and validated
// here in the normal cross-platform Test run, where v8 instrumentation isn't
// starving the event loop.
describe.skipIf(process.env.SEEKSTONE_COVERAGE === '1')('startWatcher', () => {
  it('indexes a new .md file created after startup', async () => {
    const ctx = freshCtx(tmpDir);
    const { stop, ready } = startWatcher(ctx, undefined, { usePolling: true });
    try {
      await ready;
      await new Promise((r) => setImmediate(r));
      await writeFile(join(tmpDir, 'watch-new.md'), 'watcher_unique_abc', 'utf8');
      await waitFor(() => ctx.notes.has('watch-new.md'));
      expect(ctx.index.search('watcher_unique_abc').some((h) => h.id === 'watch-new.md')).toBe(
        true,
      );
    } finally {
      stop();
    }
  });

  it('updates the index when a file is modified', async () => {
    const ctx = freshCtx(tmpDir);
    await writeFile(join(tmpDir, 'watch-mod.md'), 'old content', 'utf8');
    const { stop, ready } = startWatcher(ctx, undefined, { usePolling: true });
    try {
      await ready;
      await new Promise((r) => setImmediate(r));
      await writeFile(join(tmpDir, 'watch-mod.md'), 'new_unique_modified_xyz', 'utf8');
      await waitFor(
        () => ctx.notes.get('watch-mod.md')?.body?.includes('new_unique_modified_xyz') ?? false,
      );
      expect(ctx.notes.get('watch-mod.md')?.body).toContain('new_unique_modified_xyz');
    } finally {
      stop();
    }
  });

  it('removes a deleted file from the index', async () => {
    const ctx = freshCtx(tmpDir);
    await writeFile(join(tmpDir, 'watch-del.md'), 'will be deleted', 'utf8');
    const doc: IndexedNote = {
      id: 'watch-del.md',
      title: 'watch-del',
      body: 'will be deleted',
      tags: '',
      fmKeys: '',
      raw: 'will be deleted',
      sizeBytes: 15,
      mtimeMs: Date.now(),
    };
    ctx.notes.set('watch-del.md', doc);
    ctx.index.add(doc);

    const { stop, ready } = startWatcher(ctx, undefined, { usePolling: true });
    try {
      await ready;
      await new Promise((r) => setImmediate(r));
      await rm(join(tmpDir, 'watch-del.md'));
      await waitFor(() => !ctx.notes.has('watch-del.md'));
      expect(ctx.notes.has('watch-del.md')).toBe(false);
    } finally {
      stop();
    }
  });

  it('detects a new note in a nested folder (the Linux fs.watch gap)', async () => {
    // The crux of SHA-35: fs.watch(recursive) silently misses nested events on
    // Linux; chokidar must deliver them. A single nested add proves recursive
    // delivery (modify/delete handlers are covered by the flat tests above).
    const ctx = freshCtx(tmpDir);
    await mkdir(join(tmpDir, 'a', 'b', 'c'), { recursive: true });
    const { stop, ready } = startWatcher(ctx, undefined, { usePolling: true });
    try {
      await ready;
      await new Promise((r) => setImmediate(r));
      await writeFile(join(tmpDir, 'a', 'b', 'c', 'deep.md'), 'nested_unique_def', 'utf8');
      await waitFor(() => ctx.notes.has('a/b/c/deep.md'));
      expect(ctx.notes.get('a/b/c/deep.md')?.body).toContain('nested_unique_def');
    } finally {
      stop();
    }
  });

  it('handles a vault path containing spaces', async () => {
    const spaced = join(tmpDir, 'My Vault');
    await mkdir(spaced, { recursive: true });
    const ctx = freshCtx(spaced);
    const { stop, ready } = startWatcher(ctx, undefined, { usePolling: true });
    try {
      await ready;
      await new Promise((r) => setImmediate(r));
      await writeFile(join(spaced, 'spaced note.md'), 'spaced_unique_ghi', 'utf8');
      await waitFor(() => ctx.notes.has('spaced note.md'));
      expect(ctx.notes.get('spaced note.md')?.body).toContain('spaced_unique_ghi');
    } finally {
      stop();
    }
  });

  it('logs index updates through an injected logger', async () => {
    const ctx = freshCtx(tmpDir);
    const events: { msg: string; fields?: Record<string, unknown> }[] = [];
    const noop = () => {};
    const log = {
      level: 'debug' as const,
      error: noop,
      warn: noop,
      info: noop,
      debug: (msg: string, fields?: Record<string, unknown>) => events.push({ msg, fields }),
    };
    const { stop, ready } = startWatcher(ctx, log, { usePolling: true });
    try {
      await ready;
      await new Promise((r) => setImmediate(r));
      await writeFile(join(tmpDir, 'watch-log.md'), 'logged_body_qrs', 'utf8');
      await waitFor(() =>
        events.some((e) => e.msg === 'index updated' && e.fields?.path === 'watch-log.md'),
      );
      expect(ctx.notes.has('watch-log.md')).toBe(true);
      expect(
        events.some((e) => e.msg === 'index updated' && e.fields?.path === 'watch-log.md'),
      ).toBe(true);
    } finally {
      stop();
    }
  });

  it('ignores non-.md files', async () => {
    const ctx = freshCtx(tmpDir);
    const { stop, ready } = startWatcher(ctx, undefined, { usePolling: true });
    try {
      await ready;
      await writeFile(join(tmpDir, 'image.png'), 'binary', 'utf8');
      await new Promise((r) => setTimeout(r, 150));
      expect(ctx.notes.size).toBe(0);
    } finally {
      stop();
    }
  });

  it('returns a stop function that closes the watcher', () => {
    const ctx = freshCtx(tmpDir);
    const { stop } = startWatcher(ctx, undefined, { usePolling: true });
    expect(() => stop()).not.toThrow();
  });
});
