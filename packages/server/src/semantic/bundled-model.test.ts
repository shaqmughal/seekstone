import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { materializeBundledModel } from './bundled-model.js';
import type { ModelManifest } from './model-manifest.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const WEIGHTS = 'weights-bytes-0123456789';
const TOKENIZER = 'tokenizer-bytes';
const CONFIG = 'cfg';

const manifest: ModelManifest = {
  id: 'stub-model',
  license: 'MIT',
  dim: 2,
  files: [
    { name: 'model.safetensors', url: 'https://x/m', sha256: sha(WEIGHTS), bytes: WEIGHTS.length },
    { name: 'tokenizer.json', url: 'https://x/t', sha256: sha(TOKENIZER), bytes: TOKENIZER.length },
    { name: 'config.json', url: 'https://x/c', sha256: sha(CONFIG), bytes: CONFIG.length },
  ],
};

const manifestFor = (id: string) => (id === 'stub-model' ? manifest : undefined);

let root: string;
let bundledDir: string;
let modelDir: string;
const cfg = () => ({ modelId: 'stub-model', modelDir, cacheDir: root });

/** Stage `content` into the bundle dir as `<name>.NNN.part` shards of `max` bytes. */
async function stageShards(name: string, content: string, max = 8): Promise<void> {
  const buf = Buffer.from(content);
  for (let i = 0, n = 0; i < buf.length; i += max, n++) {
    await writeFile(
      join(bundledDir, `${name}.${String(n).padStart(3, '0')}.part`),
      buf.subarray(i, i + max),
    );
  }
}

async function stageBundle(id = 'stub-model'): Promise<void> {
  await writeFile(join(bundledDir, 'manifest.json'), JSON.stringify({ id }));
  await stageShards('model.safetensors', WEIGHTS);
  await stageShards('tokenizer.json', TOKENIZER);
  await stageShards('config.json', CONFIG);
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'seekstone-bundled-'));
  bundledDir = join(root, 'bundle', 'model');
  modelDir = join(root, 'models', 'stub-model');
  await mkdir(bundledDir, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('materializeBundledModel', () => {
  it('reassembles shards into the model dir and verifies every hash', async () => {
    await stageBundle();
    await materializeBundledModel(cfg(), bundledDir, { manifestFor });
    expect(await readFile(join(modelDir, 'model.safetensors'), 'utf8')).toBe(WEIGHTS);
    expect(await readFile(join(modelDir, 'tokenizer.json'), 'utf8')).toBe(TOKENIZER);
    expect(await readFile(join(modelDir, 'config.json'), 'utf8')).toBe(CONFIG);
  });

  it('is a no-op when no bundled dir is configured', async () => {
    await materializeBundledModel(cfg(), undefined, { manifestFor });
    expect(existsSync(modelDir)).toBe(false);
  });

  it('is a no-op (not an error) when the bundled dir does not exist', async () => {
    await expect(
      materializeBundledModel(cfg(), join(root, 'nope'), { manifestFor }),
    ).resolves.toBeUndefined();
    expect(existsSync(modelDir)).toBe(false);
  });

  it('skips materialization when the bundled model id differs from the requested one', async () => {
    await stageBundle('some-other-model');
    await materializeBundledModel(cfg(), bundledDir, { manifestFor });
    expect(existsSync(modelDir)).toBe(false);
  });

  it('leaves already-valid files untouched (no shards needed on later boots)', async () => {
    await stageBundle();
    await materializeBundledModel(cfg(), bundledDir, { manifestFor });
    // Simulate a later boot where the bundle shards are gone but manifest.json
    // remains: valid files must be skipped before any shard is read.
    for (const f of manifest.files) {
      await rm(join(bundledDir, `${f.name}.000.part`), { force: true });
      await rm(join(bundledDir, `${f.name}.001.part`), { force: true });
      await rm(join(bundledDir, `${f.name}.002.part`), { force: true });
    }
    const before = await stat(join(modelDir, 'model.safetensors'));
    await materializeBundledModel(cfg(), bundledDir, { manifestFor });
    const after = await stat(join(modelDir, 'model.safetensors'));
    expect(after.mtimeMs).toBe(before.mtimeMs);
  });

  it('re-materializes a corrupted destination file', async () => {
    await stageBundle();
    await materializeBundledModel(cfg(), bundledDir, { manifestFor });
    await writeFile(join(modelDir, 'model.safetensors'), 'torn write');
    await materializeBundledModel(cfg(), bundledDir, { manifestFor });
    expect(await readFile(join(modelDir, 'model.safetensors'), 'utf8')).toBe(WEIGHTS);
  });

  it('throws loudly on a shard checksum mismatch', async () => {
    await stageBundle();
    await writeFile(join(bundledDir, 'model.safetensors.001.part'), 'evil bytes');
    await expect(materializeBundledModel(cfg(), bundledDir, { manifestFor })).rejects.toThrow(
      /checksum mismatch for model\.safetensors/,
    );
  });

  it('throws when a file has no shards in the bundle', async () => {
    await stageBundle();
    await rm(join(bundledDir, 'tokenizer.json.000.part'));
    await rm(join(bundledDir, 'tokenizer.json.001.part'), { force: true });
    await expect(materializeBundledModel(cfg(), bundledDir, { manifestFor })).rejects.toThrow(
      /no shards for tokenizer\.json/,
    );
  });

  it('throws when the bundle manifest.json is missing or unreadable', async () => {
    await stageShards('config.json', CONFIG);
    await expect(materializeBundledModel(cfg(), bundledDir, { manifestFor })).rejects.toThrow(
      /cannot read .*manifest\.json/,
    );
  });

  it('orders shards numerically, not lexically', async () => {
    // 12 shards of 2 bytes: lexical order would put "10" before "2".
    const content = 'aabbccddeeffgghhiijjkkll';
    await writeFile(join(bundledDir, 'manifest.json'), JSON.stringify({ id: 'stub-model' }));
    const buf = Buffer.from(content);
    for (let i = 0, n = 0; i < buf.length; i += 2, n++) {
      await writeFile(join(bundledDir, `big.bin.${n}.part`), buf.subarray(i, i + 2));
    }
    const bigManifest: ModelManifest = {
      ...manifest,
      files: [{ name: 'big.bin', url: 'https://x/b', sha256: sha(content), bytes: content.length }],
    };
    await materializeBundledModel(cfg(), bundledDir, { manifestFor: () => bigManifest });
    expect(await readFile(join(modelDir, 'big.bin'), 'utf8')).toBe(content);
  });
});
