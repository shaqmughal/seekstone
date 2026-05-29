/**
 * Percentile and basic-stats helpers. All percentile functions assume
 * the caller may pass an already-sorted array; if not, pass `presorted: false`.
 *
 * Uses the "nearest-rank" method: p_k = sorted[ceil(k/100 * n) - 1]. This is
 * what most benchmark tools (hdr, oha) report and is what readers expect.
 */

export interface Distribution {
  n: number;
  min: number;
  median: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
}

export function percentile(values: number[], p: number, presorted = false): number {
  if (values.length === 0) return Number.NaN;
  const sorted = presorted ? values : [...values].sort((a, b) => a - b);
  if (p <= 0) return sorted[0] as number;
  if (p >= 100) return sorted[sorted.length - 1] as number;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[rank - 1] as number;
}

export function summarise(values: number[]): Distribution {
  if (values.length === 0) {
    return { n: 0, min: 0, median: 0, p90: 0, p95: 0, p99: 0, max: 0, mean: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    n: sorted.length,
    min: sorted[0] as number,
    median: percentile(sorted, 50, true),
    p90: percentile(sorted, 90, true),
    p95: percentile(sorted, 95, true),
    p99: percentile(sorted, 99, true),
    max: sorted[sorted.length - 1] as number,
    mean: sum / sorted.length,
  };
}
