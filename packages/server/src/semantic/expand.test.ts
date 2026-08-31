import { describe, expect, it } from 'vitest';
import { expandHits, neighborsFor } from './expand.js';
import type { SemanticHit } from './store.js';

/** A hit whose span encodes its path length — enough to prove span plumbing. */
const hit = (path: string, score: number, chunkIndex = 0): SemanticHit => ({
  path,
  score,
  chunkIndex,
  start: path.length * 10,
  end: path.length * 10 + 5,
});

/** Build lookups from a plain adjacency object and a path → gate-score map. */
const graph = (edges: Record<string, string[]>) => (path: string) => edges[path] ?? [];
const scorer = (scores: Record<string, number>) => (path: string) =>
  scores[path] === undefined ? undefined : hit(path, scores[path] as number, 7);

describe('expandHits', () => {
  it('adds a gated neighbor scored seedScore × hopDecay with the gate hit span', () => {
    const hits = [hit('eagle.md', 1.0), hit('crow.md', 0.5)];
    const out = expandHits(hits, graph({ 'eagle.md': ['hawk.md'] }), scorer({ 'hawk.md': 0.8 }), {
      seeds: 2,
      hopDecay: 0.6,
      capPerSeed: 5,
      minGate: 0.3,
    });
    expect(out.map((h) => h.path)).toEqual(['eagle.md', 'hawk.md', 'crow.md']);
    const hawk = out[1] as SemanticHit;
    expect(hawk.score).toBeCloseTo(0.6); // 1.0 × 0.6, NOT the 0.8 gate score
    expect(hawk.chunkIndex).toBe(7); // span comes from the gate hit
    expect(hawk.start).toBe('hawk.md'.length * 10);
  });

  it('drops neighbors below the gate and neighbors without vectors', () => {
    const hits = [hit('a.md', 1.0)];
    const out = expandHits(
      hits,
      graph({ 'a.md': ['weak.md', 'ghost.md'] }),
      scorer({ 'weak.md': 0.1 }), // ghost.md: no vectors at all
      { seeds: 1, hopDecay: 0.6, capPerSeed: 5, minGate: 0.3 },
    );
    expect(out.map((h) => h.path)).toEqual(['a.md']);
  });

  it('caps survivors per seed by the neighbor gate score', () => {
    const hits = [hit('seed.md', 1.0)];
    const out = expandHits(
      hits,
      graph({ 'seed.md': ['n1.md', 'n2.md', 'n3.md', 'n4.md'] }),
      scorer({ 'n1.md': 0.4, 'n2.md': 0.9, 'n3.md': 0.6, 'n4.md': 0.8 }),
      { seeds: 1, hopDecay: 0.5, capPerSeed: 2, minGate: 0.3 },
    );
    // Only the two best-gated neighbors survive (n2, n4); all expansion
    // scores are identical (seedScore × decay), so ties break path-ascending.
    expect(out.map((h) => h.path)).toEqual(['seed.md', 'n2.md', 'n4.md']);
  });

  it('a hub seed cannot flood the list past cap + gate', () => {
    const hits = [hit('japan.md', 1.0), hit('honshu.md', 0.9), hit('kyoto.md', 0.8)];
    const neighbors = Array.from({ length: 100 }, (_, i) => `linked-${i}.md`);
    const gates = Object.fromEntries(neighbors.map((p, i) => [p, i < 40 ? 0.5 : 0.1]));
    const out = expandHits(hits, graph({ 'japan.md': neighbors }), scorer(gates), {
      seeds: 3,
      hopDecay: 0.5,
      capPerSeed: 3,
      minGate: 0.3,
    });
    // 100 links, 40 above the gate — still only capPerSeed survive, and none
    // outranks an original candidate (0.5 decayed < every original score).
    expect(out).toHaveLength(6);
    expect(out.slice(0, 3).map((h) => h.path)).toEqual(['japan.md', 'honshu.md', 'kyoto.md']);
  });

  it('takes the best expansion score when several seeds reach one neighbor', () => {
    const hits = [hit('a.md', 1.0), hit('b.md', 0.4)];
    const out = expandHits(
      hits,
      graph({ 'a.md': ['shared.md'], 'b.md': ['shared.md'] }),
      scorer({ 'shared.md': 0.9 }),
      { seeds: 2, hopDecay: 0.5, capPerSeed: 5, minGate: 0.3 },
    );
    expect(out.find((h) => h.path === 'shared.md')?.score).toBeCloseTo(0.5); // via a.md
  });

  it('boosts an existing tail candidate instead of duplicating it, keeping its own span', () => {
    const hits = [hit('a.md', 1.0), hit('tail.md', 0.2, 3)];
    const out = expandHits(hits, graph({ 'a.md': ['tail.md'] }), scorer({ 'tail.md': 0.9 }), {
      seeds: 1,
      hopDecay: 0.6,
      capPerSeed: 5,
      minGate: 0.3,
    });
    expect(out.map((h) => h.path)).toEqual(['a.md', 'tail.md']);
    const tail = out[1] as SemanticHit;
    expect(tail.score).toBeCloseTo(0.6); // boosted 1.0 × 0.6 > 0.2
    expect(tail.chunkIndex).toBe(3); // original hit's span, not the gate's
  });

  it('never demotes: an expansion score below the existing score is ignored', () => {
    const hits = [hit('a.md', 1.0), hit('strong.md', 0.9)];
    const out = expandHits(hits, graph({ 'a.md': ['strong.md'] }), scorer({ 'strong.md': 0.9 }), {
      seeds: 1,
      hopDecay: 0.5,
      capPerSeed: 5,
      minGate: 0.3,
    });
    expect(out[1]?.score).toBeCloseTo(0.9); // not dragged down to 0.5
  });

  it('ignores self-links and duplicate edges; seed-to-seed boosts never demote', () => {
    const hits = [hit('a.md', 1.0), hit('b.md', 0.4)];
    const out = expandHits(
      hits,
      graph({ 'a.md': ['a.md', 'b.md', 'c.md', 'c.md'], 'b.md': ['a.md'] }),
      scorer({ 'a.md': 1, 'b.md': 1, 'c.md': 0.9 }),
      { seeds: 2, hopDecay: 0.5, capPerSeed: 5, minGate: 0.3 },
    );
    // b (a seed) is boosted by a's link: max(0.4, 1.0 × 0.5); a is a
    // neighbor of b but its own 1.0 beats the 0.4 × 0.5 back-boost.
    expect(out.map((h) => h.path)).toEqual(['a.md', 'b.md', 'c.md']);
    expect(out[0]?.score).toBeCloseTo(1.0);
    expect(out[1]?.score).toBeCloseTo(0.5);
    expect(out[2]?.score).toBeCloseTo(0.5); // ties break path-ascending (b < c)
  });

  it('expands only from the top `seeds` hits', () => {
    const hits = [hit('a.md', 1.0), hit('b.md', 0.9)];
    const out = expandHits(hits, graph({ 'b.md': ['c.md'] }), scorer({ 'c.md': 0.9 }), {
      seeds: 1, // b.md is not a seed
      hopDecay: 0.5,
      capPerSeed: 5,
      minGate: 0.3,
    });
    expect(out.map((h) => h.path)).toEqual(['a.md', 'b.md']);
  });

  it('rrf fusion ranks by reciprocal-rank sum and keeps spans', () => {
    const hits = [hit('a.md', 1.0), hit('b.md', 0.9, 2)];
    const out = expandHits(
      hits,
      graph({ 'a.md': ['b.md', 'new.md'] }),
      scorer({ 'b.md': 0.9, 'new.md': 0.8 }),
      {
        seeds: 1,
        hopDecay: 0.5,
        capPerSeed: 5,
        minGate: 0.3,
        fusion: 'rrf',
      },
    );
    // b.md appears in both rankings (1/62 + 1/61) and overtakes a.md (1/61).
    expect(out.map((h) => h.path)).toEqual(['b.md', 'a.md', 'new.md']);
    expect(out[0]?.chunkIndex).toBe(2); // existing hit's span survives fusion
    expect(out[0]?.score).toBeCloseTo(1 / 62 + 1 / 61);
    expect(out[1]?.score).toBeCloseTo(1 / 61);
  });

  it('returns copies — never mutates the input hits', () => {
    const hits = [hit('a.md', 1.0), hit('tail.md', 0.2)];
    expandHits(hits, graph({ 'a.md': ['tail.md'] }), scorer({ 'tail.md': 0.9 }), {
      seeds: 1,
      hopDecay: 0.6,
      capPerSeed: 5,
      minGate: 0.3,
    });
    expect(hits[1]?.score).toBe(0.2);
  });

  it('passes through on empty input or disabled knobs', () => {
    expect(expandHits([], graph({}), scorer({}))).toEqual([]);
    const hits = [hit('a.md', 1.0)];
    for (const opts of [{ seeds: 0 }, { capPerSeed: 0 }, { hopDecay: 0 }]) {
      const out = expandHits(hits, graph({ 'a.md': ['b.md'] }), scorer({ 'b.md': 1 }), opts);
      expect(out.map((h) => h.path)).toEqual(['a.md']);
    }
  });
});

