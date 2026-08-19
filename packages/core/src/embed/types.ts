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
