import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFrontmatter } from '@seekstone/core/frontmatter';
import MiniSearch from 'minisearch';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import type { IndexedNote } from '../index/types.js';
import { patchFrontmatter } from './patch_frontmatter.js';

function buildCtx(
  vaultRoot: string,
  notes: Array<{
    id: string;
    title: string;
    body: string;
    tags?: string;
    fmKeys?: string;
    raw?: string;
  }>,
): ServerContext {
  const index = new MiniSearch<IndexedNote>({
    idField: 'id',
    fields: ['title', 'body', 'tags', 'fmKeys'],
    storeFields: ['id', 'title', 'tags', 'sizeBytes', 'mtimeMs'],
    searchOptions: { boost: { title: 3, tags: 2, body: 1 }, fuzzy: 0.2, prefix: true },
  });
  const notesMap = new Map<string, IndexedNote>();
  const docs: IndexedNote[] = notes.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    tags: n.tags ?? '',
    fmKeys: n.fmKeys ?? '',
    raw: n.raw ?? n.body,
    sizeBytes: Buffer.byteLength(n.raw ?? n.body, 'utf8'),
    mtimeMs: Date.now(),
  }));
  index.addAll(docs);
  for (const doc of docs) notesMap.set(doc.id, doc);
  return { vaultRoot, index, notes: notesMap };
}

let vaultRoot: string;

const NOTE_WITH_FM = `---
title: My Note
date: 2026-01-01
author: Alice
---
# Body

Some content.
`;

const NOTE_WITHOUT_FM = `# No Frontmatter

Just body text.
`;

beforeAll(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-patch-fm-'));
});

afterAll(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

describe('patchFrontmatter', () => {
  it('adds a new key to frontmatter — key appears in file, other keys unchanged', async () => {
    await writeFile(join(vaultRoot, 'add-key.md'), NOTE_WITH_FM, 'utf8');
    const ctx = buildCtx(vaultRoot, [
      { id: 'add-key.md', title: 'My Note', body: '# Body\n\nSome content.\n', raw: NOTE_WITH_FM },
    ]);

    const result = await patchFrontmatter(ctx, {
      path: 'add-key.md',
      patch: { status: 'published' },
    });

    const written = await readFile(join(vaultRoot, 'add-key.md'), 'utf8');
    const fm = parseFrontmatter(written);

    expect(fm.keys).toContain('status');
    expect(fm.data?.status).toBe('published');
    // Original keys still present
    expect(fm.keys).toContain('title');
    expect(fm.keys).toContain('date');
    expect(fm.keys).toContain('author');
    expect(result.keysAdded).toEqual(['status']);
    expect(result.keysChanged).toEqual([]);
    expect(result.keysRemoved).toEqual([]);
  });

  it('updates an existing key — value changed, key order unchanged', async () => {
    await writeFile(join(vaultRoot, 'update-key.md'), NOTE_WITH_FM, 'utf8');
    const ctx = buildCtx(vaultRoot, [
      {
        id: 'update-key.md',
        title: 'My Note',
        body: '# Body\n\nSome content.\n',
        raw: NOTE_WITH_FM,
      },
    ]);

    const result = await patchFrontmatter(ctx, {
      path: 'update-key.md',
      patch: { title: 'Updated Title' },
    });

    const written = await readFile(join(vaultRoot, 'update-key.md'), 'utf8');
    const fm = parseFrontmatter(written);

    expect(fm.data?.title).toBe('Updated Title');

    // Key order: title, date, author — title was first, must remain first
    expect(fm.keys[0]).toBe('title');
    expect(fm.keys[1]).toBe('date');
    expect(fm.keys[2]).toBe('author');

    expect(result.keysChanged).toEqual(['title']);
    expect(result.keysAdded).toEqual([]);
    expect(result.keysRemoved).toEqual([]);
  });

  it('deletes a key when null value is passed', async () => {
    await writeFile(join(vaultRoot, 'delete-key.md'), NOTE_WITH_FM, 'utf8');
    const ctx = buildCtx(vaultRoot, [
      {
        id: 'delete-key.md',
        title: 'My Note',
        body: '# Body\n\nSome content.\n',
        raw: NOTE_WITH_FM,
      },
    ]);

    const result = await patchFrontmatter(ctx, {
      path: 'delete-key.md',
      patch: { author: null },
    });

    const written = await readFile(join(vaultRoot, 'delete-key.md'), 'utf8');
    const fm = parseFrontmatter(written);

    expect(fm.keys).not.toContain('author');
    // Other keys still present
    expect(fm.keys).toContain('title');
    expect(fm.keys).toContain('date');
    expect(result.keysRemoved).toEqual(['author']);
    expect(result.keysChanged).toEqual([]);
    expect(result.keysAdded).toEqual([]);
  });

  it('creates a --- block for a note without frontmatter', async () => {
    await writeFile(join(vaultRoot, 'no-fm.md'), NOTE_WITHOUT_FM, 'utf8');
    const ctx = buildCtx(vaultRoot, [
      { id: 'no-fm.md', title: 'No Frontmatter', body: NOTE_WITHOUT_FM, raw: NOTE_WITHOUT_FM },
    ]);

    await patchFrontmatter(ctx, {
      path: 'no-fm.md',
      patch: { title: 'Created' },
    });

    const written = await readFile(join(vaultRoot, 'no-fm.md'), 'utf8');
    expect(written).toMatch(/^---\n/);
    const fm = parseFrontmatter(written);
    expect(fm.present).toBe(true);
    expect(fm.data?.title).toBe('Created');
    // Original body preserved
    expect(written).toContain('# No Frontmatter');
  });

  it('throws "Path outside vault" for path traversal', async () => {
    const ctx = buildCtx(vaultRoot, []);
    await expect(
      patchFrontmatter(ctx, { path: '../../etc/passwd', patch: { x: 'y' } }),
    ).rejects.toThrow('Path outside vault');
  });
});