describe('neighborsFor', () => {
  const notes = new Map([
    ['birds/eagle.md', { raw: 'The [[Hawk]] and the [[birds/kite|kite]] are kin. See [[Hawk]].' }],
    ['birds/hawk.md', { raw: 'No links here.' }],
    ['birds/kite.md', { raw: 'A [[ghost]] link that resolves to nothing.' }],
  ]);
  const backlinks = new Map([
    ['birds/eagle.md', [{ path: 'birds/falcon.md' }, { path: 'birds/hawk.md' }]],
  ]);

  it('unions resolved outbound links with backlinks, deduped', () => {
    const neighbors = neighborsFor(notes, backlinks);
    // Hawk arrives via BOTH an outbound wikilink (basename-resolved) and a
    // backlink; kite via a relative-path alias link; falcon via backlink only.
    expect(neighbors('birds/eagle.md').sort()).toEqual([
      'birds/falcon.md',
      'birds/hawk.md',
      'birds/kite.md',
    ]);
  });

  it('handles unresolved links, linkless notes, and unknown paths', () => {
    const neighbors = neighborsFor(notes, backlinks);
    expect(neighbors('birds/kite.md')).toEqual([]);
    expect(neighbors('birds/hawk.md')).toEqual([]);
    expect(neighbors('missing.md')).toEqual([]);
  });

  it('memoizes per closure', () => {
    let reads = 0;
    const counting = new Proxy(notes, {
      get(target, prop, receiver) {
        if (prop === 'get') {
          return (key: string) => {
            reads++;
            return target.get(key);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    const neighbors = neighborsFor(counting as typeof notes, backlinks);
    neighbors('birds/hawk.md');
    const after = reads;
    neighbors('birds/hawk.md');
    expect(reads).toBe(after);
  });
});
