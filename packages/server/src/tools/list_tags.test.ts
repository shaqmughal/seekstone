import MiniSearch from 'minisearch';
import { describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import type { IndexedNote } from '../index/types.js';
import { ListTagsInput, listTags } from './list_tags.js';

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
  { id: 'daily/2026-01-03.md', title: 'Jan 3', body: 'Day three.', tags: 'daily' },
  { id: 'projects/alpha.md', title: 'Alpha', body: 'Alpha.', tags: 'work area/work' },
  { id: 'projects/beta.md', title: 'Beta', body: 'Beta.', tags: 'work area/work' },
  { id: 'projects/gamma.md', title: 'Gamma', body: 'Gamma.', tags: 'work' },
  { id: 'inbox.md', title: 'Inbox', body: 'Unsorted.', tags: '' },
];

const parse = (input: Parameters<typeof ListTagsInput.parse>[0]) => ListTagsInput.parse(input);

describe('listTags', () => {
  it('returns all tags with correct counts', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const { tags } = listTags(ctx, parse({ sort: 'name' }));
    const byTag = Object.fromEntries(tags.map((t) => [t.tag, t.count]));
    expect(byTag.daily).toBe(3);
    expect(byTag.work).toBe(3);
    expect(byTag['area/work']).toBe(2);
  });

  it('returns total matching the number of tag entries', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const result = listTags(ctx, parse({}));
    expect(result.total).toBe(result.tags.length);
  });

  it('excludes notes with no tags', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const { tags } = listTags(ctx, parse({}));
    expect(tags.every((t) => t.tag !== '')).toBe(true);
  });

  it('sorts by count descending by default', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const { tags } = listTags(ctx, parse({}));
    const counts = tags.map((t) => t.count);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i - 1] ?? 0).toBeGreaterThanOrEqual(counts[i] ?? 0);
    }
  });

  it('sorts alphabetically when sort=name', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const { tags } = listTags(ctx, parse({ sort: 'name' }));
    const names = tags.map((t) => t.tag);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('filters by pattern substring', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const { tags } = listTags(ctx, parse({ pattern: 'work' }));
    expect(tags.map((t) => t.tag).sort()).toEqual(['area/work', 'work']);
  });

  it('filters by minCount', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const { tags } = listTags(ctx, parse({ minCount: 3 }));
    expect(tags.every((t) => t.count >= 3)).toBe(true);
    expect(tags.map((t) => t.tag).sort()).toEqual(['daily', 'work']);
  });

  it('detects parent for nested tags', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const { tags } = listTags(ctx, parse({ sort: 'name' }));
    const nested = tags.find((t) => t.tag === 'area/work');
    expect(nested).toBeDefined();
    if (!nested) return;
    expect(nested.parent).toBe('area');
  });

  it('top-level tags have no parent', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const { tags } = listTags(ctx, parse({ sort: 'name' }));
    const flat = tags.filter((t) => !t.tag.includes('/'));
    expect(flat.every((t) => t.parent === undefined)).toBe(true);
  });

  it('returns empty result for an empty vault', () => {
    const ctx = buildCtx('/vault', []);
    const result = listTags(ctx, parse({}));
    expect(result.tags).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('returns empty when pattern matches nothing', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const result = listTags(ctx, parse({ pattern: 'zzznomatch' }));
    expect(result.tags).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('stable sort: equal-count tags are sorted alphabetically', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const { tags } = listTags(ctx, parse({}));
    const countThree = tags.filter((t) => t.count === 3).map((t) => t.tag);
    expect(countThree).toEqual([...countThree].sort((a, b) => a.localeCompare(b)));
  });
});
