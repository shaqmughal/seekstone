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
 */
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { readSafetensors } from './safetensors.js';
import { loadWordPieceTokenizer } from './tokenizer.js';
import type { Embedder } from './types.js';

interface Model2VecConfig {
  hidden_dim?: number;
  normalize?: boolean;
}

const TENSOR_NAME = 'embeddings';

export async function loadModel2Vec(modelDir: string): Promise<Embedder> {
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
  return {
    id: basename(modelDir),
    dim,
    embed(text: string): Float32Array {
      const out = new Float32Array(dim);
      let pooled = 0;
      for (const id of tokenizer.encode(text)) {
        if (tokenizer.specialIds.has(id) && id !== tokenizer.unkId) continue;
        const base = id * dim;
        for (let j = 0; j < dim; j++) {
          out[j] = (out[j] as number) + (table[base + j] as number);
        }
        pooled++;
      }
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
  };
}
