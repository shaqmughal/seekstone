/**
 * Mutable chunk-vector store for the live server: one packed Float32Array of
 * chunk embeddings per note, so a watcher-driven re-embed replaces a single
 * map entry (the harness's append-only VectorSet can't mutate). Scanning
 * iterates note arrays with the same tight dot-product loop — ~10k map
 * entries of overhead on top of the identical multiply count.
 *
 * Vectors are L2-normalized, so dot product == cosine similarity. A note's
 * score is its best chunk (max pooling — the recipe the SHA-307 eval chose),
 * and the winning chunk's index is kept so the excerpt can come from the
 * matching chunk instead of the note head.
 */

export interface SemanticHit {
  path: string;
  score: number;
  /** Index of the note's best-scoring chunk (chunkNote() order). */
  chunkIndex: number;
}

export class SemanticStore {
  readonly dim: number;
  private readonly notes = new Map<string, Float32Array>();
  private chunks = 0;

  constructor(dim: number) {
    if (!Number.isInteger(dim) || dim <= 0) {
      throw new Error(`semantic store: invalid dim ${dim}`);
    }
    this.dim = dim;
  }

  /** Total chunk vectors across all notes. */
  get chunkCount(): number {
    return this.chunks;
  }

  get noteCount(): number {
    return this.notes.size;
  }

  /** Replace (or insert) a note's packed chunk vectors. */
  setNote(path: string, packed: Float32Array): void {
    if (packed.length === 0 || packed.length % this.dim !== 0) {
      throw new Error(
        `semantic store: packed length ${packed.length} is not a positive multiple of dim ${this.dim} (${path})`,
      );
    }
    const prev = this.notes.get(path);
    if (prev) this.chunks -= prev.length / this.dim;
    this.notes.set(path, packed);
    this.chunks += packed.length / this.dim;
  }

  removeNote(path: string): void {
    const prev = this.notes.get(path);
    if (!prev) return;
    this.chunks -= prev.length / this.dim;
    this.notes.delete(path);
  }

  getNote(path: string): Float32Array | undefined {
    return this.notes.get(path);
  }

  /** Iterate (path, packed vectors) — cache serialization uses this. */
  entries(): IterableIterator<[string, Float32Array]> {
    return this.notes.entries();
  }

  /** Top `k` notes by max-pooled chunk cosine, ties broken path-ascending. */
  topNotes(query: Float32Array, k: number): SemanticHit[] {
    if (query.length !== this.dim) {
      throw new Error(`semantic store: query dim ${query.length} does not match ${this.dim}`);
    }
    const dim = this.dim;
    const hits: SemanticHit[] = [];
    for (const [path, packed] of this.notes) {
      let best = Number.NEGATIVE_INFINITY;
      let bestChunk = 0;
      const n = packed.length / dim;
      for (let c = 0; c < n; c++) {
        const base = c * dim;
        let score = 0;
        for (let j = 0; j < dim; j++) {
          score += (packed[base + j] as number) * (query[j] as number);
        }
        if (score > best) {
          best = score;
          bestChunk = c;
        }
      }
      hits.push({ path, score: best, chunkIndex: bestChunk });
    }
    return hits
      .sort((a, b) => b.score - a.score || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
      .slice(0, Math.max(0, k));
  }
}
