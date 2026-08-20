import { describe, expect, it } from 'vitest';
import { SemanticStore } from './store.js';

const vec = (...xs: number[]) => new Float32Array(xs);

describe('SemanticStore', () => {
  it('ranks notes by best-chunk cosine and reports the winning chunk index', () => {
    const store = new SemanticStore(2);
    store.setNote('a.md', vec(1, 0, 0, 1)); // chunk 0 = [1,0], chunk 1 = [0,1]
    store.setNote('b.md', vec(0.6, 0.8));
    const hits = store.topNotes(vec(0, 1), 5);
    expect(hits.map((h) => h.path)).toEqual(['a.md', 'b.md']);
    expect(hits[0]?.chunkIndex).toBe(1);
    expect(hits[0]?.score).toBeCloseTo(1);
    expect(hits[1]?.score).toBeCloseTo(0.8);
  });

  it('replaces a note in place and tracks chunk counts', () => {
    const store = new SemanticStore(2);
    store.setNote('a.md', vec(1, 0, 0, 1, 1, 0));
    expect(store.chunkCount).toBe(3);
    store.setNote('a.md', vec(0, 1));
    expect(store.chunkCount).toBe(1);
    expect(store.noteCount).toBe(1);
    expect(store.topNotes(vec(1, 0), 1)[0]?.score).toBeCloseTo(0);
  });

  it('removes notes and ignores unknown removals', () => {
    const store = new SemanticStore(2);
    store.setNote('a.md', vec(1, 0));
    store.removeNote('a.md');
    store.removeNote('ghost.md');
    expect(store.noteCount).toBe(0);
    expect(store.chunkCount).toBe(0);
    expect(store.topNotes(vec(1, 0), 5)).toEqual([]);
  });

  it('breaks score ties by path ascending and honors k', () => {
    const store = new SemanticStore(2);
    store.setNote('z.md', vec(1, 0));
    store.setNote('a.md', vec(1, 0));
    const hits = store.topNotes(vec(1, 0), 1);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.path).toBe('a.md');
  });

  it('rejects invalid dims and misshapen vectors', () => {
    expect(() => new SemanticStore(0)).toThrow(/invalid dim/);
    const store = new SemanticStore(3);
    expect(() => store.setNote('a.md', vec(1, 2))).toThrow(/multiple of dim/);
    expect(() => store.setNote('a.md', new Float32Array(0))).toThrow(/multiple of dim/);
    expect(() => store.topNotes(vec(1, 2), 5)).toThrow(/query dim/);
  });
});
