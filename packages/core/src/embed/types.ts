/**
 * The embedding seam: everything downstream (chunk index, cosine scan,
 * retrieval eval) depends only on this interface, so alternative runtimes
 * (transformers.js, bring-your-own-model) can slot in behind it later.
 */
export interface Embedder {
  /** Stable identifier, e.g. "potion-base-8M". */
  readonly id: string;
  /** Output dimensionality. */
  readonly dim: number;
  /**
   * L2-normalized embedding of `text`. Returns the zero vector when the
   * input produces no poolable tokens (empty or whitespace-only text).
   * Pure CPU, synchronous.
   */
  embed(text: string): Float32Array;
}

/**
 * Packed per-token vectors for late-interaction scoring: `ids.length` rows
 * of `dim` floats in `vectors` (row t at `t * dim`). Each row is
 * L2-normalized so a dot product between rows is cosine similarity; an
 * all-zero embedding row stays zero.
 */
export interface TokenEmbedding {
  /** Vocab id per kept token, in input order. */
  readonly ids: number[];
  readonly dim: number;
  /** Packed row-major matrix, length `ids.length * dim`. */
  readonly vectors: Float32Array;
}

/**
 * An Embedder that can also expose per-token vectors from its (already
 * loaded) embedding matrix. Token filtering matches `embed()` exactly:
 * special tokens are skipped except [UNK], which carries real signal in
 * Model2Vec models.
 */
export interface TokenEmbedder extends Embedder {
  tokenEmbed(text: string): TokenEmbedding;
  /** The token ids `tokenEmbed` would embed — tokenization only, no gather. */
  tokenIds(text: string): number[];
  /**
   * One token's L2-normalized matrix row (a fresh array per call — callers
   * that loop should memoize by id; equal ids always yield equal rows).
   */
  tokenVector(id: number): Float32Array;
}

/** Narrow an Embedder to TokenEmbedder when the runtime provides token vectors. */
export function isTokenEmbedder(e: Embedder): e is TokenEmbedder {
  return typeof (e as TokenEmbedder).tokenEmbed === 'function';
}
