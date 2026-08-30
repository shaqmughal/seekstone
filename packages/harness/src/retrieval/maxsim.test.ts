import type { Embedder, TokenEmbedder, TokenEmbedding } from '@seekstone/core/embed';
import { describe, expect, it } from 'vitest';
import { maxsimRerank } from './maxsim.js';

/**
 * Hand-built token embedder over a 3-word vocab (dim 2, unit rows):
 *   lead → [1, 0]   mineral → [0, 1]   rock → [0.6, 0.8]
 * Unknown words are dropped (no [UNK] row — keeps fixtures hand-computable).
 */
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
    if (!vec) throw new Error(`fake embedder: unknown token id ${id}`);
    return Float32Array.from(vec);
  },
};

const texts = [
  'rock mineral', // chunk 0
  'lead mineral', // chunk 1
  'mineral', // chunk 2
];
const candidates = [
  { path: 'a.md', score: 0.9, chunk: 0 },
  { path: 'b.md', score: 0.8, chunk: 1 },
  { path: 'c.md', score: 0.7, chunk: 2 },
];

describe('maxsimRerank', () => {
  it('pure rerank (beta 1) promotes the chunk holding the discriminating token', () => {
    // Query "lead mineral": b's chunk maxes both tokens (mean 1.0);
    // a maxes lead at 0.6 via rock (mean 0.8); c maxes lead at 0 (mean 0.5).
    const order = maxsimRerank(fake, 'lead mineral', candidates, texts, {
      aggregate: 'mean',
      beta: 1,
    });
    expect(order).toEqual(['b.md', 'a.md', 'c.md']);
  });

  it('beta 0 reproduces stage-1 order', () => {
    const order = maxsimRerank(fake, 'lead mineral', candidates, texts, {
      aggregate: 'mean',
      beta: 0,
    });
    expect(order).toEqual(['a.md', 'b.md', 'c.md']);
  });

  it('IDF down-weights a query token present in every candidate', () => {
    // "mineral" is in all three chunks (df 3 → weight ≈ 0.16); "lead" only
    // in b (df 1 → weight ≈ 1.6). Weighted mean makes b the clear winner
    // and ranks a (lead≈0.6 via rock) above c (lead 0).
    const order = maxsimRerank(fake, 'lead mineral', candidates, texts, {
      aggregate: 'mean',
      idf: true,
      beta: 1,
    });
    expect(order).toEqual(['b.md', 'a.md', 'c.md']);
  });

  it('falls back to stage-1 order when the query has no known tokens', () => {
    const order = maxsimRerank(fake, 'zzz qqq', candidates, texts, {
      aggregate: 'mean',
      beta: 1,
    });
    expect(order).toEqual(['a.md', 'b.md', 'c.md']);
  });

  it('handles an empty candidate list', () => {
    expect(maxsimRerank(fake, 'lead', [], texts, { aggregate: 'sum' })).toEqual([]);
  });

  it('rejects an embedder without token vectors', () => {
    const plain: Embedder = { id: 'plain', dim: 2, embed: () => new Float32Array(2) };
    expect(() => maxsimRerank(plain, 'lead', candidates, texts, { aggregate: 'sum' })).toThrow(
      /exposes no token vectors/,
    );
  });

  it('rejects a candidate whose chunk index has no retained text', () => {
    expect(() =>
      maxsimRerank(fake, 'lead', [{ path: 'x.md', score: 1, chunk: 99 }], texts, {
        aggregate: 'sum',
      }),
    ).toThrow(/no retained text for chunk index 99/);
  });
});
