/**
 * Hybrid-mode query routing, the recipe the SHA-307 golden-set eval chose
 * over RRF and score-weighted fusion: a query goes to lexical search only
 * when it IS a top lexical hit's title — the hit's basename words and the
 * query words are the same set. Exact-name lookups are what MiniSearch's 3×
 * title boost wins; a query that merely *contains* a title ("green
 * gemstones" vs a note titled "Green") is describing, not naming, and stays
 * semantic. (The same rule lives in the harness's retrieval/fusion.ts, where
 * the eval that picked it runs.)
 */

/** Queries longer than this cannot plausibly be a title — skip lexical entirely. */
export const MAX_ROUTE_WORDS = 6;

export function queryWords(query: string): string[] {
  return query.toLowerCase().split(/\W+/).filter(Boolean);
}

export function routeToLexical(query: string, topPaths: readonly string[], topN = 3): boolean {
  const words = new Set(queryWords(query));
  if (words.size === 0) return false;
  return topPaths.slice(0, topN).some((path) => {
    // Index ids carry the platform separator — split on both.
    const base = (path.split(/[\\/]/).pop() ?? '').replace(/\.md$/, '').toLowerCase();
    const parts = new Set(base.split(/\W+/).filter(Boolean));
    return parts.size === words.size && [...parts].every((p) => words.has(p));
  });
}
