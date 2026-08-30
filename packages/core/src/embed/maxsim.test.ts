import { describe, expect, it } from 'vitest';
import { maxsimScore } from './maxsim.js';
import type { TokenEmbedding } from './types.js';

/** Pack unit-ish rows into a TokenEmbedding (ids are arbitrary vocab ids). */
function te(dim: number, rows: number[][]): TokenEmbedding {
  const vectors = new Float32Array(rows.length * dim);
  for (const [i, r] of rows.entries()) vectors.set(r, i * dim);
  return { ids: rows.map((_, i) => i + 10), dim, vectors };
}

describe('maxsimScore', () => {
  // Hand-computed: q0=[1,0] → max(dot [1,0]=1, dot [0.6,0.8]=0.6) = 1
  //                q1=[0,1] → max(dot [1,0]=0, dot [0.6,0.8]=0.8) = 0.8
  const query = te(2, [
    [1, 0],
    [0, 1],
  ]);
  const doc = te(2, [
    [1, 0],
    [0.6, 0.8],
  ]);

  it('sums per-query-token maxima by default', () => {
    expect(maxsimScore(query, doc)).toBeCloseTo(1 + 0.8, 6);
  });

  it('mean aggregation divides by the token count', () => {
    expect(maxsimScore(query, doc, { aggregate: 'mean' })).toBeCloseTo(1.8 / 2, 6);
  });

  it('applies per-query-token weights (weighted sum and weighted mean)', () => {
    // w=[2,1]: sum = 2·1 + 1·0.8 = 2.8; mean = 2.8 / 3.
    expect(maxsimScore(query, doc, { weights: [2, 1] })).toBeCloseTo(2.8, 6);
    expect(maxsimScore(query, doc, { weights: [2, 1], aggregate: 'mean' })).toBeCloseTo(2.8 / 3, 6);
  });

  it('takes the max per query token, not the first or sum', () => {
    // Single query token [0,1] against rows scoring 0.8 then 0: max is 0.8.
    const q = te(2, [[0, 1]]);
    const d = te(2, [
      [0.6, 0.8],
      [1, 0],
    ]);
    expect(maxsimScore(q, d)).toBeCloseTo(0.8, 6);
  });

  it('handles negative similarities: best match can be negative', () => {
    const q = te(2, [[1, 0]]);
    const d = te(2, [
      [-1, 0],
      [-0.6, -0.8],
    ]);
    expect(maxsimScore(q, d)).toBeCloseTo(-0.6, 6);
  });

  it('returns 0 when the query has no tokens', () => {
    expect(maxsimScore(te(2, []), doc)).toBe(0);
  });

  it('returns 0 when the doc has no tokens', () => {
    expect(maxsimScore(query, te(2, []))).toBe(0);
  });

  it('returns 0 for mean aggregation with zero total weight', () => {
    expect(maxsimScore(query, doc, { weights: [0, 0], aggregate: 'mean' })).toBe(0);
  });

  it('a zero row (zero embedding) contributes 0 against a zero doc row', () => {
    const q = te(2, [[0, 0]]);
    const d = te(2, [[0, 0]]);
    expect(maxsimScore(q, d)).toBe(0);
  });

  it('rejects mismatched dims', () => {
    expect(() => maxsimScore(te(2, [[1, 0]]), te(3, [[1, 0, 0]]))).toThrow(
      /query dim 2 does not match doc dim 3/,
    );
  });

  it('rejects a weights array whose length disagrees with the query', () => {
    expect(() => maxsimScore(query, doc, { weights: [1] })).toThrow(/1 weights for 2 query tokens/);
  });
});
