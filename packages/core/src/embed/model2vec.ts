/**
 * Model2Vec static-embedding inference: tokenize → gather rows from the
 * embedding matrix → mean-pool → L2-normalize. Zipf token weighting is baked
 * into the matrix at distillation time, so inference is exactly this simple —
 * no ONNX runtime, no native code, no network.
 *
 * Special tokens are excluded from the pool with one exception: [UNK] rows
 * carry real signal in Model2Vec models and are kept, matching the reference
 * implementation (which strips the [CLS]/[SEP] post-processor and pools
 * whatever the tokenizer emits).
 *
 * The loader also exposes `tokenEmbed()` (SHA-314 MaxSim rerank): the same
 * token filter, but returning each kept token's matrix row individually,
 * L2-normalized per row — no second copy of the matrix, rows are gathered
 * from the same in-memory table `embed()` pools from.
 *
 * By default the table is held as int8 with one float32 scale per row
 * (SHA-548, `quantize.ts`), about a quarter of the float32 size. Pass
 * `weights: 'f32'` to keep the float32 table as before; the embedder id then
 * gets a `+f32` suffix so the two formats never share a cache file.
 */
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { quantizeRows } from './quantize.js';
import { readSafetensors } from './safetensors.js';
import { loadWordPieceTokenizer } from './tokenizer.js';
import type { TokenEmbedder, TokenEmbedding } from './types.js';

interface Model2VecConfig {
  hidden_dim?: number;
  normalize?: boolean;
}

const TENSOR_NAME = 'embeddings';

/** How the embedding table is held in memory. */
export type Model2VecWeights = 'int8' | 'f32';
export const MODEL2VEC_WEIGHTS: readonly Model2VecWeights[] = ['int8', 'f32'];
export const DEFAULT_MODEL2VEC_WEIGHTS: Model2VecWeights = 'int8';

export interface LoadModel2VecOptions {
  /** 'int8' (default) or 'f32'. */
  weights?: Model2VecWeights;
}

export async function loadModel2Vec(
  modelDir: string,
  opts: LoadModel2VecOptions = {},
): Promise<TokenEmbedder> {
  const format = opts.weights ?? DEFAULT_MODEL2VEC_WEIGHTS;
  const [configRaw, tokenizerRaw, bytes] = await Promise.all([
    readFile(join(modelDir, 'config.json'), 'utf8'),
    readFile(join(modelDir, 'tokenizer.json'), 'utf8'),
    readFile(join(modelDir, 'model.safetensors')),
  ]);
  const config = JSON.parse(configRaw) as Model2VecConfig;
  const tokenizer = loadWordPieceTokenizer(JSON.parse(tokenizerRaw));

  const tensors = readSafetensors(bytes);
  const tensor =
    tensors.get(TENSOR_NAME) ?? (tensors.size === 1 ? [...tensors.values()][0] : undefined);
  if (!tensor) {
    throw new Error(
      `model2vec: no "${TENSOR_NAME}" tensor in ${modelDir}; found: ${[...tensors.keys()].join(', ')}`,
    );
  }
  if (tensor.shape.length !== 2) {
    throw new Error(`model2vec: expected a 2-D embedding matrix, got [${tensor.shape.join(', ')}]`);
  }
  const [rows, dim] = tensor.shape as [number, number];
  if (rows !== tokenizer.vocabSize) {
    throw new Error(
      `model2vec: embedding rows (${rows}) do not match tokenizer vocab size (${tokenizer.vocabSize})`,
    );
  }
  if (config.hidden_dim !== undefined && config.hidden_dim !== dim) {
    throw new Error(
      `model2vec: config hidden_dim ${config.hidden_dim} does not match tensor dim ${dim}`,
    );
  }

  // The closures below capture only `src` and `scale`, so on the int8 path the
  // float32 file buffer is unreferenced after this and can be collected.
  const { src, scale } = residentTable(tensor.data, rows, dim, format);

  /** Token ids `embed()` would pool: specials skipped, [UNK] kept. */
  function pooledIds(text: string): number[] {
    const ids: number[] = [];
    for (const id of tokenizer.encode(text)) {
      if (tokenizer.specialIds.has(id) && id !== tokenizer.unkId) continue;
      ids.push(id);
    }
    return ids;
  }

  return {
    id:
      format === DEFAULT_MODEL2VEC_WEIGHTS ? basename(modelDir) : `${basename(modelDir)}+${format}`,
    dim,
    embed(text: string): Float32Array {
      const out = new Float32Array(dim);
      const ids = pooledIds(text);
      for (const id of ids) {
        const base = id * dim;
        if (scale) {
          const s = scale[id] as number;
          if (s === 0) continue;
          for (let j = 0; j < dim; j++) {
            out[j] = (out[j] as number) + s * (src[base + j] as number);
          }
        } else {
          for (let j = 0; j < dim; j++) {
            out[j] = (out[j] as number) + (src[base + j] as number);
          }
        }
      }
      const pooled = ids.length;
      if (pooled === 0) return out;
      let sumSquares = 0;
      for (let j = 0; j < dim; j++) {
        const mean = (out[j] as number) / pooled;
        out[j] = mean;
        sumSquares += mean * mean;
      }
      const norm = Math.sqrt(sumSquares);
      if (norm > 0) {
        for (let j = 0; j < dim; j++) out[j] = (out[j] as number) / norm;
      }
      return out;
    },
    tokenEmbed(text: string): TokenEmbedding {
      const ids = pooledIds(text);
      const vectors = new Float32Array(ids.length * dim);
      for (let t = 0; t < ids.length; t++) {
        writeNormalizedRow(ids[t] as number, vectors, t * dim);
      }
      return { ids, dim, vectors };
    },
    tokenIds: pooledIds,
    tokenVector(id: number): Float32Array {
      if (!Number.isInteger(id) || id < 0 || id >= tokenizer.vocabSize) {
        throw new Error(`model2vec: token id ${id} outside vocab [0, ${tokenizer.vocabSize})`);
      }
      const out = new Float32Array(dim);
      writeNormalizedRow(id, out, 0);
      return out;
    },
  };

  /**
   * Copy row `id` of the table into `out` at `offset`, L2-normalized (zero rows
   * stay zero). An int8 row's scale cancels under normalization, so it's skipped.
   */
  function writeNormalizedRow(id: number, out: Float32Array, offset: number): void {
    const base = id * dim;
    let sumSquares = 0;
    for (let j = 0; j < dim; j++) {
      const x = src[base + j] as number;
      out[offset + j] = x;
      sumSquares += x * x;
    }
    const norm = Math.sqrt(sumSquares);
    if (norm > 0) {
      for (let j = 0; j < dim; j++) {
        out[offset + j] = (out[offset + j] as number) / norm;
      }
    }
  }
}

/** The table the gather paths read: int8 rows plus per-row scales, or the float32 rows as read. */
function residentTable(
  data: Float32Array,
  rows: number,
  dim: number,
  format: Model2VecWeights,
): { src: Int8Array | Float32Array; scale?: Float32Array } {
  if (format === 'f32') return { src: data };
  const { q, scale } = quantizeRows(data, rows, dim);
  return { src: q, scale };
}
