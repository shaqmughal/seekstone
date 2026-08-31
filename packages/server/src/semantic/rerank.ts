/**
 * SHA-314: MaxSim late-interaction rerank of the semantic top-50.
 *
 * Stage 1 (pooled cosine over chunk vectors) picks candidates; this stage
 * re-scores each candidate's best chunk with token-level MaxSim — per query
 * token, max cosine over the chunk's token vectors — recovering
 * discriminating terms that mean pooling dilutes. Query tokens are
 * IDF-weighted over the candidate set and the MaxSim score is fused with
 * stage 1's by min-max weighted sum. Dev-split winner (idf-b50):
 * mean aggregation, candidate-set IDF, beta 0.5 — semantic hit@5
 * 70.4 → 85.2 with lexical routing untouched.
 *
 * The hit's chunkIndex/span are NOT changed: the excerpt keeps showing the
 * stage-1 best-matching passage; only the note ORDER (and score) moves.
 */
import { candidateSetIdf, maxsimScoreTokens, type TokenEmbedder } from '@seekstone/core/embed';
import type { SemanticHit } from './store.js';

/** Fusion weight on the MaxSim score (0 = stage-1 only). Dev-split tuned. */
export const MAXSIM_BETA = 0.5;

const EMPTY: ArrayLike<number> = [];

/**
 * Re-rank `hits` (stage-1 order). `tokenIdsFor` supplies each hit's best
 * chunk's token ids; `undefined` (note changed inside the re-embed debounce
 * window) contributes only its stage-1 score, like the harness fusion.
 * Returns a new array; input hits are not mutated.
 */
export function maxsimRerankHits(
  embedder: TokenEmbedder,
  query: string,
  hits: ReadonlyArray<SemanticHit>,
  tokenIdsFor: (hit: SemanticHit) => ArrayLike<number> | undefined,
  beta: number = MAXSIM_BETA,
): SemanticHit[] {
  if (hits.length < 2 || beta <= 0) return [...hits];
  const qTok = embedder.tokenEmbed(query);
  if (qTok.ids.length === 0) return [...hits];
  const docs = hits.map((h) => tokenIdsFor(h) ?? EMPTY);
  const weights = candidateSetIdf(qTok.ids, docs);
  const maxsim = maxsimScoreTokens(qTok, docs, (id) => embedder.tokenVector(id), {
    aggregate: 'mean',
    weights,
  });
  const stage1 = normalize(hits.map((h) => h.score));
  const rerank = normalize(maxsim);
  return hits
    .map((h, i) => ({
      ...h,
      score: (1 - beta) * (stage1[i] as number) + beta * (rerank[i] as number),
    }))
    .sort((a, b) => b.score - a.score || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** Min-max normalize to [0, 1]; a constant list maps to all-1 (wsumFuse parity). */
function normalize(scores: readonly number[]): number[] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const s of scores) {
    if (s < min) min = s;
    if (s > max) max = s;
  }
  const span = max - min;
  return scores.map((s) => (span > 0 ? (s - min) / span : 1));
}
