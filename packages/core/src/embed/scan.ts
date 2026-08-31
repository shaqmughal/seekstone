/**
 * Packed chunk-vector store + brute-force cosine scan.
 *
 * All chunk vectors live in one contiguous Float32Array (grow-by-doubling) so
 * the scan is a tight dot-product loop — ~3 ms for 10k × 384d on Apple
 * Silicon, which is why there is no ANN index at vault scale. Vectors are
 * expected to be L2-normalized, so dot product == cosine similarity.
 */

import { assertValidPooling, type ChunkPooling, PoolAccumulator } from './pooling.js';

export type { ChunkPooling } from './pooling.js';

export interface VectorSet {
  readonly dim: number;
  /** Number of chunk vectors stored. */
  readonly size: number;
  add(path: string, vec: Float32Array): void;
}

class PackedVectorSet implements VectorSet {
  readonly dim: number;
  readonly paths: string[] = [];
  data: Float32Array;

  constructor(dim: number) {
    if (!Number.isInteger(dim) || dim <= 0) throw new Error(`vector set: invalid dim ${dim}`);
    this.dim = dim;
    this.data = new Float32Array(256 * dim);
  }

  get size(): number {
    return this.paths.length;
  }

  add(path: string, vec: Float32Array): void {
    if (vec.length !== this.dim) {
      throw new Error(`vector set: expected dim ${this.dim}, got ${vec.length} for ${path}`);
    }
    const offset = this.paths.length * this.dim;
    if (offset + this.dim > this.data.length) {
      const grown = new Float32Array(this.data.length * 2);
      grown.set(this.data);
      this.data = grown;
    }
    this.data.set(vec, offset);
    this.paths.push(path);
  }
}

export function createVectorSet(dim: number): VectorSet {
  return new PackedVectorSet(dim);
}

/**
 * Score every chunk against `query`, pool per note path (see pooling.ts),
 * and return the top `k` notes by score (ties broken by path ascending,
 * deterministically). `chunk` is the max-scoring chunk's index in the set's
 * add order, whatever pooling ranked the note — the passage that matched
 * best (SHA-314 rerank consumes it).
 */
export function scanTopNotes(
  query: Float32Array,
  set: VectorSet,
  k: number,
  pooling: ChunkPooling = 'max',
): Array<{ path: string; score: number; chunk: number }> {
  if (!(set instanceof PackedVectorSet)) {
    throw new Error('vector set: expected a set from createVectorSet()');
  }
  if (query.length !== set.dim) {
    throw new Error(`vector set: query dim ${query.length} does not match set dim ${set.dim}`);
  }
  assertValidPooling(pooling);
  const { dim, paths, data } = set;
  const acc = new Map<string, PoolAccumulator>();
  for (let c = 0; c < paths.length; c++) {
    const base = c * dim;
    let score = 0;
    for (let j = 0; j < dim; j++) {
      score += (data[base + j] as number) * (query[j] as number);
    }
    const path = paths[c] as string;
    let a = acc.get(path);
    if (a === undefined) {
      a = new PoolAccumulator(pooling);
      acc.set(path, a);
    }
    a.add(score, c);
  }
  const pooled: Array<[string, number, number]> = [...acc.entries()].map(([path, a]) => [
    path,
    a.pool(pooling),
    a.bestChunk,
  ]);
  return pooled
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, Math.max(0, k))
    .map(([path, score, chunk]) => ({ path, score, chunk }));
}
