import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import type { IndexedNote } from '../index/types.js';
import { ReplaceInNoteInput, replaceInNote } from './replace_in_note.js';

const NOTE = `---
title: Test Note
tags: [alpha, beta]
---
# Heading

Hello world. Hello again.

## Sub

World is wonderful. hello lowercase.
`;

const NOTE_NO_FM = `# Plain

Hello world. Hello again.
`;

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
  vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-replace-in-note-'));
  await writeFile(join(vaultRoot, 'note.md'), NOTE, 'utf8');
  await writeFile(join(vaultRoot, 'no-fm.md'), NOTE_NO_FM, 'utf8');
});

afterEach(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

describe('replaceInNote — literal mode', () => {
  it('replaces all occurrences by default', async () => {
    const ctx = buildCtx(vaultRoot);
    const result = await replaceInNote(ctx, {
      path: 'note.md',
      find: 'Hello',
      replace: 'Hi',
      regex: false,
      caseSensitive: false,
      wholeWord: false,
      dryRun: false,
    });
    const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    expect(result.replacements).toBe(3); // Hello world, Hello again, hello lowercase
    expect(written).not.toContain('Hello');
    expect(written).not.toContain('hello');
    expect(written.match(/Hi /g)?.length).toBe(3);
  });

  it('caseSensitive: true only matches exact case', async () => {
    const ctx = buildCtx(vaultRoot);
    const result = await replaceInNote(ctx, {
      path: 'note.md',
      find: 'Hello',
      replace: 'Hi',
      regex: false,
      caseSensitive: true,
      wholeWord: false,
      dryRun: false,
    });
    const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    expect(result.replacements).toBe(2); // Hello world + Hello again (not hello lowercase)
    expect(written).toContain('hello lowercase');
  });

  it('limit caps the number of replacements', async () => {
    const ctx = buildCtx(vaultRoot);
    const result = await replaceInNote(ctx, {
      path: 'note.md',
      find: 'Hello',
      replace: 'Hi',
      regex: false,
      caseSensitive: false,
      wholeWord: false,
      limit: 1,
      dryRun: false,
    });
    expect(result.replacements).toBe(1);
    const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    // At least two Hello/hello occurrences still remain
    const remaining = (written.match(/hello/gi) ?? []).length;
    expect(remaining).toBe(2);
  });

  it('wholeWord: true does not match substrings', async () => {
    const content = `---\ntitle: t\n---\nHelloWorld hello\n`;
    await writeFile(join(vaultRoot, 'word.md'), content, 'utf8');
    const ctx = buildCtx(vaultRoot);
    const result = await replaceInNote(ctx, {
      path: 'word.md',
      find: 'hello',
      replace: 'hi',
      regex: false,
      caseSensitive: false,
      wholeWord: true,
      dryRun: false,
    });
    const written = await readFile(join(vaultRoot, 'word.md'), 'utf8');
    expect(result.replacements).toBe(1); // only standalone "hello", not "HelloWorld"
    expect(written).toContain('HelloWorld');
    expect(written).toContain('hi');
  });

  it('zero matches → no write, replacements: 0, success', async () => {
    const ctx = buildCtx(vaultRoot);
    const before = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    const result = await replaceInNote(ctx, {
      path: 'note.md',
      find: 'xyznotpresent',
      replace: 'anything',
      regex: false,
      caseSensitive: false,
      wholeWord: false,
      dryRun: false,
    });
    expect(result.replacements).toBe(0);
    expect(result.matches).toHaveLength(0);
    expect(result.bytesWritten).toBeUndefined();
    const after = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    expect(after).toBe(before);
  });

  it('frontmatter bytes are identical pre/post', async () => {
    const ctx = buildCtx(vaultRoot);
    const fmEnd = NOTE.indexOf('---\n', 4) + 4;
    const originalFm = NOTE.slice(0, fmEnd);
    await replaceInNote(ctx, {
      path: 'note.md',
      find: 'Hello',
      replace: 'Hi',
      regex: false,
      caseSensitive: false,
      wholeWord: false,
      dryRun: false,
    });
    const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    expect(written.slice(0, fmEnd)).toBe(originalFm);
  });

  it('works on notes without frontmatter', async () => {
    const ctx = buildCtx(vaultRoot);
    const result = await replaceInNote(ctx, {
      path: 'no-fm.md',
      find: 'Hello',
      replace: 'Greetings',
      regex: false,
      caseSensitive: false,
      wholeWord: false,
      dryRun: false,
    });
    expect(result.replacements).toBe(2);
    const written = await readFile(join(vaultRoot, 'no-fm.md'), 'utf8');
    expect(written).not.toContain('Hello');
    expect(written).toContain('Greetings');
    expect(result.frontmatterUnchanged).toBe(true);
  });

  it('returns bytesWritten matching file size', async () => {
    const ctx = buildCtx(vaultRoot);
    const result = await replaceInNote(ctx, {
      path: 'note.md',
      find: 'Hello',
      replace: 'Hi',
      regex: false,
      caseSensitive: false,
      wholeWord: false,
      dryRun: false,
    });
    const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    expect(result.bytesWritten).toBe(Buffer.byteLength(written, 'utf8'));
  });
});

describe('replaceInNote — regex mode', () => {
  it('regex mode replaces pattern matches', async () => {
    const ctx = buildCtx(vaultRoot);
    const result = await replaceInNote(ctx, {
      path: 'note.md',
      find: 'hel+o',
      replace: 'Hi',
      regex: true,
      caseSensitive: false,
      wholeWord: false,
      dryRun: false,
    });
    expect(result.replacements).toBe(3);
    const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    expect(written).not.toContain('Hello');
    expect(written).not.toContain('hello');
  });

  it('regex mode expands capture-group backreferences', async () => {
    const ctx = buildCtx(vaultRoot);
    await replaceInNote(ctx, {
      path: 'note.md',
      find: '(Hello|hello)',
      replace: '[$1]',
      regex: true,
      caseSensitive: true,
      wholeWord: false,
      dryRun: false,
    });
    const written = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    expect(written).toContain('[Hello]');
    expect(written).toContain('[hello]');
  });

  it('invalid regex throws before any IO', async () => {
    const ctx = buildCtx(vaultRoot);
    const before = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    await expect(
      replaceInNote(ctx, {
        path: 'note.md',
        find: '[invalid',
        replace: 'x',
        regex: true,
        caseSensitive: false,
        wholeWord: false,
        dryRun: false,
      }),
    ).rejects.toThrow('Invalid regex');
    const after = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    expect(after).toBe(before);
  });
});

describe('ReplaceInNoteInput — find length bound (ReDoS guard)', () => {
  const base = { path: 'note.md', replace: 'x' };

  it('rejects a find longer than 1000 chars', () => {
    const parsed = ReplaceInNoteInput.safeParse({ ...base, find: 'a'.repeat(1001) });
    expect(parsed.success).toBe(false);
  });

  it('accepts a find at the 1000-char cap', () => {
    const parsed = ReplaceInNoteInput.safeParse({ ...base, find: 'a'.repeat(1000) });
    expect(parsed.success).toBe(true);
  });
});

describe('replaceInNote — dryRun', () => {
  it('dryRun: true reports matches without writing', async () => {
    const ctx = buildCtx(vaultRoot);
    const before = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    const result = await replaceInNote(ctx, {
      path: 'note.md',
      find: 'Hello',
      replace: 'Hi',
      regex: false,
      caseSensitive: false,
      wholeWord: false,
      dryRun: true,
    });
    expect(result.replacements).toBe(3);
    expect(result.matches).toHaveLength(3);
    expect(result.bytesWritten).toBeUndefined();
    const after = await readFile(join(vaultRoot, 'note.md'), 'utf8');
    expect(after).toBe(before);
  });

  it('dryRun matches report correct line numbers (1-based)', async () => {
    const ctx = buildCtx(vaultRoot);
    const result = await replaceInNote(ctx, {
      path: 'note.md',
      find: 'Hello world',
      replace: '',
      regex: false,
      caseSensitive: true,
      wholeWord: false,
      dryRun: true,
    });
    expect(result.matches).toHaveLength(1);
    expect(result.matches.at(0)?.line).toBeGreaterThan(0);
    expect(result.matches.at(0)?.byteOffset).toBeGreaterThan(0);
  });
});

describe('replaceInNote — cache + safety', () => {
  it('updates the in-memory cache after a write', async () => {
    const ctx = buildCtx(vaultRoot);
    ctx.notes.set('note.md', {
      id: 'note.md',
      title: 'Test Note',
      body: '',
      tags: '',
      fmKeys: 'title tags',
      fm: null,
      raw: NOTE,
      sizeBytes: Buffer.byteLength(NOTE, 'utf8'),
      mtimeMs: Date.now(),
    });
    await replaceInNote(ctx, {
      path: 'note.md',
      find: 'Hello',
      replace: 'Hi',
      regex: false,
      caseSensitive: false,
      wholeWord: false,
      dryRun: false,
    });
    const cached = ctx.notes.get('note.md');
    expect(cached?.raw).toContain('Hi');
    expect(cached?.raw).not.toContain('Hello');
  });

  it('throws "Path outside vault" for path traversal', async () => {
    const ctx = buildCtx(vaultRoot);
    await expect(
      replaceInNote(ctx, {
        path: '../outside.md',
        find: 'x',
        replace: 'y',
        regex: false,
        caseSensitive: false,
        wholeWord: false,
        dryRun: false,
      }),
    ).rejects.toThrow('Path outside vault');
  });
});
