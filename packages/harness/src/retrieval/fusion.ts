/**
 * Hybrid-fusion candidates for the SHA-307 ship decision. The spike (SHA-257)
 * showed equal-weight RRF fuses lexical noise into semantic signal — these are
 * the alternatives, evaluated head-to-head via `retrieval --experiments`.
 */

export interface ScoredHit {
  path: string;
  score: number;
}

/**
 * Query routing: exact-lookup-shaped queries go to lexical, everything else
 * to semantic. A query routes to lexical when it IS a title among the top
 * lexical hits — the hit's basename words and the query words are the same
 * set. That is exactly the case MiniSearch's 3× title boost wins; a partial
 * title match ("green gemstones" vs a note titled "Green") stays semantic,
 * because the extra words mean the user is describing, not naming.
 */
export function routeToLexical(
  query: string,
  lexicalTop: ReadonlyArray<{ path: string }>,
  opts: { topN?: number } = {},
): boolean {
  const topN = opts.topN ?? 3;
  const words = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
  if (words.size === 0) return false;
  return lexicalTop.slice(0, topN).some((h) => {
    const base = (h.path.split('/').pop() ?? '').replace(/\.md$/, '').toLowerCase();
    const parts = new Set(base.split(/\W+/).filter(Boolean));
    return parts.size === words.size && [...parts].every((p) => words.has(p));
  });
}

/**
 * Score-weighted fusion: min-max normalize each list's scores to [0, 1]
 * within the list, then combine as `alpha·semantic + (1−alpha)·lexical`
 * (missing from a list contributes 0 from it). Ties break path-ascending.
 */
export function wsumFuse(
  lexical: ReadonlyArray<ScoredHit>,
  semantic: ReadonlyArray<ScoredHit>,
  alpha: number,
): string[] {
  const combined = new Map<string, number>();
  for (const [hits, weight] of [
    [lexical, 1 - alpha],
    [semantic, alpha],
  ] as const) {
    if (hits.length === 0 || weight === 0) continue;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const h of hits) {
      if (h.score < min) min = h.score;
      if (h.score > max) max = h.score;
    }
    const span = max - min;
    for (const h of hits) {
      const norm = span > 0 ? (h.score - min) / span : 1;
      combined.set(h.path, (combined.get(h.path) ?? 0) + weight * norm);
    }
  }
  return [...combined.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([path]) => path);
}
