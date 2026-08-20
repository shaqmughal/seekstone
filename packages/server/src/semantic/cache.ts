import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { NoteVectors } from './store.js';

/**
 * Persisted embedding cache so restarts don't re-embed the vault: one flat
 * binary (all packed Float32 chunk vectors, then all Uint32 chunk spans)
 * plus a JSON manifest keyed by (path, contentHash). Lives under the cache
 * dir, never inside the vault, in a per-vault subdirectory (sha of the vault
 * root) so multiple vaults never collide.
 *
 * Load is best-effort: any mismatch (version, model, dim, byte lengths)
 * silently invalidates the cache — the build just re-embeds. Writes are
 * temp-file + rename (binary first, then the manifest that describes it),
 * so a crash leaves either the old cache or the new one.
 */

/** Bump when the on-disk layout OR the chunker semantics change. */
const CACHE_VERSION = 2;

export interface CachePaths {
  dir: string;
  bin: string;
  manifest: string;
}

interface CacheManifest {
  version: number;
  modelId: string;
  dim: number;
  entries: Array<{ path: string; contentHash: string; chunks: number }>;
}

export interface CacheData {
  vectors: Map<string, NoteVectors>;
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
    if (
      manifest.version !== CACHE_VERSION ||
      manifest.modelId !== modelId ||
      manifest.dim !== dim
    ) {
      return undefined;
    }
    const buf = await readFile(paths.bin);
    const totalChunks = manifest.entries.reduce((a, e) => a + e.chunks, 0);
    const vectorBytes = totalChunks * dim * 4;
    const spanBytes = totalChunks * 2 * 4;
    if (buf.byteLength !== vectorBytes + spanBytes) return undefined;
    // Buffers can be unaligned for typed-array views — copy to a fresh buffer.
    const aligned = new Uint8Array(buf.byteLength);
    aligned.set(buf);
    const floats = new Float32Array(aligned.buffer, 0, totalChunks * dim);
    const spans = new Uint32Array(aligned.buffer, vectorBytes, totalChunks * 2);
    const vectors = new Map<string, NoteVectors>();
    const hashes = new Map<string, string>();
    let chunkOffset = 0;
    for (const e of manifest.entries) {
      if (e.chunks <= 0) return undefined;
      vectors.set(e.path, {
        packed: floats.subarray(chunkOffset * dim, (chunkOffset + e.chunks) * dim),
        spans: spans.subarray(chunkOffset * 2, (chunkOffset + e.chunks) * 2),
      });
      hashes.set(e.path, e.contentHash);
      chunkOffset += e.chunks;
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
  notes: Iterable<[string, NoteVectors]>,
  hashes: ReadonlyMap<string, string>,
): Promise<void> {
  const entries: CacheManifest['entries'] = [];
  const kept: NoteVectors[] = [];
  let totalChunks = 0;
  for (const [path, note] of notes) {
    const contentHash = hashes.get(path);
    if (!contentHash) continue; // still being (re-)embedded — skip this round
    const chunks = note.packed.length / dim;
    entries.push({ path, contentHash, chunks });
    kept.push(note);
    totalChunks += chunks;
  }
  const bin = new Uint8Array(totalChunks * dim * 4 + totalChunks * 2 * 4);
  const floats = new Float32Array(bin.buffer, 0, totalChunks * dim);
  const spans = new Uint32Array(bin.buffer, totalChunks * dim * 4, totalChunks * 2);
  let floatOffset = 0;
  let spanOffset = 0;
  for (const note of kept) {
    floats.set(note.packed, floatOffset);
    spans.set(note.spans, spanOffset);
    floatOffset += note.packed.length;
    spanOffset += note.spans.length;
  }
  const manifest: CacheManifest = { version: CACHE_VERSION, modelId, dim, entries };

  await mkdir(paths.dir, { recursive: true });
  // Binary first, manifest last: the manifest is the commit point, and load
  // validates byte lengths, so a torn state just invalidates the cache.
  await atomicWriteBytes(paths.bin, bin);
  await atomicWriteBytes(paths.manifest, new TextEncoder().encode(JSON.stringify(manifest)));
}

async function atomicWriteBytes(absPath: string, bytes: Uint8Array): Promise<void> {
  const tmpPath = `${absPath}.seekstone-cache-tmp`;
  await writeFile(tmpPath, bytes);
  await rename(tmpPath, absPath);
}
