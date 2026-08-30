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
 */
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { readSafetensors } from './safetensors.js';
import { loadWordPieceTokenizer } from './tokenizer.js';
import type { TokenEmbedder, TokenEmbedding } from './types.js';

interface Model2VecConfig {
  hidden_dim?: number;
  normalize?: boolean;
}

const TENSOR_NAME = 'embeddings';

export async function loadModel2Vec(modelDir: string): Promise<TokenEmbedder> {
  const [configRaw, tokenizerRaw, weights] = await Promise.all([
    readFile(join(modelDir, 'config.json'), 'utf8'),
    readFile(join(modelDir, 'tokenizer.json'), 'utf8'),
    readFile(join(modelDir, 'model.safetensors')),
  ]);
  const config = JSON.parse(configRaw) as Model2VecConfig;
  const tokenizer = loadWordPieceTokenizer(JSON.parse(tokenizerRaw));

  const tensors = readSafetensors(weights);
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

  const table = tensor.data;

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
    id: basename(modelDir),
    dim,
    embed(text: string): Float32Array {
      const out = new Float32Array(dim);
      const ids = pooledIds(text);
      for (const id of ids) {
        const base = id * dim;
        for (let j = 0; j < dim; j++) {
          out[j] = (out[j] as number) + (table[base + j] as number);
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
        const base = (ids[t] as number) * dim;
        const row = t * dim;
        let sumSquares = 0;
        for (let j = 0; j < dim; j++) {
          const x = table[base + j] as number;
          vectors[row + j] = x;
          sumSquares += x * x;
        }
        const norm = Math.sqrt(sumSquares);
        if (norm > 0) {
          for (let j = 0; j < dim; j++) {
            vectors[row + j] = (vectors[row + j] as number) / norm;
          }
        }
      }
      return { ids, dim, vectors };
    },
  };
}
