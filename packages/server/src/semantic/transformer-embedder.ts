import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Async embedding seam for real transformer models (BERT-family, e.g.
 * BAAI/bge-small-zh-v1.5 via its Xenova ONNX export), loaded through
 * `@huggingface/transformers` (transformers.js v3, ONNX Runtime backend).
 *
 * Why this exists: `Embedder` (core/embed/types.ts) is synchronous because
 * Model2Vec inference is a matrix gather. A real transformer is inherently
 * async (ONNX session), so this parallel interface is used by the async
 * search path (`searchAsync` / `Semantic.embedQueryAsync`). The sync
 * Model2Vec path is untouched.
 *
 * Model directory = HuggingFace repo layout (config.json, tokenizer.json,
 * onnx/model_quantized.onnx), e.g. a local clone of Xenova/bge-small-zh-v1.5.
 * `env.allowRemoteModels = false` preserves the zero-network guarantee: the
 * model must be fetched out-of-band, same contract as `seekstone fetch-model`.
 */
export interface AsyncEmbedder {
  /** Stable identifier, e.g. "bge-small-zh-v1.5" (cache is keyed on id+dim). */
  readonly id: string;
  /** Output dimensionality. */
  readonly dim: number;
  /** L2-normalized, mean-pooled embedding of `text`. */
  embed(text: string): Promise<Float32Array>;
  /** Batch embed — one ONNX session, much faster than per-text calls. */
  embedBatch(texts: readonly string[]): Promise<Float32Array[]>;
}

export function isAsyncEmbedder(e: unknown): e is AsyncEmbedder {
  // Model2Vec embedders have no embedBatch; its presence marks the async path.
  // (Constructor-name sniffing would break under bundling/minification.)
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as AsyncEmbedder).embedBatch === 'function' &&
    typeof (e as AsyncEmbedder).embed === 'function'
  );
}

/** A model dir is a transformers.js model when it carries an onnx/ subdir. */
export function looksLikeTransformerModel(modelDir: string): boolean {
  return existsSync(join(modelDir, 'onnx')) && existsSync(join(modelDir, 'config.json'));
}

type FeatureExtractionPipeline = (
  texts: string | string[],
  options: { pooling: 'mean'; normalize: true },
) => Promise<{ data: Float32Array; dims: number[] }>;

export async function loadTransformerEmbedder(modelDir: string): Promise<AsyncEmbedder> {
  // Dynamic import: @huggingface/transformers is an optional runtime path —
  // Model2Vec-only installs never pay the ONNX Runtime load cost.
  const tjs = (await import('@huggingface/transformers')) as {
    pipeline: (
      task: 'feature-extraction',
      model: string,
      options: { dtype: string },
    ) => Promise<FeatureExtractionPipeline>;
    env: { allowRemoteModels: boolean; allowLocalModels: boolean };
  };
  tjs.env.allowRemoteModels = false;
  tjs.env.allowLocalModels = true;
  // q8 = onnx/model_quantized.onnx (≈4× smaller + faster on CPU than fp32).
  const extractor = await tjs.pipeline('feature-extraction', modelDir, { dtype: 'q8' });

  const id =
    modelDir
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .pop() ?? 'transformer-model';

  async function embedBatchRaw(
    texts: readonly string[],
  ): Promise<{ vecs: Float32Array[]; dim: number }> {
    if (texts.length === 0) return { vecs: [], dim: 0 };
    const out = await extractor([...texts], { pooling: 'mean', normalize: true });
    // dims: [batch, dim] for batched pooling output
    const outDim = out.dims[out.dims.length - 1] ?? Math.floor(out.data.length / texts.length);
    const vecs: Float32Array[] = [];
    for (let i = 0; i < texts.length; i++) {
      vecs.push(out.data.slice(i * outDim, (i + 1) * outDim));
    }
    return { vecs, dim: outDim };
  }

  // Warm up the ONNX session and pin the output dimensionality now —
  // SemanticStore is constructed with `dim` at boot, before any real embed.
  const warmup = await embedBatchRaw(['warmup']);
  const dim = warmup.dim;

  async function embedBatch(texts: readonly string[]): Promise<Float32Array[]> {
    return (await embedBatchRaw(texts)).vecs;
  }

  return {
    id,
    dim,
    async embed(text: string): Promise<Float32Array> {
      const [vec] = await embedBatch([text]);
      return vec ?? new Float32Array(dim);
    },
    embedBatch,
  };
}
