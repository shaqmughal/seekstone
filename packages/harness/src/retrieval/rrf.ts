/**
 * Reciprocal-rank fusion (Cormack et al.): score(p) = Σ_r 1 / (k + rank_r(p))
 * over each ranking r containing p (1-based ranks; absent contributes 0).
 * k = 60 is the standard damping constant.
 */
export function rrfFuse(rankings: string[][], k = 60): string[] {
  const scores = new Map<string, number>();
  for (const ranking of rankings) {
    for (let i = 0; i < ranking.length; i++) {
      const path = ranking[i] as string;
      scores.set(path, (scores.get(path) ?? 0) + 1 / (k + i + 1));
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([path]) => path);
}
