/**
 * Pinned download manifest for the default embedding model. Used ONLY by the
 * `seekstone fetch-model` subcommand — an explicit, out-of-band CLI action.
 * The MCP server itself never touches the network (no-network.test.ts).
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
  files: ModelFile[];
}

export const DEFAULT_MODEL: ModelManifest = {
  id: 'potion-base-8M',
  license: 'MIT (https://huggingface.co/minishlab/potion-base-8M)',
  files: [
    {
      name: 'model.safetensors',
      url: 'https://huggingface.co/minishlab/potion-base-8M/resolve/main/model.safetensors',
      sha256: 'f65d0f325faadc1e121c319e2faa41170d3fa07d8c89abd48ca5358d9a223de2',
      bytes: 30236760,
    },
    {
      name: 'tokenizer.json',
      url: 'https://huggingface.co/minishlab/potion-base-8M/resolve/main/tokenizer.json',
      sha256: 'e67e803f624fb4d67dea1c730d06e1067e1b14d830e2c2202569e3ef0f70bb50',
      bytes: 683666,
    },
    {
      name: 'config.json',
      url: 'https://huggingface.co/minishlab/potion-base-8M/resolve/main/config.json',
      sha256: '2a6ac0e9aaa356a68a5688070db78fc3a464fefe85d2f06a1905ce3718687553',
      bytes: 202,
    },
  ],
};
