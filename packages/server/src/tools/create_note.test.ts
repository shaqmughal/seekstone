import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import type { IndexedNote } from '../index/types.js';
import { createNote } from './create_note.js';

let tmpDir: string;
let ctx: ServerContext;

function freshCtx(): ServerContext {
  const index = new MiniSearch<IndexedNote>({
    idField: 'id',
    fields: ['title', 'body', 'tags', 'fmKeys'],
    storeFields: ['id', 'title', 'tags', 'sizeBytes', 'mtimeMs'],
    searchOptions: { boost: { title: 3, tags: 2, body: 1 }, fuzzy: 0.2, prefix: true },
  });
  return { vaultRoot: tmpDir, index, notes: new Map(), backlinks: new Map() };
}

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'seekstone-create-note-test-'));
  ctx = freshCtx();
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('createNote', () => {
  it('creates a plain note with body content', async () => {
    const result = await createNote(ctx, { path: 'plain.md', content: 'Hello world.' });
    expect(result.path).toBe('plain.md');
    expect(result.bytesWritten).toBeGreaterThan(0);
    const disk = await readFile(join(tmpDir, 'plain.md'), 'utf8');
    expect(disk).toBe('Hello world.');
  });

  it('creates a note with frontmatter', async () => {
    await createNote(ctx, {
      path: 'withfm.md',
      content: 'Body here.',
      frontmatter: { title: 'My Note', tags: ['work'], date: '2026-06-01' },
    });
    const disk = await readFile(join(tmpDir, 'withfm.md'), 'utf8');
    expect(disk).toMatch(/^---\n/);
    expect(disk).toContain('title: My Note');
    expect(disk).toContain('Body here.');
  });

  it('creates parent directories automatically', async () => {
    await createNote(ctx, { path: 'deep/nested/dir/note.md', content: 'nested' });
    const disk = await readFile(join(tmpDir, 'deep/nested/dir/note.md'), 'utf8');
    expect(disk).toBe('nested');
  });

  it('adds the note to the in-memory index so it is immediately searchable', async () => {
    await createNote(ctx, { path: 'indexed.md', content: 'unique_search_term_xyzzy' });
    const hits = ctx.index.search('unique_search_term_xyzzy');
    expect(hits.some((h) => h.id === 'indexed.md')).toBe(true);
    expect(ctx.notes.has('indexed.md')).toBe(true);
  });

  it('uses frontmatter title in the index when provided', async () => {
    await createNote(ctx, {
      path: 'titled.md',
      content: '',
      frontmatter: { title: 'Special Title' },
    });
    const note = ctx.notes.get('titled.md');
    expect(note?.title).toBe('Special Title');
  });

  it('falls back to filename as title when no frontmatter title', async () => {
    await createNote(ctx, { path: 'subtitles/no-title.md', content: '' });
    const note = ctx.notes.get('subtitles/no-title.md');
    expect(note?.title).toBe('no-title');
  });

  it('creates an empty note when content and frontmatter are both omitted', async () => {
    const result = await createNote(ctx, { path: 'empty.md' });
    const disk = await readFile(join(tmpDir, 'empty.md'), 'utf8');
    expect(disk).toBe('');
    expect(result.bytesWritten).toBe(0);
  });

  it('throws if the note already exists and overwrite is false (default)', async () => {
    await writeFile(join(tmpDir, 'existing.md'), 'original', 'utf8');
    await expect(createNote(ctx, { path: 'existing.md', content: 'replacement' })).rejects.toThrow(
      'already exists',
    );
    // original content must be untouched
    const disk = await readFile(join(tmpDir, 'existing.md'), 'utf8');
    expect(disk).toBe('original');
  });

  it('overwrites when overwrite: true, updating the index', async () => {
    await writeFile(join(tmpDir, 'rewrite.md'), 'old content', 'utf8');
    // seed ctx.notes with a stale entry
    const stale: IndexedNote = {
      id: 'rewrite.md',
      title: 'rewrite',
      body: 'old content',
      tags: '',
      fmKeys: '',
      fm: null,
      raw: 'old content',
      sizeBytes: 11,
      mtimeMs: Date.now(),
    };
    ctx.notes.set('rewrite.md', stale);
    ctx.index.add(stale);

    await createNote(ctx, { path: 'rewrite.md', content: 'new content', overwrite: true });

    const disk = await readFile(join(tmpDir, 'rewrite.md'), 'utf8');
    expect(disk).toBe('new content');
    expect(ctx.notes.get('rewrite.md')?.body).toContain('new content');
  });

  it('throws on path traversal', async () => {
    await expect(createNote(ctx, { path: '../escape.md', content: 'bad' })).rejects.toThrow(
      'Path outside vault',
    );
  });
});
