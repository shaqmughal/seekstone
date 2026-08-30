import { describe, expect, it } from 'vitest';
import { assertValidPooling, PoolAccumulator, poolingId } from './pooling.js';
import { createVectorSet, scanTopNotes } from './scan.js';

const vec = (...xs: number[]) => new Float32Array(xs);

/** A hub note with one lucky chunk and many weak ones vs a small exact note. */
function hubVsExact() {
  const set = createVectorSet(2);
  set.add('hub.md', vec(1, 0)); // the lucky chunk: perfect match
  // 40 off-topic chunks at a realistic 0.6 cosine (shared vocabulary, wrong topic).
  for (let i = 0; i < 40; i++) set.add('hub.md', vec(0.6, 0.8));
  set.add('exact.md', vec(0.95, 0.312)); // single chunk, ~0.95 cosine
  return set;
}

describe('PoolAccumulator', () => {
  it('tracks best and second-best scores and the best chunk index', () => {
    const a = new PoolAccumulator('max');
    a.add(0.2, 0);
    a.add(0.9, 1);
    a.add(0.5, 2);
    expect(a.top).toBeCloseTo(0.9);
    expect(a.second).toBeCloseTo(0.5);
    expect(a.bestChunk).toBe(1);
    expect(a.count).toBe(3);
    expect(a.pool('max')).toBeCloseTo(0.9);
    expect(a.pool('top2mean')).toBeCloseTo(0.7);
  });

  it('pools an empty accumulator to -Infinity', () => {
    expect(new PoolAccumulator('max').pool('max')).toBe(Number.NEGATIVE_INFINITY);
  });

  it('logdiscount subtracts lambda·ln(chunkCount) from the best chunk', () => {
    const p = { kind: 'logdiscount', lambda: 0.1 } as const;
    const a = new PoolAccumulator(p);
    for (let i = 0; i < 8; i++) a.add(0.8, i);
    expect(a.pool(p)).toBeCloseTo(0.8 - 0.1 * Math.log(8));
    const single = new PoolAccumulator(p);
    single.add(0.8, 0);
    expect(single.pool(p)).toBeCloseTo(0.8); // ln(1) = 0: no penalty for one chunk
  });

  it('softmax pooling is bounded by [mean, max] and moves toward max as τ→0', () => {
    const scores = [0.9, 0.3, 0.3, 0.3];
    const mean = scores.reduce((x, y) => x + y) / scores.length;
    const at = (temperature: number) => {
      const p = { kind: 'softmax', temperature } as const;
      const a = new PoolAccumulator(p);
      for (const [i, s] of scores.entries()) a.add(s, i);
      return a.pool(p);
    };
    const cold = at(0.01);
    const warm = at(0.2);
    const hot = at(100);
    expect(cold).toBeCloseTo(0.9, 2);
    expect(warm).toBeLessThan(cold);
    expect(warm).toBeGreaterThan(mean);
    expect(hot).toBeCloseTo(mean, 2);
  });

  it('softmax keeps a single-chunk note at exactly its score', () => {
    const p = { kind: 'softmax', temperature: 0.1 } as const;
    const a = new PoolAccumulator(p);
    a.add(0.77, 0);
    expect(a.pool(p)).toBeCloseTo(0.77);
  });
});

describe('scanTopNotes with hub demotion', () => {
  it('max pooling lets the hub note win on its single lucky chunk', () => {
    const hits = scanTopNotes(vec(1, 0), hubVsExact(), 2, 'max');
    expect(hits.map((h) => h.path)).toEqual(['hub.md', 'exact.md']);
  });

  it('logdiscount and softmax promote the small exact note over the hub', () => {
    for (const pooling of [
      { kind: 'logdiscount', lambda: 0.02 } as const,
      { kind: 'softmax', temperature: 0.1 } as const,
    ]) {
      const hits = scanTopNotes(vec(1, 0), hubVsExact(), 2, pooling);
      expect(
        hits.map((h) => h.path),
        poolingId(pooling),
      ).toEqual(['exact.md', 'hub.md']);
    }
  });

  it('does not penalize a long note whose chunks are consistently relevant', () => {
    // Japan IS the answer for "island nation of east Asia": a long note with
    // many on-topic chunks must keep beating a short, weaker note.
    const set = createVectorSet(2);
    for (let i = 0; i < 40; i++) set.add('long-relevant.md', vec(0.9, 0.436));
    set.add('short-weak.md', vec(0.6, 0.8));
    for (const pooling of [
      'top2mean' as const,
      { kind: 'softmax', temperature: 0.1 } as const,
      { kind: 'logdiscount', lambda: 0.02 } as const,
    ]) {
      const hits = scanTopNotes(vec(1, 0), set, 2, pooling);
      expect(hits[0]?.path, poolingId(pooling)).toBe('long-relevant.md');
    }
  });

  it('rejects invalid pooling parameters', () => {
    expect(() => assertValidPooling({ kind: 'softmax', temperature: 0 })).toThrow(/temperature/);
    expect(() => assertValidPooling({ kind: 'logdiscount', lambda: -1 })).toThrow(/lambda/);
    expect(() => assertValidPooling('median' as never)).toThrow(/unknown kind/);
    expect(() => assertValidPooling({ kind: 'nope' } as never)).toThrow(/unknown kind/);
    expect(() =>
      scanTopNotes(vec(1, 0), hubVsExact(), 1, { kind: 'softmax', temperature: -1 }),
    ).toThrow();
  });

  it('names poolings stably for reports', () => {
    expect(poolingId('max')).toBe('max');
    expect(poolingId({ kind: 'logdiscount', lambda: 0.02 })).toBe('logdiscount-l0.02');
    expect(poolingId({ kind: 'softmax', temperature: 0.1 })).toBe('softmax-t0.1');
  });
});
