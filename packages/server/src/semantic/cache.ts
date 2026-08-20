import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Persisted embedding cache so restarts don't re-embed the vault: one flat
 * binary of packed Float32 chunk vectors plus a JSON manifest keyed by
 * (path, contentHash). Lives under the cache dir, never inside the vault,
 * in a per-vault subdirectory (sha of the vault root) so multiple vaults
 * never collide.
 *
 * Load is best-effort: any mismatch (version, model, dim, byte lengths)
 * silently invalidates the cache — the build just re-embeds. Writes are
 * temp-file + rename (binary first, then the manifest that describes it),
 * so a crash leaves either the old cache or the new one.
 */

export interface CachePaths {
  dir: string;
  bin: string;
  manifest: string;
}

interface CacheManifest {
  version: 1;
  modelId: string;
  dim: number;
  entries: Array<{ path: string; contentHash: string; chunks: number }>;
}

export interface CacheData {
  vectors: Map<string, Float32Array>;
  hashes: Map<string, string>;
}

export function cachePathsFor(cacheDir: string, vaultRoot: string, modelId: string): CachePaths {
  const vaultKey = createHash('sha256').update(vaultRoot).digest('hex').slice(0, 16);
  const dir = join(cacheDir, 'embeddings', vaultKey);
  return { dir, bin: join(dir, `${modelId}.bin`), manifest: join(dir, `${modelId}.json`) };
}

export async function loadCache(
  paths: CachePaths,
  modelId: string,
  dim: number,
): Promise<CacheData | undefined> {
  try {
    const manifest = JSON.parse(await readFile(paths.manifest, 'utf8')) as CacheManifest;
    if (manifest.version !== 1 || manifest.modelId !== modelId || manifest.dim !== dim) {
      return undefined;
    }
    const buf = await readFile(paths.bin);
    const totalChunks = manifest.entries.reduce((a, e) => a + e.chunks, 0);
    if (buf.byteLength !== totalChunks * dim * 4) return undefined;
    // Buffers can be unaligned for Float32Array views — copy to a fresh buffer.
    const aligned = new Uint8Array(buf.byteLength);
    aligned.set(buf);
    const floats = new Float32Array(aligned.buffer);
    const vectors = new Map<string, Float32Array>();
    const hashes = new Map<string, string>();
    let offset = 0;
    for (const e of manifest.entries) {
      if (e.chunks <= 0) return undefined;
      vectors.set(e.path, floats.subarray(offset, offset + e.chunks * dim));
      hashes.set(e.path, e.contentHash);
      offset += e.chunks * dim;
    }
    return { vectors, hashes };
  } catch {
    return undefined;
  }
}

export async function saveCache(
  paths: CachePaths,
  modelId: string,
  dim: number,
  notes: Iterable<[string, Float32Array]>,
  hashes: ReadonlyMap<string, string>,
): Promise<void> {
  const entries: CacheManifest['entries'] = [];
  const blobs: Float32Array[] = [];
  let totalFloats = 0;
  for (const [path, packed] of notes) {
    const contentHash = hashes.get(path);
    if (!contentHash) continue; // still being (re-)embedded — skip this round
    entries.push({ path, contentHash, chunks: packed.length / dim });
    blobs.push(packed);
    totalFloats += packed.length;
  }
  const bin = new Float32Array(totalFloats);
  let offset = 0;
  for (const blob of blobs) {
    bin.set(blob, offset);
    offset += blob.length;
  }
  const manifest: CacheManifest = { version: 1, modelId, dim, entries };

  await mkdir(paths.dir, { recursive: true });
  // Binary first, manifest last: the manifest is the commit point, and load
  // validates byte lengths, so a torn state just invalidates the cache.
  await atomicWriteBytes(paths.bin, new Uint8Array(bin.buffer, 0, totalFloats * 4));
  await atomicWriteBytes(paths.manifest, new TextEncoder().encode(JSON.stringify(manifest)));
}

async function atomicWriteBytes(absPath: string, bytes: Uint8Array): Promise<void> {
  const tmpPath = `${absPath}.seekstone-cache-tmp`;
  await writeFile(tmpPath, bytes);
  await rename(tmpPath, absPath);
}
