import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import type { IndexedNote } from '../index/types.js';
import { patchNote } from './patch_note.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const NOTE = `---
title: Test
tags: [a]
---
# Top

Top intro.

## Log

Log entry one.
Log entry two. ^log-ref

## Config

Config content.

### Sub

Sub content.
`;

const NOTE_NO_FM = `# First

First content.

## Second

Second content.
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCtx(vaultRoot: string): ServerContext {
  const index = new MiniSearch<IndexedNote>({
    idField: 'id',
    fields: ['title', 'body', 'tags', 'fmKeys'],
    storeFields: ['id', 'title', 'tags', 'sizeBytes', 'mtimeMs'],
    searchOptions: { boost: { title: 3, tags: 2, body: 1 }, fuzzy: 0.2, prefix: true },
  });
  return { vaultRoot, index, notes: new Map(), backlinks: new Map() };
}

let vaultRoot: string;

beforeEach(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-patch-note-'));
  await writeFile(join(vaultRoot, 'note.md'), NOTE, 'utf8');
  await writeFile(join(vaultRoot, 'no-fm.md'), NOTE_NO_FM, 'utf8');
});

afterEach(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Acceptance criteria
// ---------------------------------------------------------------------------

describe('patchNote — heading target', () => {
  it('append inserts content at end of section, before next heading', async () => {
    const ctx = buildCtx(vaultRoot);
    await patchNote(ctx, {
      path: 'note.md',
      target: { heading: 'Log' },
      operation: 'append',
      content: 'Log entry three.',
      createIfMissing: false,
    });
    const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    // New content appears before ## Config
    const configIdx = written.indexOf('## Config');
    const newIdx = written.indexOf('Log entry three.');
    expect(newIdx).toBeGreaterThan(0);
    expect(newIdx).toBeLessThan(configIdx);
    // Original entries still present
    expect(written).toContain('Log entry one.');
    expect(written).toContain('Log entry two. ^log-ref');
  });

  it('prepend inserts content immediately after the heading line', async () => {
    const ctx = buildCtx(vaultRoot);
    await patchNote(ctx, {
      path: 'note.md',
      target: { heading: 'Log' },
      operation: 'prepend',
      content: 'Prepended entry.',
      createIfMissing: false,
    });
    const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    const headingIdx = written.indexOf('## Log\n');
    const prependIdx = written.indexOf('Prepended entry.');
    expect(prependIdx).toBeGreaterThan(headingIdx);
    // Original content still follows
    expect(written).toContain('Log entry one.');
    const prependEnd = prependIdx + 'Prepended entry.'.length;
    const logOneIdx = written.indexOf('Log entry one.');
    expect(logOneIdx).toBeGreaterThan(prependEnd);
  });

  it('replace swaps only the targeted section body', async () => {
    const ctx = buildCtx(vaultRoot);
    await patchNote(ctx, {
      path: 'note.md',
      target: { heading: 'Log' },
      operation: 'replace',
      content: 'Replaced content.',
      createIfMissing: false,
    });
    const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    expect(written).toContain('Replaced content.');
    expect(written).not.toContain('Log entry one.');
    expect(written).not.toContain('Log entry two.');
  });

  it('sibling section is byte-identical after patch', async () => {
    const ctx = buildCtx(vaultRoot);
    const before = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    const configStart = before.indexOf('## Config');
    const configSection = before.slice(configStart);

    await patchNote(ctx, {
      path: 'note.md',
      target: { heading: 'Log' },
      operation: 'append',
      content: 'New log.',
      createIfMissing: false,
    });

    const after = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    const configStartAfter = after.indexOf('## Config');
    expect(after.slice(configStartAfter)).toBe(configSection);
  });

  it('frontmatter bytes are identical pre/post for every body patch', async () => {
    const ctx = buildCtx(vaultRoot);
    const fmEnd = NOTE.indexOf('---\n', 4) + 4;
    const originalFm = NOTE.slice(0, fmEnd);

    for (const operation of ['append', 'prepend', 'replace'] as const) {
      await writeFile(join(vaultRoot, 'note.md'), NOTE, 'utf8');
      await patchNote(ctx, {
        path: 'note.md',
        target: { heading: 'Log' },
        operation,
        content: 'Test content.',
        createIfMissing: false,
      });
      const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
      expect(written.slice(0, fmEnd)).toBe(originalFm);
    }
  });

  it('heading match is case-insensitive', async () => {
    const ctx = buildCtx(vaultRoot);
    await expect(
      patchNote(ctx, {
        path: 'note.md',
        target: { heading: 'log' },
        operation: 'append',
        content: 'Case insensitive.',
        createIfMissing: false,
      }),
    ).resolves.toMatchObject({ frontmatterUnchanged: true });
  });

  it('missing heading without createIfMissing throws with available list', async () => {
    const ctx = buildCtx(vaultRoot);
    const err = await patchNote(ctx, {
      path: 'note.md',
      target: { heading: 'Nonexistent' },
      operation: 'append',
      content: 'x',
      createIfMissing: false,
    }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    const payload = JSON.parse((err as Error).message);
    expect(payload.error).toBe('heading_not_found');
    expect(payload.available).toContain('Log');
    // No write occurred
    const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    expect(written).toBe(NOTE);
  });

  it('createIfMissing appends a new heading and content', async () => {
    const ctx = buildCtx(vaultRoot);
    await patchNote(ctx, {
      path: 'note.md',
      target: { heading: 'New Section' },
      operation: 'append',
      content: 'Brand new content.',
      createIfMissing: true,
    });
    const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    expect(written).toContain('## New Section');
    expect(written).toContain('Brand new content.');
    // Original content preserved
    expect(written).toContain('## Log');
    expect(written).toContain('## Config');
  });

  it('works on notes without frontmatter', async () => {
    const ctx = buildCtx(vaultRoot);
    await patchNote(ctx, {
      path: 'no-fm.md',
      target: { heading: 'Second' },
      operation: 'append',
      content: 'Appended to second.',
      createIfMissing: false,
    });
    const written = await readFile(join(vaultRoot, 'no-fm.md'), 'utf8');
    expect(written).toContain('Appended to second.');
    expect(written).toContain('Second content.');
  });

  it('returns bytesWritten matching file size', async () => {
    const ctx = buildCtx(vaultRoot);
    const result = await patchNote(ctx, {
      path: 'note.md',
      target: { heading: 'Log' },
      operation: 'append',
      content: 'Size check.',
      createIfMissing: false,
    });
    const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    expect(result.bytesWritten).toBe(Buffer.byteLength(written, 'utf8'));
    expect(result.frontmatterUnchanged).toBe(true);
  });
});

describe('patchNote — block target', () => {
  it('append inserts content after the block line', async () => {
    const ctx = buildCtx(vaultRoot);
    await patchNote(ctx, {
      path: 'note.md',
      target: { block: 'log-ref' },
      operation: 'append',
      content: 'After the block.',
      createIfMissing: false,
    });
    const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    const blockIdx = written.indexOf('Log entry two. ^log-ref');
    const afterIdx = written.indexOf('After the block.');
    expect(afterIdx).toBeGreaterThan(blockIdx);
  });

  it('replace swaps the block line', async () => {
    const ctx = buildCtx(vaultRoot);
    await patchNote(ctx, {
      path: 'note.md',
      target: { block: 'log-ref' },
      operation: 'replace',
      content: 'Replaced block content.',
      createIfMissing: false,
    });
    const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    expect(written).toContain('Replaced block content.');
    expect(written).not.toContain('Log entry two. ^log-ref');
  });

  it('frontmatter bytes unchanged for block patch', async () => {
    const ctx = buildCtx(vaultRoot);
    const fmEnd = NOTE.indexOf('---\n', 4) + 4;
    const originalFm = NOTE.slice(0, fmEnd);
    await patchNote(ctx, {
      path: 'note.md',
      target: { block: 'log-ref' },
      operation: 'append',
      content: 'FM safety check.',
      createIfMissing: false,
    });
    const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    expect(written.slice(0, fmEnd)).toBe(originalFm);
  });

  it('missing block throws with available list', async () => {
    const ctx = buildCtx(vaultRoot);
    const err = await patchNote(ctx, {
      path: 'note.md',
      target: { block: 'nonexistent' },
      operation: 'append',
      content: 'x',
      createIfMissing: false,
    }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    const payload = JSON.parse((err as Error).message);
    expect(payload.error).toBe('block_not_found');
    expect(payload.available).toContain('log-ref');
  });
});

describe('patchNote — cache + safety', () => {
  it('updates the in-memory cache after patch', async () => {
    const ctx = buildCtx(vaultRoot);
    // Seed the cache entry
    ctx.notes.set('note.md', {
      id: 'note.md',
      title: 'Test',
      body: '',
      tags: '',
      fmKeys: 'title tags',
      raw: NOTE,
      sizeBytes: Buffer.byteLength(NOTE, 'utf8'),
      mtimeMs: Date.now(),
    });
    await patchNote(ctx, {
      path: 'note.md',
      target: { heading: 'Log' },
      operation: 'append',
      content: 'Cache check.',
      createIfMissing: false,
    });
    const cached = ctx.notes.get('note.md');
    expect(cached?.raw).toContain('Cache check.');
    expect(cached?.body).toContain('Cache check.');
  });

  it('throws "Path outside vault" for traversal attempts', async () => {
    const ctx = buildCtx(vaultRoot);
    await expect(
      patchNote(ctx, {
        path: '../outside.md',
        target: { heading: 'x' },
        operation: 'append',
        content: 'x',
        createIfMissing: false,
      }),
    ).rejects.toThrow('Path outside vault');
  });
});
