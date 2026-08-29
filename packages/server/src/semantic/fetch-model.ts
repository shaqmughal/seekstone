import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_MODEL_ID, defaultCacheDir, resolveModelId } from './config.js';
import { findModel, MODEL_IDS, type ModelManifest } from './model-manifest.js';

/**
 * `seekstone fetch-model` — the explicit, out-of-band download of the
 * embedding model that semantic search needs. This is a CLI subcommand that
 * exits before any MCP serving starts; the running server never fetches
 * (no-network.test.ts is the guarantee). Files are verified against pinned
 * SHA-256 hashes; already-present matching files are skipped.
 */

export interface FetchModelResult {
  output: string[];
  exitCode: number;
}

export interface FetchModelDeps {
  env: NodeJS.ProcessEnv;
  homedir: string;
  /** Arguments after the `fetch-model` subcommand (`--model <id>`). */
  argv?: readonly string[];
  /** Test seam: bypass model selection entirely. */
  manifest?: ModelManifest;
  fetchFn?: typeof fetch;
}

/**
 * Pick the manifest: `--model <id>` wins, then `SEEKSTONE_SEMANTIC_MODEL`, then
 * the default — so `fetch-model` with no flags installs whatever the server
 * would try to load.
 */
export function selectManifest(argv: readonly string[], env: NodeJS.ProcessEnv): ModelManifest {
  let requested: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--model') {
      requested = argv[i + 1];
      if (!requested || requested.startsWith('--')) {
        throw new Error(`--model needs a value: one of ${MODEL_IDS.join(', ')}`);
      }
      i++;
    } else if (arg?.startsWith('--model=')) {
      requested = arg.slice('--model='.length);
    } else {
      throw new Error(`fetch-model: unknown argument "${arg}" (usage: fetch-model [--model <id>])`);
    }
  }
  const id = resolveModelId(requested ?? env.SEEKSTONE_SEMANTIC_MODEL);
  const manifest = findModel(id);
  if (!manifest) throw new Error(`unknown model "${id}"`); // unreachable: resolveModelId validated
  return manifest;
}

export async function runFetchModel(deps: FetchModelDeps): Promise<FetchModelResult> {
  const output: string[] = [];
  let manifest: ModelManifest;
  try {
    manifest = deps.manifest ?? selectManifest(deps.argv ?? [], deps.env);
  } catch (err) {
    output.push(`✗ ${err instanceof Error ? err.message : String(err)}`);
    return { output, exitCode: 1 };
  }
  const fetchFn = deps.fetchFn ?? fetch;
  const destDir =
    deps.env.SEEKSTONE_MODEL_PATH ||
    join(defaultCacheDir(deps.env, deps.homedir), 'models', manifest.id);
  output.push(`fetch-model: ${manifest.id} → ${destDir}`);
  try {
    await mkdir(destDir, { recursive: true });
    let fetched = 0;
    let skipped = 0;
    for (const file of manifest.files) {
      const dest = join(destDir, file.name);
      if (existsSync(dest) && sha256(await readFile(dest)) === file.sha256) {
        skipped++;
        continue;
      }
      output.push(`fetching ${file.name} (${file.bytes} bytes)…`);
      const res = await fetchFn(file.url);
      if (!res.ok) throw new Error(`fetch ${file.url} failed: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const got = sha256(buf);
      if (got !== file.sha256) {
        throw new Error(`checksum mismatch for ${file.name}: expected ${file.sha256}, got ${got}`);
      }
      await writeFile(dest, buf);
      fetched++;
    }
    output.push(`✓ ${manifest.id}: ${fetched} fetched, ${skipped} already present (verified).`);
    output.push(
      manifest.id === DEFAULT_MODEL_ID
        ? 'Enable semantic search with SEEKSTONE_SEMANTIC=1 in your MCP server config, then restart the session.'
        : `Enable it with SEEKSTONE_SEMANTIC=1 and SEEKSTONE_SEMANTIC_MODEL=${manifest.id} in your MCP server config, then restart the session.`,
    );
    return { output, exitCode: 0 };
  } catch (err) {
    output.push(`✗ ${err instanceof Error ? err.message : String(err)}`);
    return { output, exitCode: 1 };
  }
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}
