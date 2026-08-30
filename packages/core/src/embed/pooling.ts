/**
 * Chunk → note score pooling (SHA-313).
 *
 * A note is embedded as many chunk vectors; retrieval scores every chunk and
 * must reduce them to one note score. Every pooling here consumes the SAME
 * per-chunk dot products — the choice changes aggregation only, never the
 * multiply count, so query latency is identical across poolings.
 *
 * - `max`: the single best chunk. A hub note with hundreds of chunks holds
 *   hundreds of lottery tickets, so giant articles crowd out precise ones.
 * - `top2mean`: mean of the two best chunks (a single-chunk note keeps its
 *   full score) — demands sustained relevance from large notes.
 * - `logdiscount`: best chunk minus `lambda · ln(chunkCount)` — a direct
 *   length penalty; risks burying long notes that ARE the answer.
 * - `softmax`: softmax-weighted mean of chunk scores at `temperature` —
 *   approaches max as τ→0 and the plain mean as τ→∞; a lucky lone chunk
 *   is diluted by the note's many weak ones, while a note whose best
 *   chunks agree keeps its score.
 *
 * The winning chunk (for excerpts / spans) is always the max-scoring chunk,
 * whatever pooling ranks the note — the excerpt should show the passage
 * that matched best.
 */

export type ChunkPooling =
  | 'max'
  | 'top2mean'
  | { kind: 'logdiscount'; lambda: number }
  | { kind: 'softmax'; temperature: number };

/** Human-readable id for reports and condition names, e.g. `softmax-t0.1`. */
export function poolingId(p: ChunkPooling): string {
  if (typeof p === 'string') return p;
  return p.kind === 'logdiscount' ? `logdiscount-l${p.lambda}` : `softmax-t${p.temperature}`;
}

/**
 * Streaming per-note accumulator: feed each chunk's score (with its index),
 * then `pool()` for the note score. Tracks only O(1) state per note so the
 * scan stays a single pass over the packed vectors.
 */
export class PoolAccumulator {
  top = Number.NEGATIVE_INFINITY;
  second = Number.NEGATIVE_INFINITY;
  bestChunk = 0;
  count = 0;
  /** Σ w_i and Σ s_i·w_i with w_i = exp((s_i − 1) / τ); shift keeps exp() ≤ 1. */
  private sumW = 0;
  private sumSW = 0;
  private readonly invTemp: number;

  constructor(pooling: ChunkPooling) {
    this.invTemp =
      typeof pooling === 'object' && pooling.kind === 'softmax' ? 1 / pooling.temperature : 0;
  }

  add(score: number, chunkIndex: number): void {
    this.count++;
    if (score > this.top) {
      this.second = this.top;
      this.top = score;
      this.bestChunk = chunkIndex;
    } else if (score > this.second) {
      this.second = score;
    }
    if (this.invTemp > 0) {
      const w = Math.exp((score - 1) * this.invTemp);
      this.sumW += w;
      this.sumSW += score * w;
    }
  }

  pool(pooling: ChunkPooling): number {
    if (this.count === 0) return Number.NEGATIVE_INFINITY;
    if (pooling === 'max') return this.top;
    if (pooling === 'top2mean') {
      return this.second === Number.NEGATIVE_INFINITY ? this.top : (this.top + this.second) / 2;
    }
    if (pooling.kind === 'logdiscount') return this.top - pooling.lambda * Math.log(this.count);
    // softmax: sumW > 0 whenever count > 0 (exp never underflows to 0 for cosines).
    return this.sumW > 0 ? this.sumSW / this.sumW : this.top;
  }
}

export function assertValidPooling(p: ChunkPooling): void {
  // Captured before narrowing: in the unknown-kind branches `p` is `never`
  // for well-typed callers, but JS callers can still pass junk.
  const raw: unknown = p;
  if (typeof p === 'string') {
    if (p !== 'max' && p !== 'top2mean') throw new Error(`pooling: unknown kind "${String(raw)}"`);
    return;
  }
  if (p.kind === 'logdiscount') {
    if (!(p.lambda >= 0))
      throw new Error(`pooling: logdiscount lambda must be ≥ 0 (got ${p.lambda})`);
  } else if (p.kind === 'softmax') {
    if (!(p.temperature > 0)) {
      throw new Error(`pooling: softmax temperature must be > 0 (got ${p.temperature})`);
    }
  } else {
    const kind = typeof raw === 'object' && raw !== null ? (raw as { kind?: unknown }).kind : raw;
    throw new Error(`pooling: unknown kind "${String(kind)}"`);
  }
}
