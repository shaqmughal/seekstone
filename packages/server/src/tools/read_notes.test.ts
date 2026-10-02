import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import type { IndexedNote } from '../index/types.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import { readNote } from './read_note.js';
import { allocate, ReadNotesInput, type ReadNotesItem, readNotes } from './read_notes.js';

const NOTE = `---
title: My Note
tags: [a]
---
# Top

Top intro.

## Decisions

Decision one.
Decision two. ^dec-ref

## Background

Background content.
`;

let vaultRoot: string;
let ctx: ServerContext;

beforeAll(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-read-notes-'));
  const index = new MiniSearch<IndexedNote>({ idField: 'id', fields: ['title', 'body'] });
  ctx = { vaultRoot, index, notes: new Map(), backlinks: new Map(), policy: PERMISSIVE_POLICY };
  await writeFile(join(vaultRoot, 'note.md'), NOTE, 'utf8');
  await writeFile(join(vaultRoot, 'hello.md'), '# Hello\n\nSome content here.\n', 'utf8');
  await writeFile(join(vaultRoot, 'big-a.md'), 'a'.repeat(1000), 'utf8');
  await writeFile(join(vaultRoot, 'big-b.md'), 'b'.repeat(1000), 'utf8');
  await writeFile(join(vaultRoot, 'tiny.md'), 'tiny', 'utf8');
  await writeFile(join(vaultRoot, 'emoji.md'), '🙂'.repeat(200), 'utf8');
  await writeFile(join(vaultRoot, 'empty.md'), '', 'utf8');
  await mkdir(join(vaultRoot, 'folder.md'));
});

afterAll(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

const run = (input: unknown) => readNotes(ctx, ReadNotesInput.parse(input));
const ok = (n: unknown) => n as ReadNotesItem;

describe('readNotes — consistency with read_note', () => {
  const items = [
    { path: 'hello.md' },
    { path: 'note.md', section: 'Decisions' },
    { path: 'note.md', section: '## Decisions', includeFrontmatter: true },
    { path: 'note.md', block: 'dec-ref' },
    { path: 'note.md', lines: { from: 2, to: 3 } },
  ];

  it('under budget, every item is exactly what readNote returns, in request order', async () => {
    const result = await run({ items });
    for (const [i, item] of items.entries()) {
      expect(result.notes[i]).toEqual(await readNote(ctx, item));
    }
    expect(result.notes.some((n) => 'truncated' in n)).toBe(false);
  });

  it('reports the budget and the bytes used', async () => {
    const result = await run({ items: [{ path: 'hello.md' }, { path: 'tiny.md' }] });
    expect(result.budgetBytes).toBe(16384);
    expect(result.bytesUsed).toBe(Buffer.byteLength('# Hello\n\nSome content here.\n') + 4);
  });

  it('returns duplicate items independently', async () => {
    const result = await run({ items: [{ path: 'tiny.md' }, { path: 'tiny.md' }] });
    expect(result.notes.map((n) => ok(n).content)).toEqual(['tiny', 'tiny']);
  });
});

describe('readNotes — byte budget', () => {
  it('splits an exceeded budget evenly and marks truncated items', async () => {
    const result = await run({
      items: [{ path: 'big-a.md' }, { path: 'big-b.md' }],
      budgetBytes: 600,
    });
    const [a, b] = result.notes.map(ok);
    expect(a?.content).toBe('a'.repeat(300));
    expect(a).toMatchObject({ bytesReturned: 300, noteBytes: 1000, truncated: true });
    expect(b).toMatchObject({ bytesReturned: 300, noteBytes: 1000, truncated: true });
    expect(result.bytesUsed).toBe(600);
  });

  it('keeps the contentHash of the whole file on a truncated item', async () => {
    const result = await run({ items: [{ path: 'big-a.md' }], budgetBytes: 256 });
    const whole = await readNote(ctx, { path: 'big-a.md' });
    expect(ok(result.notes[0]).contentHash).toBe(whole.contentHash);
  });

  it('gives a small note its full size and shares the slack among the rest', async () => {
    const result = await run({
      items: [{ path: 'tiny.md' }, { path: 'big-a.md' }, { path: 'big-b.md' }],
      budgetBytes: 604,
    });
    const [tiny, a, b] = result.notes.map(ok);
    expect(tiny?.content).toBe('tiny');
    expect(tiny).not.toHaveProperty('truncated');
    expect(a?.bytesReturned).toBe(300);
    expect(b?.bytesReturned).toBe(300);
    expect(result.bytesUsed).toBe(604);
  });

  it('never splits a multibyte character', async () => {
    // 🙂 is 4 bytes; a 257-byte share must back off to a character boundary.
    const result = await run({ items: [{ path: 'emoji.md' }], budgetBytes: 257 });
    const item = ok(result.notes[0]);
    expect(item.content).toBe('🙂'.repeat(64));
    expect(item.bytesReturned).toBe(256);
    expect(result.bytesUsed).toBeLessThanOrEqual(257);
  });

  it('gives every item a non-zero share at the minimum budget with 20 items', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      path: i % 2 ? 'big-a.md' : 'big-b.md',
    }));
    const result = await run({ items, budgetBytes: 256 });
    for (const n of result.notes) expect(ok(n).bytesReturned).toBeGreaterThan(0);
    expect(result.bytesUsed).toBeLessThanOrEqual(256);
  });
});

