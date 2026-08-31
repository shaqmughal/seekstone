import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fetchModels, type ModelManifest } from './models.js';

const COMMITTED_MANIFEST = fileURLToPath(
  new URL('../../fixtures/models/manifest.json', import.meta.url),
);

describe('committed model manifest', () => {
  const manifest = JSON.parse(readFileSync(COMMITTED_MANIFEST, 'utf8')) as ModelManifest;

  it('has well-formed entries', () => {
    expect(manifest.entries.length).toBeGreaterThan(0);
    for (const e of manifest.entries) {
      expect(e.model).toMatch(/^[\w.-]+$/);
      expect(e.file).toMatch(/^[\w.-]+$/);
      expect(e.bytes).toBeGreaterThan(0);
      expect(e.sha256 === 'TBD' || /^[0-9a-f]{64}$/.test(e.sha256)).toBe(true);
    }
  });

  it('only points at Hugging Face over https', () => {
    for (const e of manifest.entries) {
      const url = new URL(e.url);
      expect(url.protocol).toBe('https:');
      expect(url.host).toBe('huggingface.co');
    }
  });

  it('lists the three Model2Vec files for every model', () => {
    const byModel = new Map<string, string[]>();
    for (const e of manifest.entries) {
      byModel.set(e.model, [...(byModel.get(e.model) ?? []), e.file]);
    }
    for (const files of byModel.values()) {
      expect(files.sort()).toEqual(['config.json', 'model.safetensors', 'tokenizer.json']);
    }
  });
});

describe('fetchModels', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'seekstone-models-'));
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const sha = (s: string) => createHash('sha256').update(s).digest('hex');

  function writeManifest(name: string, entries: ModelManifest['entries']): string {
    const path = join(dir, name);
    const manifest: ModelManifest = { source: 't', license: 't', note: 't', entries };
    writeFileSync(path, JSON.stringify(manifest));
    return path;
  }

  const stubFetch = (body: string) => vi.fn(async () => new Response(body));

  it('downloads, verifies, and writes a pinned file', async () => {
    const fetchImpl = stubFetch('model-bytes');
    const manifest = writeManifest('ok.json', [
      {
        model: 'm',
        file: 'config.json',
        url: 'https://huggingface.co/x',
        sha256: sha('model-bytes'),
        bytes: 11,
      },
    ]);
    const dest = join(dir, 'ok-dest');
    const r = await fetchModels(manifest, dest, undefined, fetchImpl);
    expect(r).toEqual({ fetched: 1, skipped: 0 });
    expect(readFileSync(join(dest, 'm', 'config.json'), 'utf8')).toBe('model-bytes');
  });

  it('skips an already-present checksum-matching file without fetching', async () => {
    const fetchSpy = vi.fn();
    const manifest = writeManifest('skip.json', [
      {
        model: 'm',
        file: 'config.json',
        url: 'https://huggingface.co/x',
        sha256: sha('cached'),
        bytes: 6,
      },
    ]);
    const dest = join(dir, 'skip-dest');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(dest, 'm'), { recursive: true });
    writeFileSync(join(dest, 'm', 'config.json'), 'cached');
    const r = await fetchModels(manifest, dest, undefined, fetchSpy);
    expect(r).toEqual({ fetched: 0, skipped: 1 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('throws on a checksum mismatch', async () => {
    const fetchImpl = stubFetch('tampered');
    const manifest = writeManifest('bad.json', [
      {
        model: 'm',
        file: 'config.json',
        url: 'https://huggingface.co/x',
        sha256: sha('expected'),
        bytes: 8,
      },
    ]);
    await expect(
      fetchModels(manifest, join(dir, 'bad-dest'), undefined, fetchImpl),
    ).rejects.toThrow(/checksum mismatch for m\/config.json/);
  });

  it('downloads a TBD-sentinel entry but throws demanding it be pinned', async () => {
    const fetchImpl = stubFetch('new-model');
    const manifest = writeManifest('tbd.json', [
      { model: 'm', file: 'config.json', url: 'https://huggingface.co/x', sha256: 'TBD', bytes: 9 },
    ]);
    const dest = join(dir, 'tbd-dest');
    await expect(fetchModels(manifest, dest, undefined, fetchImpl)).rejects.toThrow(
      new RegExp(`m/config.json: ${sha('new-model')}`),
    );
    // The file is still written so the printed hash can be trusted/re-checked.
    expect(existsSync(join(dest, 'm', 'config.json'))).toBe(true);
  });

  it('throws on a failed HTTP response', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 404 }));
    const manifest = writeManifest('http.json', [
      {
        model: 'm',
        file: 'config.json',
        url: 'https://huggingface.co/x',
        sha256: sha('x'),
        bytes: 1,
      },
    ]);
    await expect(
      fetchModels(manifest, join(dir, 'http-dest'), undefined, fetchImpl),
    ).rejects.toThrow(/failed: 404/);
  });
});
