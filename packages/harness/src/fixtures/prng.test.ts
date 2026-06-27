import { describe, expect, it } from 'vitest';
import { Rng, zipfCdf, zipfPick } from './prng.js';

describe('Rng', () => {
  it('is deterministic: same seed → identical float sequence', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds diverge', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('next() stays within [0, 1)', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int() is inclusive of both bounds and never escapes the range', () => {
    const r = new Rng(99);
    let sawMin = false;
    let sawMax = false;
    for (let i = 0; i < 2000; i++) {
      const v = r.int(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
      if (v === 3) sawMin = true;
      if (v === 6) sawMax = true;
    }
    expect(sawMin).toBe(true);
    expect(sawMax).toBe(true);
  });

  it('int(n, n) always returns n', () => {
    const r = new Rng(5);
    expect(r.int(4, 4)).toBe(4);
  });

  it('chance(1) is always true and chance(0) is always false', () => {
    const r = new Rng(3);
    for (let i = 0; i < 50; i++) {
      expect(r.chance(1)).toBe(true);
      expect(r.chance(0)).toBe(false);
    }
  });

  it('pick() returns an element of the array', () => {
    const r = new Rng(11);
    const arr = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(r.pick(arr));
    }
  });

  it('pick() throws on an empty array', () => {
    expect(() => new Rng(1).pick([])).toThrow(/empty/);
  });

  it('shuffle() is a deterministic permutation that preserves the multiset', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = new Rng(42).shuffle([...original]);
    const b = new Rng(42).shuffle([...original]);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(original);
  });

  it('sample() returns n distinct elements without mutating the source', () => {
    const src = Array.from({ length: 20 }, (_, i) => i);
    const r = new Rng(42);
    const picked = r.sample(src, 5);
    expect(picked).toHaveLength(5);
    expect(new Set(picked).size).toBe(5);
    expect(picked.every((v) => src.includes(v))).toBe(true);
    // source untouched
    expect(src).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it('sample() caps at the source length when n exceeds it', () => {
    expect(new Rng(1).sample([10, 20, 30], 10)).toHaveLength(3);
  });
});

describe('zipfCdf', () => {
  it('returns a normalized, strictly increasing CDF ending at 1', () => {
    const cdf = zipfCdf(5);
    expect(cdf).toHaveLength(5);
    for (let i = 1; i < cdf.length; i++) {
      expect(cdf[i] as number).toBeGreaterThan(cdf[i - 1] as number);
    }
    expect(cdf[cdf.length - 1]).toBeCloseTo(1, 10);
  });

  it('a single-item vocab maps to [1]', () => {
    expect(zipfCdf(1)).toEqual([1]);
  });
});

describe('zipfPick', () => {
  it('returns an in-range 0-based rank', () => {
    const cdf = zipfCdf(10);
    const r = new Rng(42);
    for (let i = 0; i < 500; i++) {
      const rank = zipfPick(r, cdf);
      expect(rank).toBeGreaterThanOrEqual(0);
      expect(rank).toBeLessThan(10);
    }
  });

  it('is head-biased: rank 0 is drawn far more often than the tail', () => {
    const cdf = zipfCdf(20);
    const r = new Rng(42);
    let head = 0;
    let tail = 0;
    for (let i = 0; i < 5000; i++) {
      const rank = zipfPick(r, cdf);
      if (rank === 0) head++;
      if (rank === 19) tail++;
    }
    expect(head).toBeGreaterThan(tail);
  });

  it('is deterministic given the same seed', () => {
    const cdf = zipfCdf(15);
    const a = new Rng(7);
    const b = new Rng(7);
    const seqA = Array.from({ length: 20 }, () => zipfPick(a, cdf));
    const seqB = Array.from({ length: 20 }, () => zipfPick(b, cdf));
    expect(seqA).toEqual(seqB);
  });
});
