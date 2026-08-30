/**
 * Static late-interaction MaxSim scorer (SHA-314).
 *
 * ColBERT's late-interaction mechanism over static token vectors: for each
 * query token, take the max cosine similarity over the candidate chunk's
 * tokens, then aggregate across query tokens. Token vectors come from the
 * already-loaded Model2Vec embedding matrix (TokenEmbedder.tokenEmbed), so
 * this recovers term-level evidence ("lead", "sulphate") that mean-pooling
 * dilutes — with zero new dependencies and no storage change.
 *
 * Rows in both TokenEmbeddings are L2-normalized by contract (see types.ts),
 * so the inner loop is a plain dot product. A zero row (zero embedding) never
 * wins a max against any positive similarity and contributes 0 if the chunk
 * is all-zero — degrading gracefully rather than throwing.
 */
import type { TokenEmbedding } from './types.js';

/**
 * How per-query-token maxima combine:
 * - `sum`: Σ wᵢ·maxᵢ — rewards queries with more matched tokens (ColBERT's choice).
 * - `mean`: Σ wᵢ·maxᵢ / Σ wᵢ — length-invariant, comparable across queries.
 */
export type MaxSimAggregate = 'sum' | 'mean';

export interface MaxSimOptions {
  aggregate?: MaxSimAggregate;
  /**
   * Per-query-token weights (e.g. IDF down-weighting of common tokens).
   * Length must equal the query token count. Defaults to all-ones.
   */
  weights?: ArrayLike<number>;
}

/**
 * MaxSim score of `doc` against `query`. Returns 0 when either side has no
 * tokens (empty text) or when `mean` aggregation has zero total weight.
 */
export function maxsimScore(
  query: TokenEmbedding,
  doc: TokenEmbedding,
  opts: MaxSimOptions = {},
): number {
  if (query.dim !== doc.dim) {
    throw new Error(`maxsim: query dim ${query.dim} does not match doc dim ${doc.dim}`);
  }
  const n = query.ids.length;
  const weights = opts.weights;
  if (weights !== undefined && weights.length !== n) {
    throw new Error(`maxsim: ${weights.length} weights for ${n} query tokens`);
  }
  const m = doc.ids.length;
  if (n === 0 || m === 0) return 0;
  const { dim } = query;
  const q = query.vectors;
  const d = doc.vectors;
  let sum = 0;
  let weightSum = 0;
  for (let i = 0; i < n; i++) {
    const qBase = i * dim;
    let best = -Infinity;
    for (let c = 0; c < m; c++) {
      const dBase = c * dim;
      let dot = 0;
      for (let j = 0; j < dim; j++) {
        dot += (q[qBase + j] as number) * (d[dBase + j] as number);
      }
      if (dot > best) best = dot;
    }
    const w = weights === undefined ? 1 : (weights[i] as number);
    sum += w * best;
    weightSum += w;
  }
  if ((opts.aggregate ?? 'sum') === 'mean') {
    return weightSum > 0 ? sum / weightSum : 0;
  }
  return sum;
}
