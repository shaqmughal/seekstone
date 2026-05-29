import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import type { IndexedNote } from '../index/types.js';
import { deleteNote } from './delete_note.js';

let tmpDir: string;
let ctx: ServerContext;

function freshCtx(): ServerContext {
  const index = new MiniSearch<IndexedNote>({
    idField: 'id',
    fields: ['title', 'body', 'tags', 'fmKeys'],
    storeFields: ['id', 'title', 'tags', 'sizeBytes', 'mtimeMs'],
    searchOptions: { boost: { title: 3, tags: 2, body: 1 }, fuzzy: 0.2, prefix: true },
  });
  return { vaultRoot: tmpDir, index, notes: new Map() };
}

function seedNote(relPath: string, raw: string): IndexedNote {
  const doc: IndexedNote = {
    id: relPath, title: relPath, body: raw, tags: '', fmKeys: '',
    raw, sizeBytes: Buffer.byteLength(raw, 'utf8'), mtimeMs: Date.now(),
  };
  ctx.notes.set(relPath, doc);
  ctx.index.add(doc);
  return doc;
}

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'seekstone-delete-note-test-'));
  ctx = freshCtx();
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('deleteNote', () => {
  it('deletes the file from disk', async () => {
    await writeFile(join(tmpDir, 'gone.md'), 'bye', 'utf8');
    await deleteNote(ctx, { path: 'gone.md' });
    await expect(readFile(join(tmpDir, 'gone.md'), 'utf8')).rejects.toThrow();
  });

  it('removes the note from the in-memory index', async () => {
    await writeFile(join(tmpDir, 'indexed.md'), 'unique_xyzzy_delete', 'utf8');
    seedNote('indexed.md', 'unique_xyzzy_delete');

    await deleteNote(ctx, { path: 'indexed.md' });

    expect(ctx.notes.has('indexed.md')).toBe(false);
    expect(ctx.index.search('unique_xyzzy_delete').some((h) => h.id === 'indexed.md')).toBe(false);
  });

  it('returns the deleted path', async () => {
    await writeFile(join(tmpDir, 'ret.md'), '', 'utf8');
    const result = await deleteNote(ctx, { path: 'ret.md' });
    expect(result.path).toBe('ret.md');
  });

  it('throws if the note does not exist', async () => {
    await expect(deleteNote(ctx, { path: 'nonexistent.md' })).rejects.toThrow();
  });

  it('throws on path traversal', async () => {
    await expect(deleteNote(ctx, { path: '../escape.md' })).rejects.toThrow('Path outside vault');
  });
});
