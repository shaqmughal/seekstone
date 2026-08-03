import MiniSearch from 'minisearch';
import { describe, expect, it } from 'vitest';
import type { BacklinkRef, ServerContext } from '../context.js';
import type { IndexedNote } from '../index/types.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import { contextPack } from './context_pack.js';

function buildCtx(
  vaultRoot: string,
  notes: Array<{
    id: string;
    title: string;
    body: string;
    tags?: string;
    fmKeys?: string;
    fm?: Record<string, unknown> | null;
    raw?: string;
  }>,
  backlinks?: Map<string, BacklinkRef[]>,
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
    fm: n.fm ?? null,
    raw: n.raw ?? n.body,
    sizeBytes: Buffer.byteLength(n.raw ?? n.body, 'utf8'),
    mtimeMs: Date.now(),
  }));
  index.addAll(docs);
  for (const doc of docs) notesMap.set(doc.id, doc);
  return {
    vaultRoot,
    index,
    notes: notesMap,
    backlinks: backlinks ?? new Map(),
    policy: PERMISSIVE_POLICY,
  };
}

const packedBytes = (ctx: ServerContext, query: string, budgetBytes: number) =>
  Buffer.byteLength(JSON.stringify(contextPack(ctx, { query, budgetBytes })), 'utf8');

/** A vault with enough matter to overflow small budgets. */
function bigVault() {
  const notes = [];
  for (let i = 0; i < 20; i++) {
    notes.push({
      id: `topics/photosynthesis-${i}.md`,
      title: `Photosynthesis Study ${i}`,
      body: `Photosynthesis converts light into chemical energy. Chapter ${i} covers chlorophyll, chloroplasts, and the Calvin cycle in depth. ${'Additional detail sentence about light-dependent reactions. '.repeat(5)}`,
      tags: 'biology',
    });
  }
  return notes;
}

