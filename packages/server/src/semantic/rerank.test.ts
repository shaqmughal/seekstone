import type { TokenEmbedder, TokenEmbedding } from '@seekstone/core/embed';
import { describe, expect, it } from 'vitest';
import { maxsimRerankHits } from './rerank.js';
import type { SemanticHit } from './store.js';

/** 3-word vocab, dim 2, unit rows — same fixture family as the harness test. */
const VOCAB = new Map<string, { id: number; vec: [number, number] }>([
  ['lead', { id: 10, vec: [1, 0] }],
  ['mineral', { id: 11, vec: [0, 1] }],
  ['rock', { id: 12, vec: [0.6, 0.8] }],
]);
const BY_ID = new Map([...VOCAB.values()].map((v) => [v.id, v.vec]));

const fake: TokenEmbedder = {
  id: 'fake-2d',
  dim: 2,
  embed: () => new Float32Array(2),
  tokenEmbed(text: string): TokenEmbedding {
    const ids = this.tokenIds(text);
    const vectors = new Float32Array(ids.length * 2);
    for (const [i, id] of ids.entries()) vectors.set(BY_ID.get(id) as [number, number], i * 2);
    return { ids, dim: 2, vectors };
  },
  tokenIds(text: string): number[] {
    return text
      .toLowerCase()
      .split(/\W+/)
      .map((w) => VOCAB.get(w)?.id)
      .filter((id) => id !== undefined);
  },
  tokenVector(id: number): Float32Array {
    const vec = BY_ID.get(id);
    if (!vec) throw new Error(`unknown token id ${id}`);
    return Float32Array.from(vec);
  },
};

const hit = (path: string, score: number, chunkIndex: number): SemanticHit => ({
  path,
  score,
  chunkIndex,
  start: chunkIndex * 100,
  end: chunkIndex * 100 + 50,
});

const CHUNK_IDS = new Map<string, number[][]>([
  ['a.md', [fake.tokenIds('rock mineral')]],
  ['b.md', [fake.tokenIds('lead mineral')]],
  ['c.md', [fake.tokenIds('mineral')]],
]);
const idsFor = (h: SemanticHit) => CHUNK_IDS.get(h.path)?.[h.chunkIndex];

describe('maxsimRerankHits', () => {
  const hits = [hit('a.md', 0.9, 0), hit('b.md', 0.8, 0), hit('c.md', 0.7, 0)];

  it('promotes the candidate holding the discriminating token', () => {
    const out = maxsimRerankHits(fake, 'lead mineral', hits, idsFor, 1);
    expect(out.map((h) => h.path)).toEqual(['b.md', 'a.md', 'c.md']);
  });

  it('keeps each hit chunkIndex/span from stage 1 (excerpts unaffected)', () => {
    const out = maxsimRerankHits(fake, 'lead mineral', hits, idsFor);
    const b = out.find((h) => h.path === 'b.md') as SemanticHit;
    expect([b.chunkIndex, b.start, b.end]).toEqual([0, 0, 50]);
  });

  it('does not mutate the input array or hits', () => {
    const before = hits.map((h) => ({ ...h }));
    maxsimRerankHits(fake, 'lead mineral', hits, idsFor);
    expect(hits).toEqual(before);
  });

  it('beta 0 returns stage-1 order', () => {
    const out = maxsimRerankHits(fake, 'lead mineral', hits, idsFor, 0);
    expect(out.map((h) => h.path)).toEqual(['a.md', 'b.md', 'c.md']);
  });

  it('passes through when the query has no known tokens', () => {
    const out = maxsimRerankHits(fake, 'zzz', hits, idsFor, 1);
    expect(out.map((h) => h.path)).toEqual(['a.md', 'b.md', 'c.md']);
  });

  it('a hit with unavailable token ids keeps only its stage-1 vote', () => {
    // b.md's ids are missing (debounce window) — its maxsim is 0, so with
    // beta 1 it drops below both scored candidates.
    const partial = (h: SemanticHit) => (h.path === 'b.md' ? undefined : idsFor(h));
    const out = maxsimRerankHits(fake, 'lead mineral', hits, partial, 1);
    expect(out[out.length - 1]?.path).toBe('b.md');
  });

  it('single-hit and empty inputs pass through', () => {
    expect(maxsimRerankHits(fake, 'lead', [hit('a.md', 1, 0)], idsFor).length).toBe(1);
    expect(maxsimRerankHits(fake, 'lead', [], idsFor)).toEqual([]);
  });
});
