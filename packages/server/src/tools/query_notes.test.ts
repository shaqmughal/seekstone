import MiniSearch from 'minisearch';
import { describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import type { IndexedNote } from '../index/types.js';
import { QueryNotesInput, queryNotes } from './query_notes.js';

function buildCtx(
  notes: {
    id: string;
    title?: string;
    tags?: string;
    fm?: Record<string, unknown> | null;
    sizeBytes?: number;
    mtimeMs?: number;
  }[],
): ServerContext {
  const index = new MiniSearch<IndexedNote>({
    idField: 'id',
    fields: ['title', 'body', 'tags', 'fmKeys'],
  });
  const notesMap = new Map<string, IndexedNote>();
  for (const n of notes) {
    const title = n.title ?? n.id.slice(n.id.lastIndexOf('/') + 1).replace(/\.md$/, '');
    notesMap.set(n.id, {
      id: n.id,
      title,
      body: '',
      tags: n.tags ?? '',
      fmKeys: n.fm ? Object.keys(n.fm).join(' ') : '',
      fm: n.fm ?? null,
      raw: '',
      sizeBytes: n.sizeBytes ?? 100,
      mtimeMs: n.mtimeMs ?? Date.UTC(2026, 0, 15),
    });
  }
  return { vaultRoot: '/vault', index, notes: notesMap, backlinks: new Map() };
}

function parse(input: unknown) {
  return QueryNotesInput.parse(input);
}

describe('queryNotes: frontmatter predicates', () => {
  const ctx = buildCtx([
    { id: 'a.md', fm: { status: 'draft', priority: 5, published: false, tags: ['x', 'y'] } },
    { id: 'b.md', fm: { status: 'final', priority: 2, due: '2026-03-01' } },
    { id: 'c.md', fm: null },
  ]);

  it('eq matches scalar values', () => {
    const hits = queryNotes(ctx, parse({ where: [{ key: 'status', op: 'eq', value: 'draft' }] }));
    expect(hits.map((h) => h.path)).toEqual(['a.md']);
  });

  it('eq is loose across string/number forms', () => {
    const hits = queryNotes(ctx, parse({ where: [{ key: 'priority', op: 'eq', value: '5' }] }));
    expect(hits.map((h) => h.path)).toEqual(['a.md']);
  });

  it('eq matches booleans', () => {
    const hits = queryNotes(ctx, parse({ where: [{ key: 'published', op: 'eq', value: false }] }));
    expect(hits.map((h) => h.path)).toEqual(['a.md']);
  });

  it('ne excludes notes missing the key', () => {
    const hits = queryNotes(ctx, parse({ where: [{ key: 'status', op: 'ne', value: 'draft' }] }));
    expect(hits.map((h) => h.path)).toEqual(['b.md']);
  });

  it('exists and missing test key presence', () => {
    expect(
      queryNotes(ctx, parse({ where: [{ key: 'due', op: 'exists' }] })).map((h) => h.path),
    ).toEqual(['b.md']);
    expect(
      queryNotes(ctx, parse({ where: [{ key: 'due', op: 'missing' }] })).map((h) => h.path),
    ).toEqual(['a.md', 'c.md']);
  });

  it('contains matches array membership', () => {
    const hits = queryNotes(ctx, parse({ where: [{ key: 'tags', op: 'contains', value: 'y' }] }));
    expect(hits.map((h) => h.path)).toEqual(['a.md']);
  });

  it('contains matches case-insensitive substring on strings', () => {
    const hits = queryNotes(
      ctx,
      parse({ where: [{ key: 'status', op: 'contains', value: 'FIN' }] }),
    );
    expect(hits.map((h) => h.path)).toEqual(['b.md']);
  });

  it('gt/lte compare numbers', () => {
    expect(
      queryNotes(ctx, parse({ where: [{ key: 'priority', op: 'gt', value: 2 }] })).map(
        (h) => h.path,
      ),
    ).toEqual(['a.md']);
    expect(
      queryNotes(ctx, parse({ where: [{ key: 'priority', op: 'lte', value: 2 }] })).map(
        (h) => h.path,
      ),
    ).toEqual(['b.md']);
  });

  it('gte/lt compare ISO date strings lexicographically', () => {
    expect(
      queryNotes(ctx, parse({ where: [{ key: 'due', op: 'gte', value: '2026-01-01' }] })).map(
        (h) => h.path,
      ),
    ).toEqual(['b.md']);
    expect(
      queryNotes(ctx, parse({ where: [{ key: 'due', op: 'lt', value: '2026-01-01' }] })),
    ).toEqual([]);
  });

  it('multiple predicates AND together', () => {
    const hits = queryNotes(
      ctx,
      parse({
        where: [
          { key: 'status', op: 'exists' },
          { key: 'priority', op: 'lt', value: 3 },
        ],
      }),
    );
    expect(hits.map((h) => h.path)).toEqual(['b.md']);
  });

  it('comparison ops never match objects or missing values', () => {
    expect(queryNotes(ctx, parse({ where: [{ key: 'nope', op: 'gt', value: 0 }] }))).toEqual([]);
    expect(queryNotes(ctx, parse({ where: [{ key: 'tags', op: 'gt', value: 0 }] }))).toEqual([]);
  });
});

describe('queryNotes: file filters', () => {
  const ctx = buildCtx([
    { id: 'projects/a.md', tags: 'work', sizeBytes: 50, mtimeMs: Date.UTC(2026, 5, 1) },
    { id: 'projects/b.md', tags: 'home', sizeBytes: 500, mtimeMs: Date.UTC(2026, 5, 20) },
    { id: 'daily/c.md', tags: 'work log', sizeBytes: 5000, mtimeMs: Date.UTC(2026, 6, 2) },
  ]);

  it('folder restricts to a path prefix', () => {
    const hits = queryNotes(ctx, parse({ folder: 'projects/' }));
    expect(hits.map((h) => h.path)).toEqual(['projects/a.md', 'projects/b.md']);
  });

  it('tag filter accepts an optional # prefix', () => {
    const hits = queryNotes(ctx, parse({ tag: '#work' }));
    expect(hits.map((h) => h.path)).toEqual(['daily/c.md', 'projects/a.md']);
  });

  it('modifiedAfter/modifiedBefore bound mtime', () => {
    const hits = queryNotes(
      ctx,
      parse({ modifiedAfter: '2026-06-10', modifiedBefore: '2026-07-01' }),
    );
    expect(hits.map((h) => h.path)).toEqual(['projects/b.md']);
  });

  it('minSizeBytes/maxSizeBytes bound size', () => {
    const hits = queryNotes(ctx, parse({ minSizeBytes: 100, maxSizeBytes: 1000 }));
    expect(hits.map((h) => h.path)).toEqual(['projects/b.md']);
  });
});

describe('queryNotes: output shape', () => {
  const ctx = buildCtx([
    {
      id: 'a.md',
      title: 'Custom Title',
      tags: 'x y',
      fm: { status: 'draft', priority: 5 },
      sizeBytes: 42,
      mtimeMs: Date.UTC(2026, 6, 1, 12),
    },
    { id: 'b.md', fm: { status: 'final' } },
  ]);

  it('default output is just path (+ title when it differs from basename)', () => {
    const hits = queryNotes(ctx, parse({}));
    expect(hits).toEqual([{ path: 'a.md', title: 'Custom Title' }, { path: 'b.md' }]);
  });

  it('select returns requested fm keys, skipping absent ones', () => {
    const hits = queryNotes(ctx, parse({ select: ['status', 'priority'] }));
    expect(hits[0]?.fm).toEqual({ status: 'draft', priority: 5 });
    expect(hits[1]?.fm).toEqual({ status: 'final' });
  });

  it('select supports the mtime/size/tags specials', () => {
    const hits = queryNotes(ctx, parse({ select: ['mtime', 'size', 'tags'] }));
    expect(hits[0]).toEqual({
      path: 'a.md',
      title: 'Custom Title',
      mtime: '2026-07-01T12:00:00.000Z',
      sizeBytes: 42,
      tags: ['x', 'y'],
    });
    // b.md has no tags — the field is omitted, not empty.
    expect(hits[1]?.tags).toBeUndefined();
  });
});

describe('queryNotes: sort and limit', () => {
  const ctx = buildCtx([
    { id: 'b.md', title: 'Beta', sizeBytes: 300, mtimeMs: 3000 },
    { id: 'a.md', title: 'Zulu', sizeBytes: 100, mtimeMs: 2000 },
    { id: 'c.md', title: 'Alpha', sizeBytes: 200, mtimeMs: 1000 },
  ]);

  it('sorts by path ascending by default', () => {
    expect(queryNotes(ctx, parse({})).map((h) => h.path)).toEqual(['a.md', 'b.md', 'c.md']);
  });

  it('sorts by mtime descending', () => {
    expect(queryNotes(ctx, parse({ sort: 'mtime', order: 'desc' })).map((h) => h.path)).toEqual([
      'b.md',
      'a.md',
      'c.md',
    ]);
  });

  it('sorts by size and by title', () => {
    expect(queryNotes(ctx, parse({ sort: 'size' })).map((h) => h.path)).toEqual([
      'a.md',
      'c.md',
      'b.md',
    ]);
    expect(queryNotes(ctx, parse({ sort: 'title' })).map((h) => h.path)).toEqual([
      'c.md',
      'b.md',
      'a.md',
    ]);
  });

  it('limit truncates after sorting', () => {
    expect(
      queryNotes(ctx, parse({ sort: 'mtime', order: 'desc', limit: 1 })).map((h) => h.path),
    ).toEqual(['b.md']);
  });
});

describe('QueryNotesInput validation', () => {
  it('rejects value-requiring ops without a value', () => {
    expect(() => parse({ where: [{ key: 'status', op: 'eq' }] })).toThrow();
  });

  it('allows exists/missing without a value', () => {
    expect(() => parse({ where: [{ key: 'status', op: 'exists' }] })).not.toThrow();
  });

  it('rejects unparseable dates', () => {
    expect(() => parse({ modifiedAfter: 'not-a-date' })).toThrow();
  });
});
