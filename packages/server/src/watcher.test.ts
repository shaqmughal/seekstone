import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ServerContext } from './context.js';
import type { IndexedNote } from './index/types.js';
import { startWatcher } from './watcher.js';

let tmpDir: string;

function freshCtx(vaultRoot: string): ServerContext {
  const index = new MiniSearch<IndexedNote>({
    idField: 'id',
    fields: ['title', 'body', 'tags', 'fmKeys'],
    storeFields: ['id', 'title', 'tags', 'sizeBytes', 'mtimeMs'],
    searchOptions: { boost: { title: 3, tags: 2, body: 1 }, fuzzy: 0.2, prefix: true },
  });
  return { vaultRoot, index, notes: new Map() };
}

async function waitFor(condition: () => boolean, timeoutMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 20));
  }
}

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'seekstone-watcher-test-'));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('startWatcher', () => {
  it('indexes a new .md file created after startup', async () => {
    const ctx = freshCtx(tmpDir);
    const stop = startWatcher(ctx);
    try {
      await writeFile(join(tmpDir, 'watch-new.md'), 'watcher_unique_abc', 'utf8');
      await waitFor(() => ctx.notes.has('watch-new.md'));
      expect(ctx.index.search('watcher_unique_abc').some((h) => h.id === 'watch-new.md')).toBe(true);
    } finally {
      stop();
    }
  });

  it('updates the index when a file is modified', async () => {
    const ctx = freshCtx(tmpDir);
    await writeFile(join(tmpDir, 'watch-mod.md'), 'old content', 'utf8');
    const stop = startWatcher(ctx);
    try {
      await writeFile(join(tmpDir, 'watch-mod.md'), 'new_unique_modified_xyz', 'utf8');
      await waitFor(() => ctx.notes.get('watch-mod.md')?.body?.includes('new_unique_modified_xyz') ?? false);
      expect(ctx.notes.get('watch-mod.md')?.body).toContain('new_unique_modified_xyz');
    } finally {
      stop();
    }
  });

  it('removes a deleted file from the index', async () => {
    const ctx = freshCtx(tmpDir);
    await writeFile(join(tmpDir, 'watch-del.md'), 'will be deleted', 'utf8');
    // Pre-seed so the note is in the index before deletion.
    const doc: IndexedNote = {
      id: 'watch-del.md', title: 'watch-del', body: 'will be deleted',
      tags: '', fmKeys: '', raw: 'will be deleted',
      sizeBytes: 15, mtimeMs: Date.now(),
    };
    ctx.notes.set('watch-del.md', doc);
    ctx.index.add(doc);

    const stop = startWatcher(ctx);
    try {
      await rm(join(tmpDir, 'watch-del.md'));
      await waitFor(() => !ctx.notes.has('watch-del.md'));
      expect(ctx.notes.has('watch-del.md')).toBe(false);
    } finally {
      stop();
    }
  });

  it('ignores non-.md files', async () => {
    const ctx = freshCtx(tmpDir);
    const stop = startWatcher(ctx);
    try {
      await writeFile(join(tmpDir, 'image.png'), 'binary', 'utf8');
      // Wait a bit and confirm nothing was indexed.
      await new Promise((r) => setTimeout(r, 150));
      expect(ctx.notes.size).toBe(0);
    } finally {
      stop();
    }
  });

  it('returns a stop function that closes the watcher', () => {
    const ctx = freshCtx(tmpDir);
    const stop = startWatcher(ctx);
    expect(() => stop()).not.toThrow();
  });
});
