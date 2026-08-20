import { join } from 'node:path';

/**
 * Semantic-search configuration, resolved from env at boot.
 *
 * - `SEEKSTONE_SEMANTIC=1` enables the feature (off by default).
 * - `SEEKSTONE_MODEL_PATH` overrides where the Model2Vec model dir lives;
 *   default is `<cache>/models/potion-base-8M`, where `seekstone fetch-model`
 *   puts it.
 * - `SEEKSTONE_CACHE_DIR` overrides the cache root (default `~/.cache/seekstone`),
 *   which holds both downloaded models and per-vault embedding caches.
 *
 * The server itself NEVER downloads anything — the model is fetched
 * out-of-band by the `fetch-model` subcommand, preserving the zero-network
 * guarantee (no-network.test.ts).
 */

export const DEFAULT_MODEL_ID = 'potion-base-8M';

export interface SemanticConfig {
  modelDir: string;
  cacheDir: string;
}

export function defaultCacheDir(env: NodeJS.ProcessEnv, homedir: string): string {
  return env.SEEKSTONE_CACHE_DIR || join(homedir, '.cache', 'seekstone');
}

export function resolveSemanticConfig(
  env: NodeJS.ProcessEnv,
  homedir: string,
): SemanticConfig | undefined {
  if (env.SEEKSTONE_SEMANTIC !== '1') return undefined;
  const cacheDir = defaultCacheDir(env, homedir);
  const modelDir = env.SEEKSTONE_MODEL_PATH || join(cacheDir, 'models', DEFAULT_MODEL_ID);
  return { modelDir, cacheDir };
}
