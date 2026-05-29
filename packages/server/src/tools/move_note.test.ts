import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import type { IndexedNote } from '../index/types.js';
import { moveNote } from './move_note.js';

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
  tmpDir = await mkdtemp(join(tmpdir(), 'seekstone-move-note-test-'));
  ctx = freshCtx();
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('moveNote', () => {
  it('moves the file on disk', async () => {
    await writeFile(join(tmpDir, 'src.md'), 'content', 'utf8');
    await moveNote(ctx, { from: 'src.md', to: 'dst.md' });
    await expect(readFile(join(tmpDir, 'src.md'), 'utf8')).rejects.toThrow();
    const disk = await readFile(join(tmpDir, 'dst.md'), 'utf8');
    expect(disk).toBe('content');
  });

  it('updates the in-memory index — old path gone, new path present', async () => {
    const raw = 'unique_move_term_qwerty';
    await writeFile(join(tmpDir, 'old.md'), raw, 'utf8');
    seedNote('old.md', raw);

    await moveNote(ctx, { from: 'old.md', to: 'new.md' });

    expect(ctx.notes.has('old.md')).toBe(false);
    expect(ctx.notes.has('new.md')).toBe(true);
    expect(ctx.index.search('unique_move_term_qwerty').some((h) => h.id === 'new.md')).toBe(true);
    expect(ctx.index.search('unique_move_term_qwerty').some((h) => h.id === 'old.md')).toBe(false);
  });

  it('creates parent directories automatically', async () => {
    await writeFile(join(tmpDir, 'flat.md'), 'hi', 'utf8');
    await moveNote(ctx, { from: 'flat.md', to: 'deep/nested/flat.md' });
    const disk = await readFile(join(tmpDir, 'deep/nested/flat.md'), 'utf8');
    expect(disk).toBe('hi');
  });

  it('returns from and to paths', async () => {
    await writeFile(join(tmpDir, 'a.md'), '', 'utf8');
    const result = await moveNote(ctx, { from: 'a.md', to: 'b.md' });
    expect(result.from).toBe('a.md');
    expect(result.to).toBe('b.md');
  });

  it('throws if source does not exist', async () => {
    await expect(moveNote(ctx, { from: 'missing.md', to: 'anywhere.md' })).rejects.toThrow('Note not found');
  });

  it('throws if destination exists and overwrite is false (default)', async () => {
    await writeFile(join(tmpDir, 'keep-src.md'), 'original', 'utf8');
    await writeFile(join(tmpDir, 'keep-dst.md'), 'existing', 'utf8');
    await expect(
      moveNote(ctx, { from: 'keep-src.md', to: 'keep-dst.md' }),
    ).rejects.toThrow('already exists');
    // source must be untouched
    expect(await readFile(join(tmpDir, 'keep-src.md'), 'utf8')).toBe('original');
  });

  it('overwrites destination when overwrite: true', async () => {
    await writeFile(join(tmpDir, 'over-src.md'), 'new', 'utf8');
    await writeFile(join(tmpDir, 'over-dst.md'), 'old', 'utf8');
    await moveNote(ctx, { from: 'over-src.md', to: 'over-dst.md', overwrite: true });
    expect(await readFile(join(tmpDir, 'over-dst.md'), 'utf8')).toBe('new');
  });

  it('throws on path traversal in from', async () => {
    await expect(moveNote(ctx, { from: '../escape.md', to: 'safe.md' })).rejects.toThrow('Path outside vault');
  });

  it('throws on path traversal in to', async () => {
    await writeFile(join(tmpDir, 'legit.md'), '', 'utf8');
    await expect(moveNote(ctx, { from: 'legit.md', to: '../escape.md' })).rejects.toThrow('Path outside vault');
  });
});
