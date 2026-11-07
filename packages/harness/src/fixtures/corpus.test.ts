import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  type CorpusManifest,
  type CorpusManifestEntry,
  type CorpusMirror,
  fetchCorpus,
  type JsonFetch,
  mirrorUrl,
  pgUrl,
  pinnedLocalFiles,
  publishCorpus,
  sha256,
  verifyCorpusMirror,
} from './corpus.js';

const MIRROR: CorpusMirror = { repo: 'owner/corpus', tag: 'eb1911-v1' };

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

function writeManifest(
  name: string,
  entries: CorpusManifestEntry[],
  mirror?: CorpusMirror,
): string {
  const path = join(dir, name);
  const manifest: CorpusManifest = { source: 't', license: 't', note: 't', mirror, entries };
  writeFileSync(path, JSON.stringify(manifest));
  return path;
}

/** Writes `bodies` as pg<id>.txt into a fresh directory under the temp dir. */
function writeRaw(name: string, bodies: Record<number, string>): string {
  const raw = join(dir, name);
  mkdirSync(raw, { recursive: true });
  for (const [id, body] of Object.entries(bodies)) writeFileSync(join(raw, `pg${id}.txt`), body);
  return raw;
}

async function rejection(p: Promise<unknown>): Promise<Error> {
  return p.then(
    () => {
      throw new Error('expected a rejection');
    },
    (e: Error) => e,
  );
}

describe('committed corpus manifest', () => {
  const manifest = JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../fixtures/corpus/manifest.json', import.meta.url)),
      'utf8',
    ),
  ) as CorpusManifest;

  it('names the seekstone-corpus mirror release', () => {
    expect(manifest.mirror).toEqual({ repo: 'shaqmughal/seekstone-corpus', tag: 'eb1911-v1' });
  });

  it('pins 125 volumes, each with a sha256 and size', () => {
    expect(manifest.entries).toHaveLength(125);
    for (const e of manifest.entries) {
      expect(e.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(e.bytes).toBeGreaterThan(0);
    }
  });
});

