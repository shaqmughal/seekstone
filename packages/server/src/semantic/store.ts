/**
 * Mutable chunk-vector store for the live server: one packed Float32Array of
 * chunk embeddings per note (plus each chunk's [start, end) span in the
 * note's normalized body), so a watcher-driven re-embed replaces a single
 * map entry (the harness's append-only VectorSet can't mutate). Scanning
 * iterates note arrays with the same tight dot-product loop — ~10k map
 * entries of overhead on top of the identical multiply count.
 *
 * Vectors are L2-normalized, so dot product == cosine similarity. A note's
 * score is its best chunk (max pooling — the recipe the SHA-307 eval chose),
 * and the winning chunk's span is returned so the excerpt can be sliced from
 * the matching passage without re-chunking the note.
 */

export interface NoteVectors {
  /** chunkCount × dim floats, row-major. */
  packed: Float32Array;
  /** chunkCount × 2 uint32s: [start, end) body offsets per chunk. */
  spans: Uint32Array;
}

export interface SemanticHit {
  path: string;
  score: number;
  /** Index of the note's best-scoring chunk (chunkNote() order). */
  chunkIndex: number;
  /** Body span of the best chunk (CRLF-normalized offsets). */
  start: number;
  end: number;
}

export class SemanticStore {
  readonly dim: number;
  private readonly notes = new Map<string, NoteVectors>();
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

  /** Replace (or insert) a note's packed chunk vectors and spans. */
  setNote(path: string, packed: Float32Array, spans: Uint32Array): void {
    if (packed.length === 0 || packed.length % this.dim !== 0) {
      throw new Error(
        `semantic store: packed length ${packed.length} is not a positive multiple of dim ${this.dim} (${path})`,
      );
    }
    const n = packed.length / this.dim;
    if (spans.length !== n * 2) {
      throw new Error(
        `semantic store: spans length ${spans.length} does not match ${n} chunks (${path})`,
      );
    }
    const prev = this.notes.get(path);
    if (prev) this.chunks -= prev.packed.length / this.dim;
    this.notes.set(path, { packed, spans });
    this.chunks += n;
  }

  removeNote(path: string): void {
    const prev = this.notes.get(path);
    if (!prev) return;
    this.chunks -= prev.packed.length / this.dim;
    this.notes.delete(path);
  }

  getNote(path: string): NoteVectors | undefined {
    return this.notes.get(path);
  }

  /** Iterate (path, note vectors) — cache serialization uses this. */
  entries(): IterableIterator<[string, NoteVectors]> {
    return this.notes.entries();
  }

  /** Top `k` notes by max-pooled chunk cosine, ties broken path-ascending. */
  topNotes(query: Float32Array, k: number): SemanticHit[] {
    if (query.length !== this.dim) {
      throw new Error(`semantic store: query dim ${query.length} does not match ${this.dim}`);
    }
    const dim = this.dim;
    const hits: SemanticHit[] = [];
    for (const [path, { packed, spans }] of this.notes) {
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
      hits.push({
        path,
        score: best,
        chunkIndex: bestChunk,
        start: spans[bestChunk * 2] as number,
        end: spans[bestChunk * 2 + 1] as number,
      });
    }
    return hits
      .sort((a, b) => b.score - a.score || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
      .slice(0, Math.max(0, k));
  }
}
