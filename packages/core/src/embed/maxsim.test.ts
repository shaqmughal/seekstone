import { describe, expect, it } from 'vitest';
import { candidateSetIdf, maxsimScore, maxsimScoreAll, maxsimScoreTokens } from './maxsim.js';
import {
  type Embedder,
  isTokenEmbedder,
  type TokenEmbedder,
  type TokenEmbedding,
} from './types.js';

/**
 * Pack unit-ish rows into a TokenEmbedding. `idBase` keeps vocab ids unique
 * across fixtures — maxsimScoreAll's memo assumes equal ids carry identical
 * vectors, so distinct vectors must get distinct ids.
 */
function te(dim: number, rows: number[][], idBase = 10): TokenEmbedding {
  const vectors = new Float32Array(rows.length * dim);
  for (const [i, r] of rows.entries()) vectors.set(r, i * dim);
  return { ids: rows.map((_, i) => i + idBase), dim, vectors };
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

describe('maxsimScoreAll', () => {
  const query = te(2, [
    [1, 0],
    [0, 1],
  ]);

  it('matches per-doc maxsimScore exactly (memo is a pure optimization)', () => {
    const docs = [
      te(2, [
        [1, 0],
        [0.6, 0.8],
      ]),
      te(2, [[0, 1]], 50),
      te(2, []),
    ];
    for (const aggregate of ['sum', 'mean'] as const) {
      const all = maxsimScoreAll(query, docs, { aggregate, weights: [2, 1] });
      docs.forEach((d, i) => {
        expect(all[i]).toBeCloseTo(maxsimScore(query, d, { aggregate, weights: [2, 1] }), 10);
      });
    }
  });

  it('reuses cached similarities for repeated token ids across docs', () => {
    // Same id (10) in both docs — second doc scores via the memo, and a
    // duplicated id inside one doc changes nothing (max over equals).
    const a: TokenEmbedding = { ids: [10], dim: 2, vectors: new Float32Array([0.6, 0.8]) };
    const b: TokenEmbedding = {
      ids: [10, 10],
      dim: 2,
      vectors: new Float32Array([0.6, 0.8, 0.6, 0.8]),
    };
    const [sa, sb] = maxsimScoreAll(query, [a, b], { aggregate: 'mean' });
    expect(sa).toBeCloseTo(0.7, 6); // (0.6 + 0.8) / 2
    expect(sb).toBeCloseTo(sa as number, 10);
  });

  it('returns 0 for an empty query without touching docs', () => {
    expect(maxsimScoreAll(te(2, []), [te(2, [[1, 0]])])).toEqual([0]);
  });

  it('rejects a doc with a mismatched dim', () => {
    expect(() => maxsimScoreAll(query, [te(3, [[1, 0, 0]])])).toThrow(
      /query dim 2 does not match doc dim 3/,
    );
  });

  it('rejects a weights array whose length disagrees with the query', () => {
    expect(() => maxsimScoreAll(query, [], { weights: [1] })).toThrow(
      /1 weights for 2 query tokens/,
    );
  });
});

describe('maxsimScoreTokens', () => {
  const query = te(2, [
    [1, 0],
    [0, 1],
  ]);
  const ROWS = new Map<number, number[]>([
    [10, [1, 0]],
    [11, [0.6, 0.8]],
    [50, [0, 1]],
  ]);
  const tokenVector = (id: number) => {
    const r = ROWS.get(id);
    if (!r) throw new Error(`no row for ${id}`);
    return Float32Array.from(r);
  };

  it('matches maxsimScoreAll over tokenEmbed-shaped docs exactly', () => {
    const docsIds = [[10, 11], [50], []];
    const docsTe = docsIds.map(
      (ids): TokenEmbedding => ({
        ids,
        dim: 2,
        vectors: Float32Array.from(ids.flatMap((id) => [...tokenVector(id)])),
      }),
    );
    for (const aggregate of ['sum', 'mean'] as const) {
      const viaIds = maxsimScoreTokens(query, docsIds, tokenVector, {
        aggregate,
        weights: [2, 1],
      });
      const viaVecs = maxsimScoreAll(query, docsTe, { aggregate, weights: [2, 1] });
      for (const [i, s] of viaIds.entries()) expect(s).toBeCloseTo(viaVecs[i] as number, 10);
    }
  });

  it('gathers each unique id once across all docs', () => {
    const calls: number[] = [];
    const counting = (id: number) => {
      calls.push(id);
      return tokenVector(id);
    };
    maxsimScoreTokens(query, [[10, 11, 10], [11, 50], [10]], counting);
    expect(calls.sort()).toEqual([10, 11, 50]);
  });

  it('rejects a token vector with the wrong dim', () => {
    expect(() => maxsimScoreTokens(query, [[7]], () => new Float32Array(3))).toThrow(
      /token vector dim 3 does not match query dim 2/,
    );
  });

  it('rejects a weights array whose length disagrees with the query', () => {
    expect(() => maxsimScoreTokens(query, [], tokenVector, { weights: [1, 2, 3] })).toThrow(
      /3 weights for 2 query tokens/,
    );
  });
});

describe('candidateSetIdf', () => {
  it('weights rare query tokens above ubiquitous ones (BM25 form)', () => {
    const docs = [
      [11, 12],
      [10, 11],
      [11, 11],
    ];
    const [wRare, wCommon, wAbsent] = candidateSetIdf([10, 11, 99], docs);
    // df(10)=1 → ln(1+2.5/1.5); df(11)=3 → ln(1+0.5/3.5); df(99)=0 → ln(1+3.5/0.5).
    expect(wRare).toBeCloseTo(Math.log(1 + 2.5 / 1.5), 10);
    expect(wCommon).toBeCloseTo(Math.log(1 + 0.5 / 3.5), 10);
    expect(wAbsent).toBeCloseTo(Math.log(1 + 3.5 / 0.5), 10);
    expect(wRare as number).toBeGreaterThan(wCommon as number);
  });

  it('handles empty docs and empty query', () => {
    expect(candidateSetIdf([], [[1]])).toEqual([]);
    expect(candidateSetIdf([1], [])).toEqual([Math.log(1 + 0.5 / 0.5)]);
  });
});

describe('isTokenEmbedder', () => {
  const plain: Embedder = { id: 'plain', dim: 2, embed: () => new Float32Array(2) };

  it('narrows only embedders that expose tokenEmbed', () => {
    expect(isTokenEmbedder(plain)).toBe(false);
    const token: TokenEmbedder = {
      ...plain,
      tokenEmbed: () => ({ ids: [], dim: 2, vectors: new Float32Array(0) }),
      tokenIds: () => [],
      tokenVector: () => new Float32Array(2),
    };
    expect(isTokenEmbedder(token)).toBe(true);
  });
});
