/**
 * Tiny deterministic PRNG (mulberry32) + helpers.
 *
 * The whole fixture pipeline must be reproducible: same corpus + same seed →
 * byte-identical vault. `Math.random()` is banned across the harness (it would
 * break that contract and the profiler/safety determinism rules), so the
 * generator draws every random choice from one of these seeded streams.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    // Avoid a zero state; fold the seed into 32 bits.
    this.s = (seed ^ 0x9e3779b9) >>> 0;
  }

  /** Next float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Pick one element (uniform). */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('pick from empty array');
    return arr[this.int(0, arr.length - 1)] as T;
  }

  /** In-place Fisher–Yates shuffle; returns the same array. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j] as T, arr[i] as T];
    }
    return arr;
  }

  /**
   * Sample `n` distinct elements (returns fewer if the source is smaller).
   * Deterministic given the seed; does not mutate the input.
   */
  sample<T>(arr: readonly T[], n: number): T[] {
    return this.shuffle([...arr]).slice(0, Math.min(n, arr.length));
  }
}

/**
 * Zipfian rank weights for a vocabulary of `size` items: weight(rank) ∝ 1/rank.
 * Used to give tags/links a realistic heavy-head/long-tail frequency curve.
 * Returns a cumulative-distribution array for O(log n) sampling.
 */
export function zipfCdf(size: number): number[] {
  const cdf: number[] = [];
  let acc = 0;
  for (let r = 1; r <= size; r++) {
    acc += 1 / r;
    cdf.push(acc);
  }
  const total = acc;
  return cdf.map((c) => c / total);
}

/** Sample a 0-based rank from a Zipf CDF (heads are far more likely). */
export function zipfPick(rng: Rng, cdf: number[]): number {
  const x = rng.next();
  // linear scan is fine for our vocab sizes (≤ a few hundred)
  for (let i = 0; i < cdf.length; i++) {
    if (x <= (cdf[i] as number)) return i;
  }
  return cdf.length - 1;
}
