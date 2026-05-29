import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import type { IndexedNote } from '../index/types.js';
import { appendNote } from './append_note.js';

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
title: Test Note
tags: [work]
---
# Hello

Body line one.
`;

const NOTE_WITHOUT_FM = `# No Frontmatter

Just a body here.
`;

beforeAll(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-append-note-'));
  await writeFile(join(vaultRoot, 'with-fm.md'), NOTE_WITH_FM, 'utf8');
  await writeFile(join(vaultRoot, 'without-fm.md'), NOTE_WITHOUT_FM, 'utf8');
});

afterAll(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

describe('appendNote', () => {
  it('preserves frontmatter byte-for-byte and appends content after body', async () => {
    await writeFile(join(vaultRoot, 'with-fm.md'), NOTE_WITH_FM, 'utf8');
    const ctx = buildCtx(vaultRoot, [
      {
        id: 'with-fm.md',
        title: 'Test Note',
        body: '# Hello\n\nBody line one.\n',
        raw: NOTE_WITH_FM,
      },
    ]);

    const result = await appendNote(ctx, { path: 'with-fm.md', content: 'Appended line.' });

    const written = await readFile(join(vaultRoot, 'with-fm.md'), 'utf8');

    // Frontmatter block must be byte-identical to original
    const fmEnd = NOTE_WITH_FM.indexOf('---\n', 4) + 4;
    const originalFm = NOTE_WITH_FM.slice(0, fmEnd);
    const writtenFm = written.slice(0, fmEnd);
    expect(writtenFm).toBe(originalFm);

    // Appended content must appear in the file
    expect(written).toContain('Appended line.');

    // bytesWritten matches the actual file content
    expect(result.bytesWritten).toBe(Buffer.byteLength(written, 'utf8'));
    expect(result.path).toBe('with-fm.md');
  });

  it('appends content to note without frontmatter', async () => {
    await writeFile(join(vaultRoot, 'without-fm.md'), NOTE_WITHOUT_FM, 'utf8');
    const ctx = buildCtx(vaultRoot, [
      { id: 'without-fm.md', title: 'No Frontmatter', body: NOTE_WITHOUT_FM, raw: NOTE_WITHOUT_FM },
    ]);

    await appendNote(ctx, { path: 'without-fm.md', content: 'Appended to no-fm note.' });

    const written = await readFile(join(vaultRoot, 'without-fm.md'), 'utf8');
    expect(written).toContain('# No Frontmatter');
    expect(written).toContain('Appended to no-fm note.');
  });

  it('bytesWritten matches Buffer.byteLength of the written file', async () => {
    await writeFile(join(vaultRoot, 'with-fm.md'), NOTE_WITH_FM, 'utf8');
    const ctx = buildCtx(vaultRoot, [
      {
        id: 'with-fm.md',
        title: 'Test Note',
        body: '# Hello\n\nBody line one.\n',
        raw: NOTE_WITH_FM,
      },
    ]);

    const result = await appendNote(ctx, { path: 'with-fm.md', content: 'Size check.' });
    const written = await readFile(join(vaultRoot, 'with-fm.md'), 'utf8');
    expect(result.bytesWritten).toBe(Buffer.byteLength(written, 'utf8'));
  });

  it('updates the in-memory cache (ctx.notes)', async () => {
    await writeFile(join(vaultRoot, 'with-fm.md'), NOTE_WITH_FM, 'utf8');
    const ctx = buildCtx(vaultRoot, [
      {
        id: 'with-fm.md',
        title: 'Test Note',
        body: '# Hello\n\nBody line one.\n',
        raw: NOTE_WITH_FM,
      },
    ]);

    await appendNote(ctx, { path: 'with-fm.md', content: 'Cache update check.' });

    const cached = ctx.notes.get('with-fm.md');
    expect(cached).toBeDefined();
    expect(cached?.body).toContain('Cache update check.');
    expect(cached?.raw).toContain('Cache update check.');
  });

  it('throws "Path outside vault" for path traversal', async () => {
    const ctx = buildCtx(vaultRoot, []);
    await expect(appendNote(ctx, { path: '../outside.md', content: 'Bad.' })).rejects.toThrow(
      'Path outside vault',
    );
  });
});
