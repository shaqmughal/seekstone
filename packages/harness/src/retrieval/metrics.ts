/**
 * IR metrics for the golden-set retrieval eval. Both take a ranked list of
 * vault-relative paths and the query's expected (relevant) paths.
 */

/** True when any expected path appears in the top k of the ranking. */
export function hitAtK(ranked: string[], expected: string[], k: number): boolean {
  const relevant = new Set(expected);
  return ranked.slice(0, k).some((p) => relevant.has(p));
}

/**
 * Reciprocal rank of the first expected path within the top k (1-based),
 * or 0 when none appears.
 */
export function mrrAtK(ranked: string[], expected: string[], k: number): number {
  const relevant = new Set(expected);
  for (let i = 0; i < Math.min(k, ranked.length); i++) {
    if (relevant.has(ranked[i] as string)) return 1 / (i + 1);
  }
  return 0;
}
