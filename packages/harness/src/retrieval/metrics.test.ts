import { describe, expect, it } from 'vitest';
import { hitAtK, mrrAtK } from './metrics.js';

const ranked = ['a.md', 'b.md', 'c.md', 'd.md', 'e.md', 'f.md'];

describe('hitAtK', () => {
  it('is true when any expected path is within k', () => {
    expect(hitAtK(ranked, ['c.md'], 5)).toBe(true);
    expect(hitAtK(ranked, ['x.md', 'e.md'], 5)).toBe(true);
  });

  it('is false when the first expected path sits past k', () => {
    expect(hitAtK(ranked, ['f.md'], 5)).toBe(false);
    expect(hitAtK(ranked, ['missing.md'], 5)).toBe(false);
    expect(hitAtK([], ['a.md'], 5)).toBe(false);
  });
});

describe('mrrAtK', () => {
  it('returns the reciprocal rank of the first expected path', () => {
    expect(mrrAtK(ranked, ['a.md'], 10)).toBe(1);
    expect(mrrAtK(ranked, ['c.md'], 10)).toBeCloseTo(1 / 3);
    expect(mrrAtK(ranked, ['x.md', 'b.md'], 10)).toBeCloseTo(1 / 2);
  });

  it('returns 0 when no expected path is within k', () => {
    expect(mrrAtK(ranked, ['f.md'], 5)).toBe(0);
    expect(mrrAtK(ranked, ['missing.md'], 10)).toBe(0);
  });
});
