/**
 * SHA-314: MaxSim late-interaction rerank of the stage-1 semantic top-50.
 *
 * Stage 1 (mean-pooled cosine scan) picks 50 candidate notes, each carrying
 * its best chunk. This module re-scores those candidates with token-level
 * MaxSim (`@seekstone/core/embed`): per query token, max cosine over the
 * chunk's token vectors — recovering discriminating terms ("lead",
 * "sulphate") that mean pooling dilutes. The final order fuses the MaxSim
 * score with stage 1's via min-max weighted sum (`wsumFuse`), so `beta: 1`
 * is a pure rerank and `beta: 0` reproduces stage-1 order.
 *
 * IDF option (R3): common query tokens max-match almost any chunk and
 * flatten the signal, so weights can down-weight them by document frequency
 * over the CANDIDATE SET — computed from the 50 chunks' token-id sets at
 * query time (BM25 idf form), needing no corpus-wide statistics, no cache
 * change, and no MiniSearch coupling.
 */
import {
  type Embedder,
  isTokenEmbedder,
  maxsimScoreTokens,
  type TokenEmbedding,
} from '@seekstone/core/embed';
import { type ScoredHit, wsumFuse } from './fusion.js';

export interface MaxsimRerankOptions {
  /** Query-token aggregation for the MaxSim score (see core maxsim.ts). */
  aggregate: 'sum' | 'mean';
  /** Down-weight query tokens by candidate-set IDF (BM25 form). */
  idf?: boolean;
  /** Weight on the MaxSim score when fusing with stage-1; 1 = pure rerank. */
  beta?: number;
}

/**
 * Re-rank `candidates` (stage-1 order, each with its best chunk's index into
 * `chunkTokenIds`, pre-tokenized at index build — tokenization is
 * query-independent and dominates rerank latency otherwise) and return note
 * paths, best first. Falls back to stage-1 order when the query produces no
 * tokens.
 */
export function maxsimRerank(
  embedder: Embedder,
  query: string,
  candidates: ReadonlyArray<{ path: string; score: number; chunk: number }>,
  chunkTokenIds: ReadonlyArray<readonly number[]>,
  opts: MaxsimRerankOptions,
): string[] {
  if (!isTokenEmbedder(embedder)) {
    throw new Error(`maxsim rerank: embedder "${embedder.id}" exposes no token vectors`);
  }
  const qTok = embedder.tokenEmbed(query);
  if (qTok.ids.length === 0 || candidates.length === 0) {
    return candidates.map((c) => c.path);
  }
  const docIds = candidates.map((c) => {
    const ids = chunkTokenIds[c.chunk];
    if (ids === undefined) {
      throw new Error(`maxsim rerank: no retained token ids for chunk index ${c.chunk}`);
    }
    return ids;
  });
  const weights = opts.idf ? candidateSetIdf(qTok, docIds) : undefined;
  const scores = maxsimScoreTokens(qTok, docIds, (id) => embedder.tokenVector(id), {
    aggregate: opts.aggregate,
    weights,
  });
  const maxsimHits: ScoredHit[] = candidates.map((c, i) => ({
    path: c.path,
    score: scores[i] as number,
  }));
  return wsumFuse(candidates, maxsimHits, opts.beta ?? 1);
}

/**
 * BM25-form IDF of each query token over the candidate chunks' token-id
 * sets: `ln(1 + (N − df + 0.5) / (df + 0.5))`. A token in every candidate
 * gets a near-zero weight; a token in one candidate dominates.
 */
function candidateSetIdf(qTok: TokenEmbedding, docIds: ReadonlyArray<readonly number[]>): number[] {
  const n = docIds.length;
  const docSets = docIds.map((d) => new Set(d));
  return qTok.ids.map((id) => {
    let df = 0;
    for (const set of docSets) {
      if (set.has(id)) df++;
    }
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  });
}
