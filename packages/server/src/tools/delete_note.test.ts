import { access, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import { addNoteBacklinks } from '../index/backlinks.js';
import type { IndexedNote } from '../index/types.js';
import { PERMISSIVE_POLICY } from '../policy.js';
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
  return {
    vaultRoot: tmpDir,
    index,
    notes: new Map(),
    backlinks: new Map(),
    policy: PERMISSIVE_POLICY,
  };
}

function seedNote(relPath: string, raw: string): IndexedNote {
  const doc: IndexedNote = {
    id: relPath,
    title: relPath,
    body: raw,
    tags: '',
    fmKeys: '',
    fm: null,
    raw,
    sizeBytes: Buffer.byteLength(raw, 'utf8'),
    mtimeMs: Date.now(),
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
  it('moves the note to .trash/ with byte-identical content by default', async () => {
    await writeFile(join(tmpDir, 'gone.md'), 'bye — exact bytes\n', 'utf8');
    const result = await deleteNote(ctx, { path: 'gone.md' });

    await expect(readFile(join(tmpDir, 'gone.md'), 'utf8')).rejects.toThrow();
    expect(result.trashedTo).toBe('.trash/gone.md');
    expect(result.permanent).toBe(false);
    expect(await readFile(join(tmpDir, '.trash/gone.md'), 'utf8')).toBe('bye — exact bytes\n');
  });

  it('creates .trash/ on demand', async () => {
    // First delete in the suite already exercised this, but assert explicitly.
    await access(join(tmpDir, '.trash'));
  });

  it('suffixes on name collision and keeps both trashed files', async () => {
    await writeFile(join(tmpDir, 'dup.md'), 'first', 'utf8');
    const first = await deleteNote(ctx, { path: 'dup.md' });
    await writeFile(join(tmpDir, 'dup.md'), 'second', 'utf8');
    const second = await deleteNote(ctx, { path: 'dup.md' });

    expect(first.trashedTo).toBe('.trash/dup.md');
    expect(second.trashedTo).toMatch(/^\.trash\/dup\.\d+\.md$/);
    expect(await readFile(join(tmpDir, first.trashedTo ?? ''), 'utf8')).toBe('first');
    expect(await readFile(join(tmpDir, second.trashedTo ?? ''), 'utf8')).toBe('second');
  });

  it('permanent: true removes the file outright', async () => {
    await writeFile(join(tmpDir, 'forever.md'), 'x', 'utf8');
    const result = await deleteNote(ctx, { path: 'forever.md' });
    expect(result.permanent).toBe(false);

    await writeFile(join(tmpDir, 'forever2.md'), 'x', 'utf8');
    const perm = await deleteNote(ctx, { path: 'forever2.md', permanent: true });
    expect(perm.permanent).toBe(true);
    expect(perm.trashedTo).toBeUndefined();
    await expect(readFile(join(tmpDir, 'forever2.md'), 'utf8')).rejects.toThrow();
    const trashed = await readdir(join(tmpDir, '.trash'));
    expect(trashed).not.toContain('forever2.md');
  });

  it('removes the note from the in-memory index', async () => {
    await writeFile(join(tmpDir, 'indexed.md'), 'unique_xyzzy_delete', 'utf8');
    seedNote('indexed.md', 'unique_xyzzy_delete');

    await deleteNote(ctx, { path: 'indexed.md' });

    expect(ctx.notes.has('indexed.md')).toBe(false);
    expect(ctx.index.search('unique_xyzzy_delete').some((h) => h.id === 'indexed.md')).toBe(false);
  });

  it('clears the deleted note`s outgoing backlink refs', async () => {
    await writeFile(join(tmpDir, 'linker.md'), 'See [[anchor-target]].', 'utf8');
    await writeFile(join(tmpDir, 'anchor-target.md'), '# T', 'utf8');
    seedNote('linker.md', 'See [[anchor-target]].');
    seedNote('anchor-target.md', '# T');
    addNoteBacklinks(ctx, 'linker.md', 'See [[anchor-target]].');
    expect(ctx.backlinks.get('anchor-target.md')?.map((r) => r.path)).toEqual(['linker.md']);

    await deleteNote(ctx, { path: 'linker.md' });

    expect(ctx.backlinks.get('anchor-target.md') ?? []).toEqual([]);
  });

  it('returns the deleted path', async () => {
    await writeFile(join(tmpDir, 'ret.md'), '', 'utf8');
    const result = await deleteNote(ctx, { path: 'ret.md' });
    expect(result.path).toBe('ret.md');
  });

  it('throws if the note does not exist (both modes)', async () => {
    await expect(deleteNote(ctx, { path: 'nonexistent.md' })).rejects.toThrow();
    await expect(deleteNote(ctx, { path: 'nonexistent.md', permanent: true })).rejects.toThrow();
  });

  it('throws on path traversal', async () => {
    await expect(deleteNote(ctx, { path: '../escape.md' })).rejects.toThrow('Path outside vault');
  });
});
