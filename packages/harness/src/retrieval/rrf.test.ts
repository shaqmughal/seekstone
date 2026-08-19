import { describe, expect, it } from 'vitest';
import { rrfFuse } from './rrf.js';

describe('rrfFuse', () => {
  it('ranks a path high in both lists above single-list paths', () => {
    const fused = rrfFuse([
      ['both.md', 'lex.md'],
      ['both.md', 'sem.md'],
    ]);
    expect(fused[0]).toBe('both.md');
    expect(fused).toHaveLength(3);
  });

  it('scores by summed reciprocal ranks with k damping', () => {
    // a: 1/(60+1) + 1/(60+2); b: 1/(60+2) + 1/(60+1) — a tie, broken by path.
    const fused = rrfFuse([
      ['a.md', 'b.md'],
      ['b.md', 'a.md'],
    ]);
    expect(fused).toEqual(['a.md', 'b.md']);
  });

  it('keeps paths that appear in only one ranking', () => {
    const fused = rrfFuse([['solo.md'], []]);
    expect(fused).toEqual(['solo.md']);
  });

  it('is deterministic on ties via path-ascending order', () => {
    const fused = rrfFuse([['z.md'], ['a.md']]);
    expect(fused).toEqual(['a.md', 'z.md']);
  });

  it('the union covers every input path exactly once', () => {
    const fused = rrfFuse([
      ['a.md', 'b.md', 'c.md'],
      ['c.md', 'd.md'],
    ]);
    expect([...fused].sort()).toEqual(['a.md', 'b.md', 'c.md', 'd.md']);
  });
});
