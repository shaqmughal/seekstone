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

/**
 * MaxSim of MANY docs against one query — same math as calling
 * `maxsimScore` per doc, but each (query token × vocab token) similarity is
 * computed once and memoized by vocab id across all docs. Candidate chunks
 * share most of their vocabulary, so this collapses the O(q·d·dim) dot work
 * to O(q·unique(d)·dim) per query — the difference between ~115 ms and a
 * single-digit rerank at depth 50 (SHA-314 latency budget).
 *
 * Assumes equal token ids carry identical vectors in every doc — true for
 * any table-gather embedder (tokenEmbed reads the same matrix row).
 */
export function maxsimScoreAll(
  query: TokenEmbedding,
  docs: ReadonlyArray<TokenEmbedding>,
  opts: MaxSimOptions = {},
): number[] {
  const n = query.ids.length;
  const weights = opts.weights;
  if (weights !== undefined && weights.length !== n) {
    throw new Error(`maxsim: ${weights.length} weights for ${n} query tokens`);
  }
  const mean = (opts.aggregate ?? 'sum') === 'mean';
  const out = new Array<number>(docs.length).fill(0);
  if (n === 0) return out;
  const { dim } = query;
  const q = query.vectors;
  /** vocab id → similarity against each query token, computed on first sight. */
  const simCache = new Map<number, Float64Array>();
  const best = new Float64Array(n);
  for (let d = 0; d < docs.length; d++) {
    const doc = docs[d] as TokenEmbedding;
    if (doc.dim !== dim) {
      throw new Error(`maxsim: query dim ${dim} does not match doc dim ${doc.dim}`);
    }
    const m = doc.ids.length;
    if (m === 0) continue;
    best.fill(Number.NEGATIVE_INFINITY);
    for (let t = 0; t < m; t++) {
      const id = doc.ids[t] as number;
      let sims = simCache.get(id);
      if (sims === undefined) {
        sims = new Float64Array(n);
        const dBase = t * dim;
        for (let i = 0; i < n; i++) {
          const qBase = i * dim;
          let dot = 0;
          for (let j = 0; j < dim; j++) {
            dot += (q[qBase + j] as number) * (doc.vectors[dBase + j] as number);
          }
          sims[i] = dot;
        }
        simCache.set(id, sims);
      }
      for (let i = 0; i < n; i++) {
        const s = sims[i] as number;
        if (s > (best[i] as number)) best[i] = s;
      }
    }
    let sum = 0;
    let weightSum = 0;
    for (let i = 0; i < n; i++) {
      const w = weights === undefined ? 1 : (weights[i] as number);
      sum += w * (best[i] as number);
      weightSum += w;
    }
    out[d] = mean ? (weightSum > 0 ? sum / weightSum : 0) : sum;
  }
  return out;
}

/**
 * MaxSim over token-ID docs with lazy vector gather: `tokenVector(id)` is
 * called once per unique id across ALL docs, and the (query token × vocab
 * token) similarities are memoized alongside. This skips materializing the
 * ~450 per-token vectors of every candidate chunk — the depth-50 rerank
 * gathers only the candidate set's few thousand unique tokens per query.
 * Scores are bit-identical to `maxsimScoreAll` over `tokenEmbed`ed docs.
 */
export function maxsimScoreTokens(
  query: TokenEmbedding,
  docs: ReadonlyArray<ArrayLike<number>>,
  tokenVector: (id: number) => Float32Array,
  opts: MaxSimOptions = {},
): number[] {
  const n = query.ids.length;
  const weights = opts.weights;
  if (weights !== undefined && weights.length !== n) {
    throw new Error(`maxsim: ${weights.length} weights for ${n} query tokens`);
  }
  const mean = (opts.aggregate ?? 'sum') === 'mean';
  const out = new Array<number>(docs.length).fill(0);
  if (n === 0) return out;
  const { dim } = query;
  const q = query.vectors;
  const simCache = new Map<number, Float64Array>();
  const best = new Float64Array(n);
  for (let d = 0; d < docs.length; d++) {
    const ids = docs[d] as ArrayLike<number>;
    const m = ids.length;
    if (m === 0) continue;
    best.fill(Number.NEGATIVE_INFINITY);
    for (let t = 0; t < m; t++) {
      const id = ids[t] as number;
      let sims = simCache.get(id);
      if (sims === undefined) {
        sims = new Float64Array(n);
        const vec = tokenVector(id);
        if (vec.length !== dim) {
          throw new Error(`maxsim: token vector dim ${vec.length} does not match query dim ${dim}`);
        }
        for (let i = 0; i < n; i++) {
          const qBase = i * dim;
          let dot = 0;
          for (let j = 0; j < dim; j++) {
            dot += (q[qBase + j] as number) * (vec[j] as number);
          }
          sims[i] = dot;
        }
        simCache.set(id, sims);
      }
      for (let i = 0; i < n; i++) {
        const s = sims[i] as number;
        if (s > (best[i] as number)) best[i] = s;
      }
    }
    let sum = 0;
    let weightSum = 0;
    for (let i = 0; i < n; i++) {
      const w = weights === undefined ? 1 : (weights[i] as number);
      sum += w * (best[i] as number);
      weightSum += w;
    }
    out[d] = mean ? (weightSum > 0 ? sum / weightSum : 0) : sum;
  }
  return out;
}
