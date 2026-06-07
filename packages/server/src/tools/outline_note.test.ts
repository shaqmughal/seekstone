import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import type { IndexedNote } from '../index/types.js';
import { outlineNote } from './outline_note.js';

function buildCtx(vaultRoot: string): ServerContext {
  const index = new MiniSearch<IndexedNote>({
    idField: 'id',
    fields: ['title', 'body', 'tags', 'fmKeys'],
    storeFields: ['id', 'title', 'tags', 'sizeBytes', 'mtimeMs'],
    searchOptions: { boost: { title: 3, tags: 2, body: 1 }, fuzzy: 0.2, prefix: true },
  });
  return { vaultRoot, index, notes: new Map() };
}

const NOTE = `---
title: Test
tags: [a]
---
# Intro

Some prose. ^ref1

## Details

More prose.

### Deep

End.
`;

let vaultRoot: string;

beforeAll(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-outline-note-'));
  await writeFile(join(vaultRoot, 'note.md'), NOTE, 'utf8');
});

afterAll(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

describe('outlineNote', () => {
  it('returns headings from the note body', async () => {
    const ctx = buildCtx(vaultRoot);
    const result = await outlineNote(ctx, {
      path: 'note.md',
      includeBlocks: true,
      includeSizes: false,
    });
    expect(result.headings.map((h) => h.text)).toEqual(['Intro', 'Details', 'Deep']);
  });

  it('returns frontmatterKeys', async () => {
    const ctx = buildCtx(vaultRoot);
    const result = await outlineNote(ctx, {
      path: 'note.md',
      includeBlocks: true,
      includeSizes: false,
    });
    expect(result.frontmatterKeys).toEqual(['title', 'tags']);
  });

  it('returns block refs when includeBlocks is true', async () => {
    const ctx = buildCtx(vaultRoot);
    const result = await outlineNote(ctx, {
      path: 'note.md',
      includeBlocks: true,
      includeSizes: false,
    });
    expect(result.blocks).toEqual([expect.objectContaining({ id: 'ref1' })]);
  });

  it('omits block refs when includeBlocks is false', async () => {
    const ctx = buildCtx(vaultRoot);
    const result = await outlineNote(ctx, {
      path: 'note.md',
      includeBlocks: false,
      includeSizes: false,
    });
    expect(result.blocks).toEqual([]);
  });

  it('totalBytes matches the file content', async () => {
    const ctx = buildCtx(vaultRoot);
    const result = await outlineNote(ctx, {
      path: 'note.md',
      includeBlocks: true,
      includeSizes: false,
    });
    expect(result.totalBytes).toBe(Buffer.byteLength(NOTE, 'utf8'));
  });

  it('includes byteLength on headings when includeSizes is true', async () => {
    const ctx = buildCtx(vaultRoot);
    const result = await outlineNote(ctx, {
      path: 'note.md',
      includeBlocks: true,
      includeSizes: true,
    });
    for (const h of result.headings) {
      expect(typeof h.byteLength).toBe('number');
    }
  });

  it('throws "Path outside vault" for traversal attempts', async () => {
    const ctx = buildCtx(vaultRoot);
    await expect(
      outlineNote(ctx, { path: '../outside.md', includeBlocks: true, includeSizes: false }),
    ).rejects.toThrow('Path outside vault');
  });
});
