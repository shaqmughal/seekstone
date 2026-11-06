import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  type CorpusManifest,
  type CorpusManifestEntry,
  fetchCorpus,
  pgUrl,
  sha256,
} from './corpus.js';

describe('fetchCorpus', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'seekstone-corpus-'));
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const entry = (id: number, body: string): CorpusManifestEntry => ({
    id,
    range: `Range ${id}`,
    url: pgUrl(id),
    sha256: sha256(body),
    bytes: Buffer.byteLength(body),
  });

  function writeManifest(name: string, entries: CorpusManifestEntry[]): string {
    const path = join(dir, name);
    const manifest: CorpusManifest = { source: 't', license: 't', note: 't', entries };
    writeFileSync(path, JSON.stringify(manifest));
    return path;
  }

  /** Serves `bodies[id]` for each pg URL; a number is an HTTP error status. */
  const stubFetch = (bodies: Record<number, string | number>) =>
    vi.fn(async (url: string) => {
      const id = Number(/pg(\d+)\.txt$/.exec(url)?.[1]);
      const body = bodies[id];
      return typeof body === 'number'
        ? new Response('nope', { status: body })
        : new Response(body ?? '');
    });

  it('downloads, verifies, and writes every pinned volume', async () => {
    const manifest = writeManifest('ok.json', [entry(1, 'vol one'), entry(2, 'vol two')]);
    const raw = join(dir, 'ok-raw');
    const r = await fetchCorpus(
      manifest,
      raw,
      undefined,
      stubFetch({ 1: 'vol one', 2: 'vol two' }),
    );
    expect(r).toEqual({ fetched: 2, skipped: 0 });
    expect(readFileSync(join(raw, 'pg1.txt'), 'utf8')).toBe('vol one');
    expect(readFileSync(join(raw, 'pg2.txt'), 'utf8')).toBe('vol two');
  });

  it('skips an already-present checksum-matching volume without fetching', async () => {
    const manifest = writeManifest('skip.json', [entry(1, 'cached')]);
    const raw = join(dir, 'skip-raw');
    mkdirSync(raw, { recursive: true });
    writeFileSync(join(raw, 'pg1.txt'), 'cached');
    const fetchSpy = vi.fn();
    const r = await fetchCorpus(manifest, raw, undefined, fetchSpy);
    expect(r).toEqual({ fetched: 0, skipped: 1 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps going past failures, saves the verified volumes, and names every failure', async () => {
    const manifest = writeManifest('mixed.json', [
      entry(1, 'good'),
      entry(2, 'pinned text'),
      entry(3, 'gone'),
      entry(4, 'also good'),
    ]);
    const raw = join(dir, 'mixed-raw');
    const fetchImpl = stubFetch({ 1: 'good', 2: 're-issued text', 3: 404, 4: 'also good' });
    const err = await fetchCorpus(manifest, raw, undefined, fetchImpl).then(
      () => {
        throw new Error('expected fetchCorpus to reject');
      },
      (e: Error) => e,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(err.message).toMatch(/^2 of 4 corpus volumes could not be verified:/);
    expect(err.message).toContain(
      `pg2 (Range 2): content differs from the pin (expected sha256 ${sha256('pinned text').slice(0, 12)}…, got ${sha256('re-issued text').slice(0, 12)}…, 14 bytes vs 11 pinned)`,
    );
    expect(err.message).toContain(`pg3 (Range 3): HTTP 404 from ${pgUrl(3)}`);
    expect(err.message).toContain('The other 2 volumes are verified and saved');
    expect(err.message).toContain('PROVENANCE.md');
    expect(err.message).toContain('SHA-340');
    // Verified volumes are saved; failed ones are never written.
    expect(readFileSync(join(raw, 'pg1.txt'), 'utf8')).toBe('good');
    expect(readFileSync(join(raw, 'pg4.txt'), 'utf8')).toBe('also good');
    expect(existsSync(join(raw, 'pg2.txt'))).toBe(false);
    expect(existsSync(join(raw, 'pg3.txt'))).toBe(false);
  });

  it('re-fetches a present file that no longer matches its pin', async () => {
    const manifest = writeManifest('stale.json', [entry(1, 'pinned')]);
    const raw = join(dir, 'stale-raw');
    mkdirSync(raw, { recursive: true });
    writeFileSync(join(raw, 'pg1.txt'), 'corrupted');
    const r = await fetchCorpus(manifest, raw, undefined, stubFetch({ 1: 'pinned' }));
    expect(r).toEqual({ fetched: 1, skipped: 0 });
    expect(readFileSync(join(raw, 'pg1.txt'), 'utf8')).toBe('pinned');
  });

  it('logs progress every ten volumes', async () => {
    const bodies: Record<number, string> = {};
    const entries = Array.from({ length: 10 }, (_, i) => {
      bodies[i + 1] = `v${i + 1}`;
      return entry(i + 1, `v${i + 1}`);
    });
    const log = vi.fn();
    await fetchCorpus(
      writeManifest('log.json', entries),
      join(dir, 'log-raw'),
      log,
      stubFetch(bodies),
    );
    expect(log).toHaveBeenCalledWith('fetched 10…');
  });
});
