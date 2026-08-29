import { join } from 'node:path';
import { DEFAULT_MODEL, findModel, MODEL_IDS, type ModelManifest } from './model-manifest.js';

/**
 * Semantic-search configuration, resolved from env at boot.
 *
 * - `SEEKSTONE_SEMANTIC=1` enables the feature (off by default).
 * - `SEEKSTONE_SEMANTIC_MODEL` picks which fetched model to load
 *   (`potion-base-8M` default, or the opt-in `potion-retrieval-32M`).
 * - `SEEKSTONE_MODEL_PATH` overrides where the Model2Vec model dir lives;
 *   default is `<cache>/models/<model id>`, where `seekstone fetch-model`
 *   puts it.
 * - `SEEKSTONE_CACHE_DIR` overrides the cache root (default `~/.cache/seekstone`),
 *   which holds both downloaded models and per-vault embedding caches.
 *
 * The server itself NEVER downloads anything — the model is fetched
 * out-of-band by the `fetch-model` subcommand, preserving the zero-network
 * guarantee (no-network.test.ts).
 */

export const DEFAULT_MODEL_ID = DEFAULT_MODEL.id;

export interface SemanticConfig {
  /** Manifest id of the selected model (drives the default dir + error hints). */
  modelId: string;
  modelDir: string;
  cacheDir: string;
}

export function defaultCacheDir(env: NodeJS.ProcessEnv, homedir: string): string {
  return env.SEEKSTONE_CACHE_DIR || join(homedir, '.cache', 'seekstone');
}

/**
 * Validate `SEEKSTONE_SEMANTIC_MODEL` (or the given override) against the
 * pinned manifests. Throws a config error naming the accepted values so a
 * typo fails loudly at boot / fetch time instead of silently loading 8M.
 */
export function resolveModel(raw: string | undefined): ModelManifest {
  const id = raw?.trim();
  if (!id) return DEFAULT_MODEL;
  const manifest = findModel(id);
  if (!manifest) {
    throw new Error(
      `SEEKSTONE_SEMANTIC_MODEL: unknown model "${id}" — expected one of ${MODEL_IDS.join(', ')}`,
    );
  }
  return manifest;
}

export function resolveModelId(raw: string | undefined): string {
  return resolveModel(raw).id;
}

/** The `fetch-model` command that installs the given model. */
export function fetchCommandFor(modelId: string): string {
  return modelId === DEFAULT_MODEL_ID
    ? 'npx -y seekstone fetch-model'
    : `npx -y seekstone fetch-model --model ${modelId}`;
}

export function resolveSemanticConfig(
  env: NodeJS.ProcessEnv,
  homedir: string,
): SemanticConfig | undefined {
  if (env.SEEKSTONE_SEMANTIC !== '1') return undefined;
  const modelId = resolveModelId(env.SEEKSTONE_SEMANTIC_MODEL);
  const cacheDir = defaultCacheDir(env, homedir);
  const modelDir = env.SEEKSTONE_MODEL_PATH || join(cacheDir, 'models', modelId);
  return { modelId, modelDir, cacheDir };
}
