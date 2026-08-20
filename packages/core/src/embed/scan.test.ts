import { describe, expect, it } from 'vitest';
import { createVectorSet, scanTopNotes } from './scan.js';

const vec = (...xs: number[]) => new Float32Array(xs);

describe('createVectorSet / scanTopNotes', () => {
  it('ranks notes by cosine score descending', () => {
    const set = createVectorSet(2);
    set.add('a.md', vec(1, 0));
    set.add('b.md', vec(0.6, 0.8));
    set.add('c.md', vec(0, 1));
    const hits = scanTopNotes(vec(0, 1), set, 3);
    expect(hits.map((h) => h.path)).toEqual(['c.md', 'b.md', 'a.md']);
    expect(hits[0]?.score).toBeCloseTo(1);
    expect(hits[1]?.score).toBeCloseTo(0.8);
  });

  it('max-pools multiple chunks of one note into a single hit', () => {
    const set = createVectorSet(2);
    set.add('a.md', vec(1, 0));
    set.add('a.md', vec(0, 1));
    set.add('b.md', vec(0.5, 0.5));
    const hits = scanTopNotes(vec(0, 1), set, 10);
    expect(hits.map((h) => h.path)).toEqual(['a.md', 'b.md']);
    expect(hits[0]?.score).toBeCloseTo(1);
  });

  it('breaks score ties by path ascending, deterministically', () => {
    const set = createVectorSet(2);
    set.add('z.md', vec(1, 0));
    set.add('a.md', vec(1, 0));
    set.add('m.md', vec(1, 0));
    const hits = scanTopNotes(vec(1, 0), set, 3);
    expect(hits.map((h) => h.path)).toEqual(['a.md', 'm.md', 'z.md']);
  });

  it('caps results at k and tolerates k larger than the set', () => {
    const set = createVectorSet(2);
    set.add('a.md', vec(1, 0));
    set.add('b.md', vec(0, 1));
    expect(scanTopNotes(vec(1, 0), set, 1)).toHaveLength(1);
    expect(scanTopNotes(vec(1, 0), set, 99)).toHaveLength(2);
    expect(scanTopNotes(vec(1, 0), set, 0)).toHaveLength(0);
  });

  it('grows past its initial capacity without losing vectors', () => {
    const dim = 4;
    const set = createVectorSet(dim);
    const n = 3000;
    for (let i = 0; i < n; i++) {
      const v = new Float32Array(dim);
      v[i % dim] = 1;
      set.add(`note-${String(i).padStart(4, '0')}.md`, v);
    }
    expect(set.size).toBe(n);
    const hits = scanTopNotes(vec(0, 0, 0, 1), set, 5);
    expect(hits[0]?.score).toBeCloseTo(1);
    expect(hits[0]?.path).toBe('note-0003.md');
  });

  it('rejects dimension mismatches on add and scan', () => {
    const set = createVectorSet(3);
    expect(() => set.add('a.md', vec(1, 2))).toThrow(/expected dim 3/);
    expect(() => scanTopNotes(vec(1, 2), set, 5)).toThrow(/query dim 2/);
  });

  it('rejects an invalid dimension', () => {
    expect(() => createVectorSet(0)).toThrow(/invalid dim/);
    expect(() => createVectorSet(1.5)).toThrow(/invalid dim/);
  });

  it('rejects a vector set not built by createVectorSet', () => {
    const impostor = { dim: 2, size: 0, add() {} };
    expect(() => scanTopNotes(vec(1, 0), impostor, 5)).toThrow(/expected a set from/);
  });

  it('scans an empty set to an empty result', () => {
    expect(scanTopNotes(vec(1, 0), createVectorSet(2), 5)).toEqual([]);
  });

  it('top2mean pooling averages the two best chunks of a note', () => {
    const set = createVectorSet(2);
    // Hub note: one lucky chunk, one weak chunk.
    set.add('hub.md', vec(1, 0));
    set.add('hub.md', vec(0, 1));
    // Focused note: two consistently relevant chunks.
    set.add('focused.md', vec(0.9, 0.1));
    set.add('focused.md', vec(0.8, 0.2));
    const maxHits = scanTopNotes(vec(1, 0), set, 2, 'max');
    expect(maxHits[0]?.path).toBe('hub.md'); // max rewards the lucky chunk
    const pooled = scanTopNotes(vec(1, 0), set, 2, 'top2mean');
    expect(pooled[0]?.path).toBe('focused.md'); // (0.9+0.8)/2 > (1+0)/2
    expect(pooled[0]?.score).toBeCloseTo(0.85);
    expect(pooled[1]?.score).toBeCloseTo(0.5);
  });

  it('top2mean keeps a single-chunk note at its full score', () => {
    const set = createVectorSet(2);
    set.add('single.md', vec(1, 0));
    const hits = scanTopNotes(vec(1, 0), set, 1, 'top2mean');
    expect(hits[0]?.score).toBeCloseTo(1);
  });
});
