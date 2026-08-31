/**
 * SHA-315: graph-expansion eval conditions — the server's own expansion
 * (`expandHits` / `neighborsFor`, packages/server/src/semantic/expand.ts)
 * driven from the harness's per-eval semantic index, so the dev-split sweep
 * measures exactly the code that would ship.
 *
 * Seeds are the SHA-314 shipped rerank (maxsimRerankHits — mean aggregation,
 * candidate-set IDF, beta 0.5) of the stage-1 top-`depth`; the gate scores
 * come from the SAME full scan that produced the candidates (one scan per
 * query at k = every note, identical multiply count to the k=50 scan — only
 * the sort grows). Neighbor lookups reuse the eval's ServerContext: the same
 * backlink index and link extraction the live server holds warm.
 */
import { type Embedder, isTokenEmbedder, scanTopNotes } from '@seekstone/core/embed';
import type { ServerContext } from '../../../server/src/context.js';
import {
  type ExpandOptions,
  expandHits,
  neighborsFor,
} from '../../../server/src/semantic/expand.js';
import { maxsimRerankHits } from '../../../server/src/semantic/rerank.js';
import type { SemanticHit } from '../../../server/src/semantic/store.js';
import type { SemanticIndex } from './semantic.js';

export type { ExpandOptions } from '../../../server/src/semantic/expand.js';

export interface ExpandRanker {
  rank: (query: string, opts: ExpandOptions) => string[];
}

/**
 * Build a ranker whose neighbor memo lives for the whole eval (the fixture
 * is static). `depth` is the candidate depth fed to the rerank (the shipped
 * SEMANTIC_CANDIDATES = the eval's RETRIEVAL_DEPTH = 50).
 */
export function buildExpandRanker(
  embedder: Embedder,
  index: SemanticIndex,
  ctx: ServerContext,
  depth: number,
): ExpandRanker {
  if (!isTokenEmbedder(embedder)) {
    throw new Error(`graph expansion eval: embedder "${embedder.id}" exposes no token vectors`);
  }
  const tokenIds = index.tokenIds;
  if (tokenIds === undefined) {
    throw new Error('graph expansion eval: semantic index built without retained token ids');
  }
  const neighbors = neighborsFor(ctx.notes, ctx.backlinks);
  const noteCount = index.noteCount;

  return {
    rank(query, opts) {
      const scored = scanTopNotes(embedder.embed(query), index.set, noteCount);
      // Adapter: the harness's global chunk index rides in chunkIndex so
      // tokenIdsFor / span plumbing work unchanged; spans are unused here.
      const toHit = ({ path, score, chunk }: (typeof scored)[number]): SemanticHit => ({
        path,
        score,
        chunkIndex: chunk,
        start: 0,
        end: 0,
      });
      const seeds = maxsimRerankHits(
        embedder,
        query,
        scored.slice(0, depth).map(toHit),
        (hit) => tokenIds[hit.chunkIndex],
      );
      const byPath = new Map(scored.map((s) => [s.path, s]));
      const scoreNote = (path: string): SemanticHit | undefined => {
        const s = byPath.get(path);
        return s === undefined ? undefined : toHit(s);
      };
      return expandHits(seeds, neighbors, scoreNote, opts).map((h) => h.path);
    },
  };
}
