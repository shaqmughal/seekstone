import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { runFetchModel } from './fetch-model.js';
import type { ModelManifest } from './model-manifest.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const manifest: ModelManifest = {
  id: 'stub-model',
  license: 'MIT',
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
});
