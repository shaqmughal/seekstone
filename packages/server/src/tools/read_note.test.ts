import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import type { IndexedNote } from '../index/types.js';
import { readNote } from './read_note.js';

let vaultRoot: string;
let ctx: ServerContext;

beforeAll(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-read-note-'));
  const index = new MiniSearch<IndexedNote>({
    idField: 'id',
    fields: ['title', 'body', 'tags', 'fmKeys'],
    storeFields: ['id', 'title', 'tags', 'sizeBytes', 'mtimeMs'],
  });
  ctx = { vaultRoot, index, notes: new Map() };

  await writeFile(join(vaultRoot, 'hello.md'), '# Hello\n\nSome content here.\n', 'utf8');
});

afterAll(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

describe('readNote', () => {
  it('reads a real file and returns path, content, sizeBytes', async () => {
    const result = await readNote(ctx, { path: 'hello.md' });
    expect(result.path).toBe('hello.md');
    expect(result.content).toBe('# Hello\n\nSome content here.\n');
    expect(result.sizeBytes).toBe(Buffer.byteLength(result.content, 'utf8'));
  });

  it('sizeBytes matches Buffer.byteLength of the content', async () => {
    const result = await readNote(ctx, { path: 'hello.md' });
    expect(result.sizeBytes).toBe(Buffer.byteLength(result.content, 'utf8'));
  });

  it('throws "Path outside vault" for path with ../ traversal', async () => {
    await expect(readNote(ctx, { path: '../etc/passwd' })).rejects.toThrow('Path outside vault');
  });

  it('throws ENOENT for a non-existent file', async () => {
    await expect(readNote(ctx, { path: 'does-not-exist.md' })).rejects.toThrow(/ENOENT/);
  });
});