describe('allocate', () => {
  const alloc = (sizes: number[], budget: number) => {
    const entries = sizes.map((size) => ({ size, alloc: 0 }));
    allocate(entries, budget);
    return entries.map((e) => e.alloc);
  };

  it('keeps every size when the total fits', () => {
    expect(alloc([10, 20], 30)).toEqual([10, 20]);
  });

  it('hands the remainder of an uneven split to the first entries', () => {
    expect(alloc([100, 100, 100], 101)).toEqual([34, 34, 33]);
  });

  it('redistributes slack over several rounds', () => {
    expect(alloc([5, 40, 1000, 1000], 300)).toEqual([5, 40, 128, 127]);
  });

  it('leaves empty entries at zero', () => {
    expect(alloc([0, 500, 500], 300)).toEqual([0, 150, 150]);
  });
});

describe('readNotes — per-item errors', () => {
  it('maps failures to per-item errors without affecting siblings', async () => {
    const result = await run({
      items: [
        { path: 'missing.md' },
        { path: '../escape.md' },
        { path: 'note.md', section: 'Nope' },
        { path: 'note.md', block: 'nope' },
        { path: 'folder.md' },
        { path: 'hello.md' },
        { path: 'empty.md' },
      ],
    });
    expect(result.notes[0]).toEqual({ path: 'missing.md', error: 'not_found' });
    expect(result.notes[1]).toEqual({ path: '../escape.md', error: 'outside_vault' });
    expect(result.notes[2]).toMatchObject({
      path: 'note.md',
      error: 'section_not_found',
      target: 'Nope',
      available: ['Top', 'Decisions', 'Background'],
    });
    expect(result.notes[3]).toMatchObject({ error: 'block_not_found', available: ['dec-ref'] });
    expect(result.notes[4]).toMatchObject({ path: 'folder.md', error: 'read_failed' });
    expect(result.notes[4]).toHaveProperty('message');
    expect(ok(result.notes[5]).content).toBe('# Hello\n\nSome content here.\n');
    expect(ok(result.notes[6])).toMatchObject({ content: '', bytesReturned: 0 });
    expect(result.bytesUsed).toBe(Buffer.byteLength('# Hello\n\nSome content here.\n'));
  });
});

describe('ReadNotesInput — validation', () => {
  it('requires 1–20 items', () => {
    expect(ReadNotesInput.safeParse({ items: [] }).success).toBe(false);
    const items = Array.from({ length: 21 }, () => ({ path: 'a.md' }));
    expect(ReadNotesInput.safeParse({ items }).success).toBe(false);
  });

  it('bounds budgetBytes to 256–65536', () => {
    const items = [{ path: 'a.md' }];
    expect(ReadNotesInput.safeParse({ items, budgetBytes: 255 }).success).toBe(false);
    expect(ReadNotesInput.safeParse({ items, budgetBytes: 65537 }).success).toBe(false);
  });

  it('applies read_note validation to each item', () => {
    const items = [{ path: 'a.md', section: 'X', block: 'y' }];
    expect(ReadNotesInput.safeParse({ items }).success).toBe(false);
  });
});
