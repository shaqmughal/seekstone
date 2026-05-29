import { describe, expect, it } from 'vitest';
import { percentile, summarise } from './percentiles.js';

describe('percentile', () => {
  it('returns NaN for empty input', () => {
    expect(percentile([], 50)).toBeNaN();
  });

  it('clamps p<=0 to min and p>=100 to max', () => {
    const v = [1, 2, 3, 4, 5];
    expect(percentile(v, 0)).toBe(1);
    expect(percentile(v, -10)).toBe(1);
    expect(percentile(v, 100)).toBe(5);
    expect(percentile(v, 200)).toBe(5);
  });

  it('uses nearest-rank for typical distributions', () => {
    // 10 values 1..10. p50 → rank ceil(5) = 5 → value 5. p95 → ceil(9.5)=10 → 10.
    const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(v, 50)).toBe(5);
    expect(percentile(v, 90)).toBe(9);
    expect(percentile(v, 95)).toBe(10);
    expect(percentile(v, 99)).toBe(10);
  });
});

describe('summarise', () => {
  it('returns zeros for empty', () => {
    const d = summarise([]);
    expect(d).toEqual({ n: 0, min: 0, median: 0, p90: 0, p95: 0, p99: 0, max: 0, mean: 0 });
  });

  it('computes basic stats', () => {
    const d = summarise([3, 1, 2, 5, 4]);
    expect(d.n).toBe(5);
    expect(d.min).toBe(1);
    expect(d.max).toBe(5);
    expect(d.median).toBe(3);
    expect(d.mean).toBe(3);
  });
});