describe('fetchCorpus', () => {
  /** Serves `pg[id]` for Gutenberg URLs and `mirror[id]` for mirror URLs; a number is an HTTP status, an Error is thrown. */
  const stubFetch = (
    pg: Record<number, string | number | Error>,
    mirror: Record<number, string | number> = {},
  ) =>
    vi.fn(async (url: string) => {
      const id = Number(/pg(\d+)\.txt$/.exec(url)?.[1]);
      const body = url.startsWith('https://github.com/') ? mirror[id] : pg[id];
      if (body instanceof Error) throw body;
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
    expect(r).toEqual({ fetched: 2, skipped: 0, fromMirror: 0 });
    expect(readFileSync(join(raw, 'pg1.txt'), 'utf8')).toBe('vol one');
    expect(readFileSync(join(raw, 'pg2.txt'), 'utf8')).toBe('vol two');
  });

  it('skips an already-present checksum-matching volume without fetching', async () => {
    const manifest = writeManifest('skip.json', [entry(1, 'cached')]);
    const raw = writeRaw('skip-raw', { 1: 'cached' });
    const fetchSpy = vi.fn();
    const r = await fetchCorpus(manifest, raw, undefined, fetchSpy);
    expect(r).toEqual({ fetched: 0, skipped: 1, fromMirror: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to the mirror when Gutenberg serves a re-issued file or fails', async () => {
    const manifest = writeManifest(
      'fallback.json',
      [entry(1, 'good'), entry(2, 'pinned'), entry(3, 'also pinned')],
      MIRROR,
    );
    const raw = join(dir, 'fallback-raw');
    const fetchImpl = stubFetch(
      { 1: 'good', 2: 're-issued', 3: 503 },
      { 2: 'pinned', 3: 'also pinned' },
    );
    const r = await fetchCorpus(manifest, raw, undefined, fetchImpl);
    expect(r).toEqual({ fetched: 3, skipped: 0, fromMirror: 2 });
    // Gutenberg first for every volume; the mirror only for the two that failed.
    expect(fetchImpl.mock.calls.map(([u]) => u)).toEqual([
      pgUrl(1),
      pgUrl(2),
      mirrorUrl(MIRROR, 2),
      pgUrl(3),
      mirrorUrl(MIRROR, 3),
    ]);
    expect(readFileSync(join(raw, 'pg2.txt'), 'utf8')).toBe('pinned');
    expect(readFileSync(join(raw, 'pg3.txt'), 'utf8')).toBe('also pinned');
  });

  it('keeps going past failures, saves the verified volumes, and names every failure', async () => {
    const manifest = writeManifest('mixed.json', [
      entry(1, 'good'),
      entry(2, 'pinned text'),
      entry(3, 'gone'),
      entry(4, 'also good'),
      entry(5, 'unreachable'),
    ]);
    const raw = join(dir, 'mixed-raw');
    const fetchImpl = stubFetch({
      1: 'good',
      2: 're-issued text',
      3: 404,
      4: 'also good',
      5: new Error('ECONNRESET'),
    });
    const err = await rejection(fetchCorpus(manifest, raw, undefined, fetchImpl));
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(err.message).toMatch(/^3 of 5 corpus volumes could not be verified:/);
    expect(err.message).toContain(
      `pg2 (Range 2): Project Gutenberg: content differs from the pin (expected sha256 ${sha256('pinned text').slice(0, 12)}…, got ${sha256('re-issued text').slice(0, 12)}…, 14 bytes vs 11 pinned)`,
    );
    expect(err.message).toContain('pg3 (Range 3): Project Gutenberg: HTTP 404');
    expect(err.message).toContain('pg5 (Range 5): Project Gutenberg: request failed (ECONNRESET)');
    expect(err.message).toContain('The other 2 volumes are verified and saved');
    expect(err.message).toContain('manifest.json names no mirror');
    expect(err.message).toContain('PROVENANCE.md');
    // Verified volumes are saved; failed ones are never written.
    expect(readFileSync(join(raw, 'pg1.txt'), 'utf8')).toBe('good');
    expect(readFileSync(join(raw, 'pg4.txt'), 'utf8')).toBe('also good');
    for (const id of [2, 3, 5]) expect(existsSync(join(raw, `pg${id}.txt`))).toBe(false);
  });

  it('reports both sources when neither serves a pin-exact file', async () => {
    const manifest = writeManifest('both.json', [entry(1, 'pinned')], MIRROR);
    const raw = join(dir, 'both-raw');
    const err = await rejection(
      fetchCorpus(manifest, raw, undefined, stubFetch({ 1: 're-issued' }, { 1: 404 })),
    );
    expect(err.message).toContain('pg1 (Range 1): Project Gutenberg: content differs from the pin');
    expect(err.message).toContain('; mirror owner/corpus@eb1911-v1: HTTP 404');
    expect(err.message).toContain('verify-corpus-mirror');
    expect(existsSync(join(raw, 'pg1.txt'))).toBe(false);
  });

  it('re-fetches a present file that no longer matches its pin', async () => {
    const manifest = writeManifest('stale.json', [entry(1, 'pinned')]);
    const raw = writeRaw('stale-raw', { 1: 'corrupted' });
    const r = await fetchCorpus(manifest, raw, undefined, stubFetch({ 1: 'pinned' }));
    expect(r).toEqual({ fetched: 1, skipped: 0, fromMirror: 0 });
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

describe('verifyCorpusMirror', () => {
  const pinned = [entry(1, 'one'), entry(2, 'two')];
  const asset = (e: CorpusManifestEntry, digest = `sha256:${e.sha256}`) => ({
    name: `pg${e.id}.txt`,
    size: e.bytes,
    digest,
  });
  const release = (over: Record<string, unknown> = {}) => ({
    draft: false,
    immutable: true,
    assets: pinned.map((e) => asset(e)),
    ...over,
  });
  const stubJson = (status: number, body: unknown = {}) =>
    vi.fn<JsonFetch>(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }));

  it('passes when the release is immutable and holds exactly the pinned files', async () => {
    const fetchJson = stubJson(200, release());
    const problems = await verifyCorpusMirror(writeManifest('v-ok.json', pinned, MIRROR), {
      token: 't0ken',
      fetchJson,
    });
    expect(problems).toEqual([]);
    const [url, headers] = fetchJson.mock.calls[0] ?? [];
    expect(url).toBe('https://api.github.com/repos/owner/corpus/releases/tags/eb1911-v1');
    expect(headers?.authorization).toBe('Bearer t0ken');
  });

  it('sends no authorization header without a token', async () => {
    const fetchJson = stubJson(200, release());
    await verifyCorpusMirror(writeManifest('v-anon.json', pinned, MIRROR), { fetchJson });
    expect(fetchJson.mock.calls[0]?.[1]).not.toHaveProperty('authorization');
  });

  it('reports a manifest without a mirror', async () => {
    expect(await verifyCorpusMirror(writeManifest('v-none.json', pinned))).toEqual([
      'manifest.json has no "mirror" entry.',
    ]);
  });

  it('reports a missing release and other API errors', async () => {
    const m = writeManifest('v-404.json', pinned, MIRROR);
    expect(await verifyCorpusMirror(m, { fetchJson: stubJson(404) })).toEqual([
      'release owner/corpus@eb1911-v1 does not exist.',
    ]);
    expect((await verifyCorpusMirror(m, { fetchJson: stubJson(500) }))[0]).toMatch(/HTTP 500/);
  });

  it('reports drafts, mutable releases, and missing, extra, or mismatched files', async () => {
    const [one, two] = pinned as [CorpusManifestEntry, CorpusManifestEntry];
    const body = release({
      draft: true,
      immutable: false,
      assets: [asset(one, 'sha256:0000'), { name: 'pg9.txt', size: 1, digest: 'sha256:9' }],
    });
    const problems = await verifyCorpusMirror(writeManifest('v-bad.json', pinned, MIRROR), {
      fetchJson: stubJson(200, body),
    });
    expect(problems).toEqual([
      'release eb1911-v1 is a draft.',
      'release eb1911-v1 is not immutable.',
      `pg1.txt digest sha256:0000 does not match the pin sha256:${one.sha256}.`,
      `pg${two.id}.txt is missing from the release.`,
      'pg9.txt is in the release but not in manifest.json.',
    ]);
  });

  it('treats an asset without a digest as a mismatch', async () => {
    const [one, two] = pinned as [CorpusManifestEntry, CorpusManifestEntry];
    const body = release({ assets: [{ name: 'pg1.txt', size: 3, digest: null }, asset(two)] });
    const problems = await verifyCorpusMirror(writeManifest('v-nodigest.json', pinned, MIRROR), {
      fetchJson: stubJson(200, body),
    });
    expect(problems).toEqual([
      `pg1.txt digest (none) does not match the pin sha256:${one.sha256}.`,
    ]);
  });
});

describe('pinnedLocalFiles', () => {
  it('returns every pinned file in manifest order when all match', () => {
    const manifest = writeManifest('l-ok.json', [entry(2, 'b'), entry(1, 'a')]);
    const raw = writeRaw('l-ok-raw', { 1: 'a', 2: 'b' });
    expect(pinnedLocalFiles(manifest, raw)).toEqual([join(raw, 'pg2.txt'), join(raw, 'pg1.txt')]);
  });

  it('names every missing or mismatched file', () => {
    const manifest = writeManifest('l-bad.json', [entry(1, 'a'), entry(2, 'b'), entry(3, 'c')]);
    const raw = writeRaw('l-bad-raw', { 1: 'a', 2: 'changed' });
    expect(() => pinnedLocalFiles(manifest, raw)).toThrow(
      /2 of 3 local volumes .* are not pin-exact:\n {2}pg2\.txt does not match its pin\n {2}pg3\.txt is missing/,
    );
  });
});

describe('publishCorpus', () => {
  const pinned = [entry(1, 'one'), entry(2, 'two')];
  let n = 0;
  const raw = () => writeRaw(`p-raw-${n++}`, { 1: 'one', 2: 'two' });

  it('uploads to a draft, publishes, then verifies', async () => {
    const manifest = writeManifest('p-ok.json', pinned, MIRROR);
    const rawDir = raw();
    const run = vi.fn(async () => {});
    const verify = vi
      .fn<() => Promise<string[]>>()
      .mockResolvedValueOnce(['release owner/corpus@eb1911-v1 does not exist.'])
      .mockResolvedValueOnce([]);
    const log = vi.fn();
    await publishCorpus(manifest, rawDir, { run, verify, log });
    const calls = run.mock.calls as unknown as [string, string[]][];
    expect(calls.map(([cmd, args]) => [cmd, args.slice(0, 2)])).toEqual([
      ['gh', ['release', 'create']],
      ['gh', ['release', 'upload']],
      ['gh', ['release', 'edit']],
    ]);
    expect(calls[0]?.[1]).toEqual(
      expect.arrayContaining(['eb1911-v1', '--repo', 'owner/corpus', '--draft']),
    );
    expect(calls[1]?.[1]).toEqual(
      expect.arrayContaining([join(rawDir, 'pg1.txt'), join(rawDir, 'pg2.txt')]),
    );
    expect(calls[2]?.[1]).toContain('--draft=false');
    expect(verify).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenLastCalledWith(expect.stringMatching(/^verified/));
  });

  it('refuses to run without a mirror in the manifest', async () => {
    const run = vi.fn();
    await expect(
      publishCorpus(writeManifest('p-none.json', pinned), raw(), { run }),
    ).rejects.toThrow(/no "mirror" entry/);
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses to upload local files that are not pin-exact', async () => {
    const run = vi.fn();
    const rawDir = writeRaw('p-bad-raw', { 1: 'one', 2: 'changed' });
    await expect(
      publishCorpus(writeManifest('p-bad.json', pinned, MIRROR), rawDir, {
        run,
        verify: async () => ['release owner/corpus@eb1911-v1 does not exist.'],
      }),
    ).rejects.toThrow(/not pin-exact/);
    expect(run).not.toHaveBeenCalled();
  });

  it('does nothing when the release is already published and matches', async () => {
    const run = vi.fn();
    await expect(
      publishCorpus(writeManifest('p-done.json', pinned, MIRROR), raw(), {
        run,
        verify: async () => [],
      }),
    ).rejects.toThrow(/already published and matches manifest\.json; nothing to do/);
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses to touch an existing release that does not match', async () => {
    const run = vi.fn();
    await expect(
      publishCorpus(writeManifest('p-drift.json', pinned, MIRROR), raw(), {
        run,
        verify: async () => ['pg2.txt is missing from the release.'],
      }),
    ).rejects.toThrow(/already exists and does not match[\s\S]*Pick a new tag/);
    expect(run).not.toHaveBeenCalled();
  });

  it('retries the post-publish check while GitHub still reports the release missing', async () => {
    const missing = ['release owner/corpus@eb1911-v1 does not exist.'];
    const verify = vi
      .fn<() => Promise<string[]>>()
      .mockResolvedValueOnce(missing)
      .mockResolvedValueOnce(missing)
      .mockResolvedValueOnce(missing)
      .mockResolvedValueOnce([]);
    const sleep = vi.fn(async () => {});
    await publishCorpus(writeManifest('p-lag.json', pinned, MIRROR), raw(), {
      run: async () => {},
      verify,
      sleep,
    });
    expect(verify).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('gives up after five retries if the release never appears', async () => {
    const verify = vi.fn(async () => ['release owner/corpus@eb1911-v1 does not exist.']);
    const sleep = vi.fn(async () => {});
    await expect(
      publishCorpus(writeManifest('p-never.json', pinned, MIRROR), raw(), {
        run: async () => {},
        verify,
        sleep,
      }),
    ).rejects.toThrow(/does not verify/);
    expect(sleep).toHaveBeenCalledTimes(5);
  });

  it('fails when the published release does not verify', async () => {
    const verify = vi
      .fn<() => Promise<string[]>>()
      .mockResolvedValueOnce(['release owner/corpus@eb1911-v1 does not exist.'])
      .mockResolvedValueOnce(['release eb1911-v1 is not immutable.']);
    await expect(
      publishCorpus(writeManifest('p-after.json', pinned, MIRROR), raw(), {
        run: async () => {},
        verify,
      }),
    ).rejects.toThrow(/does not verify:\n {2}release eb1911-v1 is not immutable/);
  });
});
