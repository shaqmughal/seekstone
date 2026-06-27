import MiniSearch from 'minisearch';
import { describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import type { IndexedNote } from '../index/types.js';
import { search } from './search.js';

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
  return { vaultRoot, index, notes: notesMap, backlinks: new Map() };
}

// Three notes: one in daily/, one in projects/, one tagged #work
const SAMPLE_NOTES = [
  {
    id: 'daily/2026-05-28.md',
    title: 'Daily Note',
    body: 'Went for a morning run and reviewed quarterly metrics.',
    tags: 'daily',
  },
  {
    id: 'projects/roadmap.md',
    title: 'Roadmap Planning',
    body: 'Q3 roadmap planning session with engineering team.',
    tags: 'project planning',
  },
  {
    id: 'work-tasks.md',
    title: 'Work Tasks',
    body: 'Reviewed pull requests and fixed outstanding bugs.',
    tags: 'work',
  },
];

describe('search', () => {
  it('basic search returns hits with path, title, score, excerpt, tags', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const hits = search(ctx, { query: 'roadmap', limit: 10 });
    expect(hits.length).toBeGreaterThan(0);
    const hit = hits[0];
    if (!hit) throw new Error('expected at least one hit');
    expect(typeof hit.path).toBe('string');
    // 'Roadmap Planning' differs from basename 'roadmap', so title is present.
    expect(typeof hit.title).toBe('string');
    expect(typeof hit.score).toBe('number');
    expect(typeof hit.excerpt).toBe('string');
    expect(Array.isArray(hit.tags)).toBe(true);
  });

  it('omits title when it equals the path basename', () => {
    const ctx = buildCtx('/vault', [
      { id: 'notes/widget.md', title: 'widget', body: 'a widget gadget thing' },
    ]);
    const hits = search(ctx, { query: 'widget', limit: 10 });
    expect(hits[0]?.path).toBe('notes/widget.md');
    expect(hits[0]?.title).toBeUndefined();
  });

  it('keeps title when it differs from the basename', () => {
    const ctx = buildCtx('/vault', [
      { id: 'notes/widget.md', title: 'My Widget', body: 'a widget gadget thing' },
    ]);
    const hits = search(ctx, { query: 'widget', limit: 10 });
    expect(hits[0]?.title).toBe('My Widget');
  });

  it('omits tags when the note has none', () => {
    const ctx = buildCtx('/vault', [
      { id: 'notes/widget.md', title: 'My Widget', body: 'a widget gadget thing', tags: '' },
    ]);
    const hits = search(ctx, { query: 'widget', limit: 10 });
    expect(hits[0]?.tags).toBeUndefined();
  });

  it('rounds score to at most 2 decimal places', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const hits = search(ctx, { query: 'roadmap', limit: 10 });
    const score = hits[0]?.score ?? 0;
    expect(score).toBe(Math.round(score * 100) / 100);
  });

  it('excerptLength caps the excerpt and a larger value returns more context', () => {
    const longBody = `intro ${'x '.repeat(400)}TARGET${' y'.repeat(400)} outro`;
    const ctx = buildCtx('/vault', [{ id: 'notes/long.md', title: 'long', body: longBody }]);
    const len = (s?: string) => (s ?? '').replace(/…/g, '').length;
    // extractExcerpt may overrun maxLen by the matched term's length; allow that slack.
    const slack = 'TARGET'.length;
    const short = search(ctx, { query: 'TARGET', limit: 10, excerptLength: 40 });
    const long = search(ctx, { query: 'TARGET', limit: 10, excerptLength: 400 });
    expect(len(short[0]?.excerpt)).toBeLessThanOrEqual(40 + slack);
    expect(len(long[0]?.excerpt)).toBeGreaterThan(len(short[0]?.excerpt));
  });

  it('defaults excerptLength to 120 when omitted', () => {
    const longBody = `intro ${'x '.repeat(400)}TARGET${' y'.repeat(400)} outro`;
    const ctx = buildCtx('/vault', [{ id: 'notes/long.md', title: 'long', body: longBody }]);
    const len = (s?: string) => (s ?? '').replace(/…/g, '').length;
    const hits = search(ctx, { query: 'TARGET', limit: 10 });
    expect(len(hits[0]?.excerpt)).toBeLessThanOrEqual(120 + 'TARGET'.length);
    expect(len(hits[0]?.excerpt)).toBeGreaterThan(40);
  });

  it('folder filter excludes notes from other folders', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    // "planning" matches both "roadmap.md" body and potentially others
    const hits = search(ctx, { query: 'planning', folder: 'projects/', limit: 10 });
    for (const hit of hits) {
      expect(hit.path).toMatch(/^projects\//);
    }
  });

  it('tag filter excludes notes without matching tag', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    // "run" matches the daily note body, but tag filter restricts to #work
    const hits = search(ctx, { query: 'reviewed', tag: 'work', limit: 10 });
    for (const hit of hits) {
      expect(hit.tags).toContain('work');
    }
  });

  it('limit is respected', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    // broad query likely hits multiple
    const hits = search(ctx, { query: 'note', limit: 1 });
    expect(hits.length).toBeLessThanOrEqual(1);
  });

  it('returns [] for a query with no matches', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const hits = search(ctx, { query: 'zzzzabsolutelyunmatchablexyz', limit: 10 });
    expect(hits).toEqual([]);
  });

  it('case-insensitive search works', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const hitsLower = search(ctx, { query: 'roadmap', limit: 10 });
    const hitsUpper = search(ctx, { query: 'ROADMAP', limit: 10 });
    // Both should find the roadmap note
    expect(hitsLower.length).toBeGreaterThan(0);
    expect(hitsUpper.length).toBeGreaterThan(0);
    expect(hitsLower[0]?.path).toBe(hitsUpper[0]?.path);
  });

  it('hit for a note in daily/ has the correct path', () => {
    const ctx = buildCtx('/vault', SAMPLE_NOTES);
    const hits = search(ctx, { query: 'morning', limit: 10 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.path).toBe('daily/2026-05-28.md');
  });
});
