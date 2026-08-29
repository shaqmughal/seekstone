import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { runFetchModel, selectManifest } from './fetch-model.js';
import {
  DEFAULT_MODEL,
  MODELS,
  type ModelManifest,
  RETRIEVAL_32M_MODEL,
} from './model-manifest.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const manifest: ModelManifest = {
  id: 'stub-model',
  license: 'MIT',
  dim: 2,
  files: [
    {
      name: 'config.json',
      url: 'https://huggingface.co/x/config.json',
      sha256: sha('cfg'),
      bytes: 3,
    },
    {
      name: 'model.safetensors',
      url: 'https://huggingface.co/x/model.safetensors',
      sha256: sha('weights'),
      bytes: 7,
    },
  ],
};

describe('runFetchModel', () => {
  let home: string;
  beforeAll(async () => {
    home = await mkdtemp(join(tmpdir(), 'seekstone-fetchmodel-'));
  });
  afterAll(async () => {
    await rm(home, { recursive: true, force: true });
  });

  const bodies: Record<string, string> = {
    'https://huggingface.co/x/config.json': 'cfg',
    'https://huggingface.co/x/model.safetensors': 'weights',
  };
  const okFetch = vi.fn(async (url: string | URL | Request) => new Response(bodies[String(url)]));

  it('downloads into the default cache location and verifies checksums', async () => {
    const result = await runFetchModel({
      env: {},
      homedir: home,
      manifest,
      fetchFn: okFetch as typeof fetch,
    });
    expect(result.exitCode).toBe(0);
    const dest = join(home, '.cache', 'seekstone', 'models', 'stub-model');
    expect(await readFile(join(dest, 'config.json'), 'utf8')).toBe('cfg');
    expect(await readFile(join(dest, 'model.safetensors'), 'utf8')).toBe('weights');
    expect(result.output.join('\n')).toContain('2 fetched, 0 already present');
  });

  it('skips already-present checksum-matching files', async () => {
    // A genuinely fresh mock — vi.fn(existingMock) would share okFetch's
    // call history from the previous test.
    const spy = vi.fn(async () => new Response('should never be fetched'));
    const result = await runFetchModel({
      env: {},
      homedir: home,
      manifest,
      fetchFn: spy as unknown as typeof fetch,
    });
    expect(result.exitCode).toBe(0);
    expect(spy).not.toHaveBeenCalled();
    expect(result.output.join('\n')).toContain('0 fetched, 2 already present');
  });

  it('honors SEEKSTONE_MODEL_PATH as the destination', async () => {
    const custom = join(home, 'custom-model-dir');
    const result = await runFetchModel({
      env: { SEEKSTONE_MODEL_PATH: custom },
      homedir: home,
      manifest,
      fetchFn: okFetch as typeof fetch,
    });
    expect(result.exitCode).toBe(0);
    expect(existsSync(join(custom, 'config.json'))).toBe(true);
  });

  it('re-fetches a corrupted file instead of trusting it', async () => {
    const dest = join(home, '.cache', 'seekstone', 'models', 'stub-model');
    await writeFile(join(dest, 'config.json'), 'tampered');
    const result = await runFetchModel({
      env: {},
      homedir: home,
      manifest,
      fetchFn: okFetch as typeof fetch,
    });
    expect(result.exitCode).toBe(0);
    expect(await readFile(join(dest, 'config.json'), 'utf8')).toBe('cfg');
  });

  it('fails with exit 1 on checksum mismatch and on HTTP errors', async () => {
    const badBody = vi.fn(async () => new Response('evil'));
    const bad = await runFetchModel({
      env: { SEEKSTONE_MODEL_PATH: join(home, 'bad') },
      homedir: home,
      manifest,
      fetchFn: badBody as unknown as typeof fetch,
    });
    expect(bad.exitCode).toBe(1);
    expect(bad.output.join('\n')).toContain('checksum mismatch');

    const http404 = vi.fn(async () => new Response('nope', { status: 404 }));
    const notFound = await runFetchModel({
      env: { SEEKSTONE_MODEL_PATH: join(home, 'missing') },
      homedir: home,
      manifest,
      fetchFn: http404 as unknown as typeof fetch,
    });
    expect(notFound.exitCode).toBe(1);
    expect(notFound.output.join('\n')).toContain('failed: 404');
  });

  it('selects the model from --model, then SEEKSTONE_SEMANTIC_MODEL, then the default', () => {
    expect(selectManifest([], {}).id).toBe(DEFAULT_MODEL.id);
    expect(selectManifest([], { SEEKSTONE_SEMANTIC_MODEL: 'potion-retrieval-32M' }).id).toBe(
      'potion-retrieval-32M',
    );
    expect(
      selectManifest(['--model', 'potion-base-8M'], {
        SEEKSTONE_SEMANTIC_MODEL: 'potion-retrieval-32M',
      }).id,
    ).toBe('potion-base-8M');
    expect(selectManifest(['--model=potion-retrieval-32M'], {}).id).toBe('potion-retrieval-32M');
  });

  it('rejects unknown models, a missing --model value, and stray arguments (exit 1)', async () => {
    expect(() => selectManifest(['--model', 'nope'], {})).toThrow(/unknown model "nope"/);
    expect(() => selectManifest(['--model'], {})).toThrow(/--model needs a value/);
    expect(() => selectManifest(['--model', '--force'], {})).toThrow(/--model needs a value/);
    expect(() => selectManifest(['--yolo'], {})).toThrow(/unknown argument "--yolo"/);
    const spy = vi.fn(async () => new Response('never'));
    const result = await runFetchModel({
      env: {},
      homedir: home,
      argv: ['--model', 'nope'],
      fetchFn: spy as unknown as typeof fetch,
    });
    expect(result.exitCode).toBe(1);
    expect(result.output.join('\n')).toContain('unknown model "nope"');
    expect(spy).not.toHaveBeenCalled();
  });

  it('pins every supported model: three HF files each, real sha256 + byte counts', () => {
    expect(MODELS.map((m) => m.id)).toEqual(['potion-base-8M', 'potion-retrieval-32M']);
    expect(RETRIEVAL_32M_MODEL.dim).toBe(512);
    expect(DEFAULT_MODEL.dim).toBe(256);
    for (const m of MODELS) {
      expect(m.files.map((f) => f.name)).toEqual([
        'model.safetensors',
        'tokenizer.json',
        'config.json',
      ]);
      for (const f of m.files) {
        expect(f.url).toBe(`https://huggingface.co/minishlab/${m.id}/resolve/main/${f.name}`);
        expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(f.bytes).toBeGreaterThan(0);
      }
    }
  });

  it('tells default-model users only to set SEEKSTONE_SEMANTIC=1 after a fetch', async () => {
    const tiny: ModelManifest = { ...DEFAULT_MODEL, files: manifest.files.slice(0, 1) };
    const result = await runFetchModel({
      env: { SEEKSTONE_MODEL_PATH: join(home, 'tiny-8m') },
      homedir: home,
      manifest: tiny,
      fetchFn: okFetch as typeof fetch,
    });
    expect(result.exitCode).toBe(0);
    const text = result.output.join('\n');
    expect(text).toContain('SEEKSTONE_SEMANTIC=1');
    expect(text).not.toContain('SEEKSTONE_SEMANTIC_MODEL');
  });

  it('tells 32M users which env vars to set after a successful fetch', async () => {
    const tiny: ModelManifest = { ...RETRIEVAL_32M_MODEL, files: manifest.files.slice(0, 1) };
    const result = await runFetchModel({
      env: { SEEKSTONE_MODEL_PATH: join(home, 'tiny-32m') },
      homedir: home,
      manifest: tiny,
      fetchFn: okFetch as typeof fetch,
    });
    expect(result.exitCode).toBe(0);
    expect(result.output.join('\n')).toContain('SEEKSTONE_SEMANTIC_MODEL=potion-retrieval-32M');
  });
});
