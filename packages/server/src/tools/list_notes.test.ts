import MiniSearch from 'minisearch';
import { describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import type { IndexedNote } from '../index/types.js';
import { listNotes } from './list_notes.js';

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

const SAMPLE_NOTES = [
  { id: 'daily/2026-01-01.md', title: 'Jan 1', body: 'Day one.', tags: 'daily' },
  { id: 'daily/2026-01-02.md', title: 'Jan 2', body: 'Day two.', tags: 'daily' },
  { id: 'projects/alpha.md', title: 'Alpha', body: 'Project alpha.', tags: 'work project' },
  { id: 'projects/beta.md', title: 'Beta', body: 'Project beta.', tags: 'work' },
  { id: 'inbox.md', title: 'Inbox', body: 'Unsorted.', tags: '' },
];

describe('listNotes', () => {
  it('lists all notes when no filter is provided', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const results = listNotes(ctx, { limit: 100 });
    expect(results).toHaveLength(5);
  });

  it('filters by folder prefix — only notes whose path starts with the folder', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const results = listNotes(ctx, { folder: 'daily/', limit: 100 });
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.path).toMatch(/^daily\//);
    }
  });

  it('filters by tag with # prefix stripped', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const results = listNotes(ctx, { tag: '#work', limit: 100 });
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.tags).toContain('work');
    }
  });

  it('filters by tag without # prefix', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const results = listNotes(ctx, { tag: 'work', limit: 100 });
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.tags).toContain('work');
    }
  });

  it('respects the limit', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const results = listNotes(ctx, { limit: 2 });
    expect(results).toHaveLength(2);
  });

  it('returns results sorted by path', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const results = listNotes(ctx, { limit: 100 });
    const paths = results.map((r) => r.path);
    expect(paths).toEqual([...paths].sort((a, b) => a.localeCompare(b)));
  });

  it('returns [] when folder filter matches nothing', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const results = listNotes(ctx, { folder: 'archive/', limit: 100 });
    expect(results).toEqual([]);
  });

  it('returns [] when tag filter matches nothing', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const results = listNotes(ctx, { tag: 'nonexistent', limit: 100 });
    expect(results).toEqual([]);
  });

  it('includes path, title, tags array, and sizeBytes in each entry', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const results = listNotes(ctx, { limit: 100 });
    for (const r of results) {
      expect(typeof r.path).toBe('string');
      expect(typeof r.title).toBe('string');
      expect(Array.isArray(r.tags)).toBe(true);
      expect(typeof r.sizeBytes).toBe('number');
    }
  });
});