describe('contextPack', () => {
  it('returns ranked excerpts with lean field conventions', () => {
    const ctx = buildCtx('/vault', [
      {
        id: 'plants/photosynthesis.md',
        title: 'photosynthesis', // equals basename → omitted
        body: 'Photosynthesis converts light into chemical energy.',
        tags: '',
      },
      {
        id: 'plants/chlorophyll.md',
        title: 'Chlorophyll Pigment', // differs from basename → kept
        body: 'Chlorophyll absorbs light for photosynthesis.',
        tags: 'biology pigments',
      },
    ]);
    const pack = contextPack(ctx, { query: 'photosynthesis', budgetBytes: 2048 });
    expect(pack.excerpts.length).toBe(2);
    expect(pack.totalMatches).toBe(2);
    const byPath = new Map(pack.excerpts.map((e) => [e.path, e]));
    expect(byPath.get('plants/photosynthesis.md')?.title).toBeUndefined();
    expect(byPath.get('plants/photosynthesis.md')?.tags).toBeUndefined();
    expect(byPath.get('plants/chlorophyll.md')?.title).toBe('Chlorophyll Pigment');
    expect(byPath.get('plants/chlorophyll.md')?.tags).toEqual(['biology', 'pigments']);
    for (const e of pack.excerpts) {
      expect(e.score).toBe(Math.round(e.score * 100) / 100);
    }
    // Scores descend in rank order.
    const scores = pack.excerpts.map((e) => e.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('never exceeds the byte budget (hard-cap invariant)', () => {
    const ctx = buildCtx('/vault', bigVault());
    for (const budget of [256, 512, 1024, 2048]) {
      expect(packedBytes(ctx, 'photosynthesis chlorophyll', budget)).toBeLessThanOrEqual(budget);
    }
  });

  it('hard cap holds with multi-byte UTF-8 content', () => {
    const notes = [];
    for (let i = 0; i < 10; i++) {
      notes.push({
        id: `notes/emoji-${i}.md`,
        title: `Emoji ${i}`,
        body: `photosynthesis ${'🌱🌿☘️ has multi-byte content — '.repeat(30)}`,
      });
    }
    const ctx = buildCtx('/vault', notes);
    for (const budget of [256, 512, 1024]) {
      expect(packedBytes(ctx, 'photosynthesis', budget)).toBeLessThanOrEqual(budget);
    }
  });

  it('returns an explicit empty pack with confidence "none" for no matches', () => {
    const ctx = buildCtx('/vault', bigVault());
    const pack = contextPack(ctx, { query: 'zzzzabsolutelyunmatchablexyz', budgetBytes: 2048 });
    expect(pack).toEqual({
      excerpts: [],
      neighborhood: [],
      sources: [],
      totalMatches: 0,
      confidence: 'none',
    });
    expect(pack.truncated).toBeUndefined();
  });

  it('reports confidence "low" when no included excerpt contains a query term', () => {
    // Match on title only — body has no query term, so the excerpt is fallback text.
    const ctx = buildCtx('/vault', [
      { id: 'notes/mitochondria.md', title: 'Mitochondria', body: 'The powerhouse of the cell.' },
    ]);
    const pack = contextPack(ctx, { query: 'mitochondria', budgetBytes: 2048 });
    expect(pack.excerpts.length).toBe(1);
    expect(pack.confidence).toBe('low');
  });

  it('includes backlink neighbors with rel, line, and summary', () => {
    const backlinks = new Map<string, BacklinkRef[]>([
      [
        'plants/photosynthesis.md',
        [{ path: 'journal/2026-05-01.md', line: 4, linkType: 'wikilink' }],
      ],
    ]);
    const ctx = buildCtx(
      '/vault',
      [
        {
          id: 'plants/photosynthesis.md',
          title: 'Photosynthesis',
          body: 'Photosynthesis converts light into chemical energy.',
        },
        {
          id: 'journal/2026-05-01.md',
          title: 'May Journal',
          body: 'Read about plant biology today.',
          raw: 'Read about plant biology today.\n\n\nSee [[photosynthesis]].',
        },
      ],
      backlinks,
    );
    const pack = contextPack(ctx, { query: 'photosynthesis converts', budgetBytes: 2048 });
    const neighbor = pack.neighborhood.find((n) => n.path === 'journal/2026-05-01.md');
    expect(neighbor).toBeDefined();
    // The journal note also outlinks to the hit, so rel merges to 'both'... unless
    // it matched the query itself and became an excerpt. It shouldn't here.
    expect(neighbor?.rel).toBe('backlink');
    expect(neighbor?.line).toBe(4);
    expect(neighbor?.summary.length).toBeGreaterThan(0);
  });

  it('includes outlink neighbors resolved from wikilinks in the hit note', () => {
    const ctx = buildCtx('/vault', [
      {
        id: 'plants/photosynthesis.md',
        title: 'Photosynthesis',
        body: 'Photosynthesis needs chlorophyll.',
        raw: 'Photosynthesis needs [[chlorophyll]].',
      },
      {
        id: 'plants/chlorophyll.md',
        title: 'Chlorophyll',
        body: 'A green pigment found in chloroplasts.',
      },
    ]);
    const pack = contextPack(ctx, { query: 'photosynthesis needs', budgetBytes: 2048 });
    const neighbor = pack.neighborhood.find((n) => n.path === 'plants/chlorophyll.md');
    expect(neighbor).toBeDefined();
    expect(neighbor?.rel).toBe('outlink');
    expect(neighbor?.line).toBeUndefined();
  });

  it('dedups: a note that is both hit and neighbor appears only in excerpts', () => {
    const backlinks = new Map<string, BacklinkRef[]>([
      [
        'plants/photosynthesis.md',
        [{ path: 'plants/chlorophyll.md', line: 1, linkType: 'wikilink' }],
      ],
    ]);
    const ctx = buildCtx(
      '/vault',
      [
        {
          id: 'plants/photosynthesis.md',
          title: 'Photosynthesis',
          body: 'Photosynthesis converts light energy.',
        },
        {
          id: 'plants/chlorophyll.md',
          title: 'Chlorophyll',
          body: 'Chlorophyll enables photosynthesis.',
          raw: 'Chlorophyll enables [[photosynthesis]].',
        },
      ],
      backlinks,
    );
    const pack = contextPack(ctx, { query: 'photosynthesis', budgetBytes: 2048 });
    const excerptPaths = pack.excerpts.map((e) => e.path);
    expect(excerptPaths).toContain('plants/chlorophyll.md');
    expect(pack.neighborhood.map((n) => n.path)).not.toContain('plants/chlorophyll.md');
  });

  it('merges backlink+outlink neighbors into rel "both"', () => {
    const backlinks = new Map<string, BacklinkRef[]>([
      ['hub/topic.md', [{ path: 'refs/sidecar.md', line: 2, linkType: 'wikilink' }]],
    ]);
    const ctx = buildCtx(
      '/vault',
      [
        {
          id: 'hub/topic.md',
          title: 'Quantum Tunnelling',
          body: 'Quantum tunnelling lets particles cross barriers.',
          raw: 'Quantum tunnelling lets particles cross barriers. See [[sidecar]].',
        },
        {
          id: 'refs/sidecar.md',
          title: 'Sidecar',
          body: 'Reference material on barrier penetration.',
          raw: 'Reference material.\n\nBack to [[topic]].',
        },
      ],
      backlinks,
    );
    const pack = contextPack(ctx, { query: 'quantum tunnelling', budgetBytes: 2048 });
    const neighbor = pack.neighborhood.find((n) => n.path === 'refs/sidecar.md');
    expect(neighbor?.rel).toBe('both');
    expect(neighbor?.line).toBe(2);
  });

  it('ranks neighbors connected to more hits first', () => {
    const backlinks = new Map<string, BacklinkRef[]>([
      ['a/alpha.md', [{ path: 'n/shared.md', line: 1, linkType: 'wikilink' }]],
      [
        'a/beta.md',
        [
          { path: 'n/shared.md', line: 2, linkType: 'wikilink' },
          { path: 'n/single.md', line: 3, linkType: 'wikilink' },
        ],
      ],
    ]);
    const ctx = buildCtx(
      '/vault',
      [
        { id: 'a/alpha.md', title: 'Alpha', body: 'Wombat migration in alpha region.' },
        { id: 'a/beta.md', title: 'Beta', body: 'Wombat migration in beta region.' },
        { id: 'n/shared.md', title: 'Shared', body: 'Linked from both regions.' },
        { id: 'n/single.md', title: 'Single', body: 'Linked from one region.' },
      ],
      backlinks,
    );
    const pack = contextPack(ctx, { query: 'wombat migration', budgetBytes: 4096 });
    const paths = pack.neighborhood.map((n) => n.path);
    expect(paths.indexOf('n/shared.md')).toBeLessThan(paths.indexOf('n/single.md'));
  });

  it('inlines small scalar frontmatter and caps oversized values', () => {
    const ctx = buildCtx('/vault', [
      {
        id: 'notes/tracked.md',
        title: 'Tracked',
        body: 'Falconry techniques and equipment.',
        fm: { status: 'draft', priority: 2, nested: { deep: true }, blob: 'x'.repeat(500) },
      },
    ]);
    const pack = contextPack(ctx, { query: 'falconry', budgetBytes: 2048 });
    const fm = pack.excerpts[0]?.fm;
    expect(fm).toEqual({ status: 'draft', priority: 2 }); // nested skipped, blob over cap
  });

  it('omits fm entirely when nothing scalar fits', () => {
    const ctx = buildCtx('/vault', [
      {
        id: 'notes/heavy.md',
        title: 'Heavy',
        body: 'Falconry techniques and equipment.',
        fm: { blob: 'x'.repeat(500) },
      },
    ]);
    const pack = contextPack(ctx, { query: 'falconry', budgetBytes: 2048 });
    expect(pack.excerpts[0]?.fm).toBeUndefined();
  });

  it('signals truncation with overflow sources when the budget forces drops', () => {
    const ctx = buildCtx('/vault', bigVault());
    const pack = contextPack(ctx, { query: 'photosynthesis chlorophyll', budgetBytes: 512 });
    expect(pack.truncated).toBe(true);
    expect(pack.totalMatches).toBeGreaterThan(pack.excerpts.length);
    expect(pack.sources.length).toBeGreaterThan(0);
    const included = new Set(pack.excerpts.map((e) => e.path));
    for (const s of pack.sources) expect(included.has(s.path)).toBe(false);
  });

  it('soft reserve leaves room for the neighborhood under pressure', () => {
    const notes = bigVault();
    const backlinks = new Map<string, BacklinkRef[]>();
    // Every big-vault note gets a backlink from a small stub note.
    notes.push({
      id: 'refs/stub.md',
      title: 'Stub',
      body: 'Cross-reference stub note.',
      tags: '',
    });
    for (const n of notes.slice(0, 5)) {
      backlinks.set(n.id, [{ path: 'refs/stub.md', line: 1, linkType: 'wikilink' }]);
    }
    const ctx = buildCtx('/vault', notes, backlinks);
    const pack = contextPack(ctx, { query: 'photosynthesis chlorophyll', budgetBytes: 1024 });
    expect(pack.excerpts.length).toBeGreaterThan(0);
    expect(pack.neighborhood.length).toBeGreaterThan(0);
  });

  it('is deterministic: repeat calls produce byte-identical output', () => {
    const ctx = buildCtx('/vault', bigVault());
    const a = JSON.stringify(contextPack(ctx, { query: 'photosynthesis', budgetBytes: 1024 }));
    const b = JSON.stringify(contextPack(ctx, { query: 'photosynthesis', budgetBytes: 1024 }));
    expect(a).toBe(b);
  });

  it('larger budgets never return fewer excerpts', () => {
    const ctx = buildCtx('/vault', bigVault());
    let prev = 0;
    for (const budget of [256, 512, 1024, 2048, 4096]) {
      const pack = contextPack(ctx, { query: 'photosynthesis chlorophyll', budgetBytes: budget });
      expect(pack.excerpts.length).toBeGreaterThanOrEqual(prev);
      prev = pack.excerpts.length;
    }
  });
});
