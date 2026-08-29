/**
 * Pinned download manifests for the supported embedding models. Used ONLY by
 * the `seekstone fetch-model` subcommand — an explicit, out-of-band CLI
 * action. The MCP server itself never touches the network (no-network.test.ts).
 *
 * Hashes mirror packages/harness/fixtures/models/manifest.json (the harness
 * evals run against the same files).
 */

export interface ModelFile {
  name: string;
  url: string;
  sha256: string;
  bytes: number;
}

export interface ModelManifest {
  id: string;
  license: string;
  /** Embedding width — the cache is keyed on it so models never mix. */
  dim: number;
  files: ModelFile[];
}

function hfFiles(
  repo: string,
  hashes: { safetensors: [string, number]; tokenizer: [string, number]; config: [string, number] },
): ModelFile[] {
  const base = `https://huggingface.co/minishlab/${repo}/resolve/main`;
  return [
    {
      name: 'model.safetensors',
      url: `${base}/model.safetensors`,
      sha256: hashes.safetensors[0],
      bytes: hashes.safetensors[1],
    },
    {
      name: 'tokenizer.json',
      url: `${base}/tokenizer.json`,
      sha256: hashes.tokenizer[0],
      bytes: hashes.tokenizer[1],
    },
    {
      name: 'config.json',
      url: `${base}/config.json`,
      sha256: hashes.config[0],
      bytes: hashes.config[1],
    },
  ];
}

/** The shipped default: ~30 MB, 256-dim, warm p95 ≈ 14 ms @ 10k notes. */
export const DEFAULT_MODEL: ModelManifest = {
  id: 'potion-base-8M',
  license: 'MIT (https://huggingface.co/minishlab/potion-base-8M)',
  dim: 256,
  files: hfFiles('potion-base-8M', {
    safetensors: ['f65d0f325faadc1e121c319e2faa41170d3fa07d8c89abd48ca5358d9a223de2', 30236760],
    tokenizer: ['e67e803f624fb4d67dea1c730d06e1067e1b14d830e2c2202569e3ef0f70bb50', 683666],
    config: ['2a6ac0e9aaa356a68a5688070db78fc3a464fefe85d2f06a1905ce3718687553', 202],
  }),
};

/**
 * Opt-in bigger model (SHA-310): ~129 MB, 512-dim, +13 pts hit@5 on the
 * semantic golden subset at roughly 2× the query latency. Same Model2Vec
 * inference path — the loader derives vocab size from tokenizer.json.
 */
export const RETRIEVAL_32M_MODEL: ModelManifest = {
  id: 'potion-retrieval-32M',
  license: 'MIT (https://huggingface.co/minishlab/potion-retrieval-32M)',
  dim: 512,
  files: hfFiles('potion-retrieval-32M', {
    safetensors: ['07609e5bd33aad37900b3fd62f4ec96f6daec88ca4d46b9d8b928bfababf6ea0', 129210456],
    tokenizer: ['7d75cbc54318138807c401b0f0c9721117c628b39de8e8e0edb6cb17e0ee7d18', 1493150],
    config: ['63c00d90824c832c04ec1d02b6a983fb90489bf049f29fbff15ba481b8a432ee', 202],
  }),
};

/** Every model `fetch-model --model <id>` / `SEEKSTONE_SEMANTIC_MODEL` accepts. */
export const MODELS: readonly ModelManifest[] = [DEFAULT_MODEL, RETRIEVAL_32M_MODEL];

export const MODEL_IDS: readonly string[] = MODELS.map((m) => m.id);

export function findModel(id: string): ModelManifest | undefined {
  return MODELS.find((m) => m.id === id);
}
