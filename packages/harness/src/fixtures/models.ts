import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// Explicit undici fetch: once anything imports the npm `undici` package (the
// REST adapter does, transitively via the CLI), Node 26's GLOBAL fetch stops
// following redirects and Hugging Face's CDN 302 surfaces as a failure.
// undici's own fetch follows regardless of import order.
import { fetch as undiciFetch } from 'undici';
import { sha256 } from './corpus.js';

/** The slice of fetch the downloaders need; injectable so tests stay offline. */
export type FetchLike = (
  url: string,
) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;

export const defaultFetch: FetchLike = (url) => undiciFetch(url);

export interface ModelManifestEntry {
  /** Model directory name, e.g. "potion-base-8M". */
  model: string;
  /** File name inside the model directory. */
  file: string;
  /** Canonical download URL (Hugging Face `resolve/main`). */
  url: string;
  /** SHA-256 of the file, or the "TBD" sentinel before first pinning. */
  sha256: string;
  /** File size in bytes. */
  bytes: number;
}

export interface ModelManifest {
  source: string;
  license: string;
  note: string;
  entries: ModelManifestEntry[];
}

const PIN_SENTINEL = 'TBD';

/**
 * Download every model file named in the manifest into `<destDir>/<model>/`,
 * verifying each against its pinned SHA-256 (fetchCorpus pattern:
 * already-present, checksum-matching files are skipped; mismatches throw).
 *
 * A sentinel sha256 of "TBD" downloads the file, prints its computed hash,
 * and throws — the hash must be committed to the manifest before the fetch
 * counts as reproducible.
 */
export async function fetchModels(
  manifestPath: string,
  destDir: string,
  log: (msg: string) => void = () => {},
  fetchImpl: FetchLike = defaultFetch,
): Promise<{ fetched: number; skipped: number }> {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ModelManifest;
  let fetched = 0;
  let skipped = 0;
  const unpinned: string[] = [];
  for (const e of manifest.entries) {
    const dir = join(destDir, e.model);
    mkdirSync(dir, { recursive: true });
    const dest = join(dir, e.file);
    if (e.sha256 !== PIN_SENTINEL && existsSync(dest) && sha256(readFileSync(dest)) === e.sha256) {
      skipped++;
      continue;
    }
    log(`fetching ${e.model}/${e.file} (${e.bytes} bytes)…`);
    const res = await fetchImpl(e.url);
    if (!res.ok) throw new Error(`fetch ${e.url} failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const got = sha256(buf);
    if (e.sha256 === PIN_SENTINEL) {
      writeFileSync(dest, buf);
      unpinned.push(`${e.model}/${e.file}: ${got}`);
      continue;
    }
    if (got !== e.sha256) {
      throw new Error(
        `checksum mismatch for ${e.model}/${e.file}: expected ${e.sha256}, got ${got}`,
      );
    }
    writeFileSync(dest, buf);
    fetched++;
  }
  if (unpinned.length > 0) {
    throw new Error(
      `fetch-models: unpinned manifest entries — commit these sha256 values to the manifest:\n${unpinned.join('\n')}`,
    );
  }
  return { fetched, skipped };
}
