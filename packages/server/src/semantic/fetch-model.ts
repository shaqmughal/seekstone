import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultCacheDir } from './config.js';
import { DEFAULT_MODEL, type ModelManifest } from './model-manifest.js';

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
  manifest?: ModelManifest;
  fetchFn?: typeof fetch;
}

export async function runFetchModel(deps: FetchModelDeps): Promise<FetchModelResult> {
  const manifest = deps.manifest ?? DEFAULT_MODEL;
  const fetchFn = deps.fetchFn ?? fetch;
  const destDir =
    deps.env.SEEKSTONE_MODEL_PATH ||
    join(defaultCacheDir(deps.env, deps.homedir), 'models', manifest.id);
  const output: string[] = [];
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
      'Enable semantic search with SEEKSTONE_SEMANTIC=1 in your MCP server config, then restart the session.',
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
