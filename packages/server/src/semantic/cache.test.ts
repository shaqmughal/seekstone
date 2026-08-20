import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cachePathsFor, loadCache, saveCache } from './cache.js';

describe('semantic cache', () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'seekstone-semcache-'));
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const notes: Array<[string, Float32Array]> = [
    ['Notes/A.md', new Float32Array([1, 0, 0.5, 0.5])], // 2 chunks, dim 2
    ['Notes/B.md', new Float32Array([0, 1])],
  ];
  const hashes = new Map([
    ['Notes/A.md', 'hash-a'],
    ['Notes/B.md', 'hash-b'],
  ]);

  it('keys cache paths per vault so vaults never collide', () => {
    const a = cachePathsFor(root, '/vault/one', 'm');
    const b = cachePathsFor(root, '/vault/two', 'm');
    expect(a.bin).not.toBe(b.bin);
    expect(a.dir.startsWith(join(root, 'embeddings'))).toBe(true);
  });

  it('round-trips vectors and hashes', async () => {
    const paths = cachePathsFor(root, '/vault/rt', 'model-x');
    await saveCache(paths, 'model-x', 2, notes, hashes);
    const loaded = await loadCache(paths, 'model-x', 2);
    expect(loaded).toBeDefined();
    expect([...(loaded?.vectors.get('Notes/A.md') ?? [])]).toEqual([1, 0, 0.5, 0.5]);
    expect([...(loaded?.vectors.get('Notes/B.md') ?? [])]).toEqual([0, 1]);
    expect(loaded?.hashes.get('Notes/B.md')).toBe('hash-b');
  });

  it('skips notes whose hash is not yet known (mid-re-embed)', async () => {
    const paths = cachePathsFor(root, '/vault/partial', 'm');
    await saveCache(paths, 'm', 2, notes, new Map([['Notes/A.md', 'hash-a']]));
    const loaded = await loadCache(paths, 'm', 2);
    expect(loaded?.vectors.has('Notes/A.md')).toBe(true);
    expect(loaded?.vectors.has('Notes/B.md')).toBe(false);
  });

  it('invalidates on model or dim mismatch', async () => {
    const paths = cachePathsFor(root, '/vault/mismatch', 'model-x');
    await saveCache(paths, 'model-x', 2, notes, hashes);
    expect(await loadCache(paths, 'model-y', 2)).toBeUndefined();
    expect(await loadCache(paths, 'model-x', 4)).toBeUndefined();
  });

  it('invalidates on a truncated binary', async () => {
    const paths = cachePathsFor(root, '/vault/torn', 'm');
    await saveCache(paths, 'm', 2, notes, hashes);
    const bin = await readFile(paths.bin);
    await writeFile(paths.bin, bin.subarray(0, bin.length - 4));
    expect(await loadCache(paths, 'm', 2)).toBeUndefined();
  });

  it('returns undefined when no cache exists', async () => {
    const paths = cachePathsFor(root, '/vault/none', 'm');
    expect(await loadCache(paths, 'm', 2)).toBeUndefined();
  });
});
