import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

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

/** The npm package that provides the ONNX runtime. Optional peer dependency. */
export const TRANSFORMER_RUNTIME = '@huggingface/transformers';

/** The slice of transformers.js this loader touches. */
export interface TransformerRuntime {
  pipeline: (
    task: 'feature-extraction',
    model: string,
    options: { dtype: string },
  ) => Promise<FeatureExtractionPipeline>;
  env: { allowRemoteModels: boolean; allowLocalModels: boolean };
}

export interface TransformerLoaderDeps {
  /** Test seam; defaults to a dynamic import of the peer dependency. */
  importRuntime?: () => Promise<TransformerRuntime>;
}

/**
 * The runtime is an optional peer dependency (~350 MB unpacked with its ONNX
 * runtime and native modules), so the default install never carries it.
 * The specifier is held in a variable so neither tsc nor the bundler tries
 * to resolve it at build time; it resolves at runtime from wherever the
 * user installed it.
 */
function importPeerRuntime(): Promise<TransformerRuntime> {
  const specifier = TRANSFORMER_RUNTIME;
  return import(specifier) as Promise<TransformerRuntime>;
}

function isModuleNotFound(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND';
}

/**
 * Cache identity for a transformer model: the directory's basename plus a
 * short hash of its ONNX weights. Two different models in same-named folders
 * must never share an embedding cache, and the same model moved to another
 * folder should keep its cache.
 */
export function transformerModelId(modelDir: string): string {
  const onnxDir = join(modelDir, 'onnx');
  const files = readdirSync(onnxDir)
    .filter((f) => f.endsWith('.onnx'))
    .sort();
  const hash = createHash('sha256');
  for (const f of files) hash.update(f).update(readFileSync(join(onnxDir, f)));
  return `${basename(modelDir.replace(/[\\/]+$/, ''))}-${hash.digest('hex').slice(0, 12)}`;
}

export async function loadTransformerEmbedder(
  modelDir: string,
  deps: TransformerLoaderDeps = {},
): Promise<AsyncEmbedder> {
  let tjs: TransformerRuntime;
  try {
    tjs = await (deps.importRuntime ?? importPeerRuntime)();
  } catch (err) {
    if (!isModuleNotFound(err)) throw err;
    throw new Error(
      `this model directory is a transformers.js (ONNX) model, which needs the optional \`${TRANSFORMER_RUNTIME}\` runtime — it is not installed. ` +
        `Install it alongside seekstone (e.g. \`npx -y -p seekstone -p ${TRANSFORMER_RUNTIME} seekstone\`, or \`npm i -g seekstone ${TRANSFORMER_RUNTIME}\`), ` +
        `or point SEEKSTONE_MODEL_PATH at a Model2Vec model instead`,
    );
  }
  tjs.env.allowRemoteModels = false;
  tjs.env.allowLocalModels = true;
  // q8 = onnx/model_quantized.onnx (≈4× smaller + faster on CPU than fp32).
  const extractor = await tjs.pipeline('feature-extraction', modelDir, { dtype: 'q8' });

  const id = transformerModelId(modelDir);

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
