import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import type { IndexedNote } from '../index/types.js';
import { ReadNoteInput, readNote } from './read_note.js';

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

### Sub

Sub content.
`;

let vaultRoot: string;
let ctx: ServerContext;

beforeAll(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-read-note-'));
  const index = new MiniSearch<IndexedNote>({
    idField: 'id',
    fields: ['title', 'body', 'tags', 'fmKeys'],
    storeFields: ['id', 'title', 'tags', 'sizeBytes', 'mtimeMs'],
  });
  ctx = { vaultRoot, index, notes: new Map(), backlinks: new Map() };
  await writeFile(join(vaultRoot, 'note.md'), NOTE, 'utf8');
  await writeFile(join(vaultRoot, 'hello.md'), '# Hello\n\nSome content here.\n', 'utf8');
});

afterAll(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Whole-note reads
// ---------------------------------------------------------------------------

describe('readNote — whole note', () => {
  it('returns path, content, bytesReturned, noteBytes', async () => {
    const result = await readNote(ctx, { path: 'hello.md' });
    expect(result.path).toBe('hello.md');
    expect(result.content).toBe('# Hello\n\nSome content here.\n');
    expect(result.bytesReturned).toBe(Buffer.byteLength(result.content, 'utf8'));
    expect(result.noteBytes).toBe(result.bytesReturned);
    expect(result.span).toBeUndefined();
  });

  it('throws "Path outside vault" for path traversal', async () => {
    await expect(readNote(ctx, { path: '../etc/passwd' })).rejects.toThrow('Path outside vault');
  });

  it('throws ENOENT for a non-existent file', async () => {
    await expect(readNote(ctx, { path: 'does-not-exist.md' })).rejects.toThrow(/ENOENT/);
  });
});

// ---------------------------------------------------------------------------
// section selector
// ---------------------------------------------------------------------------

describe('readNote — section selector', () => {
  it('returns the heading line + body up to the next sibling heading', async () => {
    const result = await readNote(ctx, { path: 'note.md', section: 'Decisions' });
    expect(result.content).toContain('## Decisions');
    expect(result.content).toContain('Decision one.');
    expect(result.content).toContain('Decision two.');
    // Sibling section not included
    expect(result.content).not.toContain('## Background');
    expect(result.content).not.toContain('Background content.');
  });

  it('content is byte-for-byte identical to the source slice', async () => {
    const result = await readNote(ctx, { path: 'note.md', section: 'Decisions' });
    expect(result.span).toBeDefined();
    const span = result.span;
    if (span === undefined) return;
    expect(NOTE.slice(span.charStart, span.charEnd)).toBe(result.content);
  });

  it('accepts heading text with leading # prefix', async () => {
    const result = await readNote(ctx, { path: 'note.md', section: '## Decisions' });
    expect(result.content).toContain('## Decisions');
  });

  it('bytesReturned is less than noteBytes for a section read', async () => {
    const result = await readNote(ctx, { path: 'note.md', section: 'Decisions' });
    expect(result.bytesReturned).toBeLessThan(result.noteBytes);
  });

  it('excludes frontmatter by default', async () => {
    const result = await readNote(ctx, { path: 'note.md', section: 'Decisions' });
    expect(result.content).not.toContain('title: My Note');
  });

  it('includes frontmatter when includeFrontmatter is true', async () => {
    const result = await readNote(ctx, {
      path: 'note.md',
      section: 'Decisions',
      includeFrontmatter: true,
    });
    expect(result.content).toContain('title: My Note');
    expect(result.content).toContain('## Decisions');
  });

  it('section includes nested sub-headings', async () => {
    const result = await readNote(ctx, { path: 'note.md', section: 'Background' });
    expect(result.content).toContain('### Sub');
    expect(result.content).toContain('Sub content.');
  });

  it('missing section throws structured error with available list', async () => {
    const err = await readNote(ctx, { path: 'note.md', section: 'Nonexistent' }).catch(
      (e: Error) => e,
    );
    expect(err).toBeInstanceOf(Error);
    const payload = JSON.parse((err as Error).message);
    expect(payload.error).toBe('section_not_found');
    expect(payload.available).toContain('Decisions');
  });
});

// ---------------------------------------------------------------------------
// block selector
// ---------------------------------------------------------------------------

describe('readNote — block selector', () => {
  it('returns the line containing the block anchor', async () => {
    const result = await readNote(ctx, { path: 'note.md', block: 'dec-ref' });
    expect(result.content).toContain('^dec-ref');
    expect(result.content).toContain('Decision two.');
  });

  it('accepts block id with leading ^ prefix', async () => {
    const result = await readNote(ctx, { path: 'note.md', block: '^dec-ref' });
    expect(result.content).toContain('^dec-ref');
  });

  it('content is byte-for-byte identical to the source slice', async () => {
    const result = await readNote(ctx, { path: 'note.md', block: 'dec-ref' });
    const span = result.span;
    if (span === undefined) return;
    expect(NOTE.slice(span.charStart, span.charEnd)).toBe(result.content);
  });

  it('missing block throws structured error with available list', async () => {
    const err = await readNote(ctx, { path: 'note.md', block: 'no-such-block' }).catch(
      (e: Error) => e,
    );
    const payload = JSON.parse((err as Error).message);
    expect(payload.error).toBe('block_not_found');
    expect(payload.available).toContain('dec-ref');
  });
});

// ---------------------------------------------------------------------------
// lines selector
// ---------------------------------------------------------------------------

describe('readNote — lines selector', () => {
  it('returns exactly the specified line range, verbatim', async () => {
    const rawLines = NOTE.split('\n');
    const result = await readNote(ctx, { path: 'note.md', lines: { from: 1, to: 3 } });
    const expected = `${rawLines.slice(0, 3).join('\n')}\n`;
    expect(result.content).toBe(expected);
  });

  it('content is byte-for-byte identical to the source slice', async () => {
    const result = await readNote(ctx, { path: 'note.md', lines: { from: 5, to: 8 } });
    const span = result.span;
    if (span === undefined) return;
    expect(NOTE.slice(span.charStart, span.charEnd)).toBe(result.content);
  });

  it('omitting to returns from the given line to EOF', async () => {
    const result = await readNote(ctx, { path: 'note.md', lines: { from: 5 } });
    expect(result.span).toBeDefined();
    expect(result.bytesReturned).toBeGreaterThan(0);
    expect(result.bytesReturned).toBeLessThan(result.noteBytes);
  });

  it('bytesReturned is less than noteBytes for a partial read', async () => {
    const result = await readNote(ctx, { path: 'note.md', lines: { from: 1, to: 3 } });
    expect(result.bytesReturned).toBeLessThan(result.noteBytes);
  });
});

// ---------------------------------------------------------------------------
// mutual exclusion
// ---------------------------------------------------------------------------

describe('readNote — validation', () => {
  it('rejects specifying both section and block', () => {
    expect(() =>
      ReadNoteInput.parse({ path: 'note.md', section: 'Decisions', block: 'dec-ref' }),
    ).toThrow();
  });

  it('rejects specifying both section and lines', () => {
    expect(() =>
      ReadNoteInput.parse({ path: 'note.md', section: 'Decisions', lines: { from: 1 } }),
    ).toThrow();
  });

  it('rejects specifying block and lines together', () => {
    expect(() =>
      ReadNoteInput.parse({ path: 'note.md', block: 'dec-ref', lines: { from: 1 } }),
    ).toThrow();
  });
});
