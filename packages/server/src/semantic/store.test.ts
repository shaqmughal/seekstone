import { describe, expect, it } from 'vitest';
import { DEFAULT_POOLING, SemanticStore } from './store.js';

const vec = (...xs: number[]) => new Float32Array(xs);
/** Default spans: chunk i covers [i*100, i*100+50). */
const spansFor = (chunks: number) =>
  new Uint32Array(
    Array.from({ length: chunks * 2 }, (_, i) =>
      i % 2 === 0 ? (i / 2) * 100 : ((i - 1) / 2) * 100 + 50,
    ),
  );

describe('SemanticStore', () => {
  it('ranks notes by best-chunk cosine with the winning chunk index and span', () => {
    const store = new SemanticStore(2);
    store.setNote('a.md', vec(1, 0, 0, 1), spansFor(2)); // chunk 0 = [1,0], chunk 1 = [0,1]
    store.setNote('b.md', vec(0.6, 0.8), spansFor(1));
    const hits = store.topNotes(vec(0, 1), 5);
    expect(hits.map((h) => h.path)).toEqual(['a.md', 'b.md']);
    expect(hits[0]?.chunkIndex).toBe(1);
    expect(hits[0]?.start).toBe(100);
    expect(hits[0]?.end).toBe(150);
    expect(hits[0]?.score).toBeCloseTo(1);
    expect(hits[1]?.score).toBeCloseTo(0.8);
  });

  it('replaces a note in place and tracks chunk counts', () => {
    const store = new SemanticStore(2);
    store.setNote('a.md', vec(1, 0, 0, 1, 1, 0), spansFor(3));
    expect(store.chunkCount).toBe(3);
    store.setNote('a.md', vec(0, 1), spansFor(1));
    expect(store.chunkCount).toBe(1);
    expect(store.noteCount).toBe(1);
    expect(store.topNotes(vec(1, 0), 1)[0]?.score).toBeCloseTo(0);
  });

  it('removes notes and ignores unknown removals', () => {
    const store = new SemanticStore(2);
    store.setNote('a.md', vec(1, 0), spansFor(1));
    store.removeNote('a.md');
    store.removeNote('ghost.md');
    expect(store.noteCount).toBe(0);
    expect(store.chunkCount).toBe(0);
    expect(store.topNotes(vec(1, 0), 5)).toEqual([]);
  });

  it('breaks score ties by path ascending and honors k', () => {
    const store = new SemanticStore(2);
    store.setNote('z.md', vec(1, 0), spansFor(1));
    store.setNote('a.md', vec(1, 0), spansFor(1));
    const hits = store.topNotes(vec(1, 0), 1);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.path).toBe('a.md');
  });

  it('rejects invalid dims, misshapen vectors, and mismatched spans', () => {
    expect(() => new SemanticStore(0)).toThrow(/invalid dim/);
    const store = new SemanticStore(3);
    expect(() => store.setNote('a.md', vec(1, 2), spansFor(1))).toThrow(/multiple of dim/);
    expect(() => store.setNote('a.md', new Float32Array(0), spansFor(0))).toThrow(
      /multiple of dim/,
    );
    expect(() => store.setNote('a.md', vec(1, 2, 3), spansFor(2))).toThrow(/spans length/);
    expect(() => store.topNotes(vec(1, 2), 5)).toThrow(/query dim/);
  });

  it('pools with the configured strategy but always returns the best chunk span', () => {
    const hub = new SemanticStore(2, { kind: 'softmax', temperature: 0.1 });
    // hub: chunk 1 is the lucky perfect match, the other 20 are off-topic.
    const n = 21;
    const packed = new Float32Array(n * 2);
    const spans = new Uint32Array(n * 2);
    for (let c = 0; c < n; c++) {
      packed.set(c === 1 ? [1, 0] : [0.6, 0.8], c * 2);
      spans.set([c * 100, c * 100 + 90], c * 2);
    }
    hub.setNote('hub.md', packed, spans);
    hub.setNote('exact.md', new Float32Array([0.95, 0.312]), new Uint32Array([0, 50]));
    const hits = hub.topNotes(new Float32Array([1, 0]), 2);
    expect(hits.map((h) => h.path)).toEqual(['exact.md', 'hub.md']);
    const hubHit = hits[1];
    expect(hubHit?.chunkIndex).toBe(1); // excerpt still slices the matching passage
    expect(hubHit?.start).toBe(100);
    expect(hubHit?.end).toBe(190);
    expect(hubHit?.score).toBeLessThan(1); // pooled below the lucky chunk's raw cosine

    const plain = new SemanticStore(2); // DEFAULT_POOLING
    plain.setNote('hub.md', packed, spans);
    plain.setNote('exact.md', new Float32Array([0.95, 0.312]), new Uint32Array([0, 50]));
    expect(plain.pooling).toBe(DEFAULT_POOLING);
    expect(() => new SemanticStore(2, { kind: 'softmax', temperature: 0 })).toThrow(/temperature/);
  });
});
