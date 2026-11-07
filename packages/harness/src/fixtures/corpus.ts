import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// Explicit undici fetch — see models.ts: importing the npm `undici` package
// anywhere in the process breaks Node 26's global-fetch redirect following.
import { fetch as undiciFetch } from 'undici';
// Type-only: models.ts imports sha256 from here, so a value import would be circular.
import type { FetchLike } from './models.js';
import { type Article, parseVolume } from './parse-volume.js';

const defaultFetch: FetchLike = (url) => undiciFetch(url);

export interface CorpusManifestEntry {
  /** Project Gutenberg ebook id. */
  id: number;
  /** Alphabetical range, e.g. "Anjar to Apollo". */
  range: string;
  /** Canonical source URL. */
  url: string;
  /** SHA-256 of the downloaded file (`fetch-corpus` rejects any file that doesn't match). */
  sha256: string;
  /** File size in bytes. */
  bytes: number;
}

/** Where the pinned files are mirrored: a GitHub release (SHA-464). */
export interface CorpusMirror {
  /** `owner/name` of the data-only repository that holds the release. */
  repo: string;
  /** Release tag. Releases are immutable, so a re-pin publishes a new tag. */
  tag: string;
}

export interface CorpusManifest {
  source: string;
  license: string;
  note: string;
  /** Fallback source for volumes whose Project Gutenberg file no longer matches its pin. */
  mirror?: CorpusMirror;
  entries: CorpusManifestEntry[];
}

export function pgUrl(id: number): string {
  return `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`;
}

export function mirrorUrl(mirror: CorpusMirror, id: number): string {
  return `https://github.com/${mirror.repo}/releases/download/${mirror.tag}/pg${id}.txt`;
}

export function sha256(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

function readManifest(manifestPath: string): CorpusManifest {
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as CorpusManifest;
}

/** Download one URL and check it against the pin. Returns the bytes, or why they were rejected. */
async function fetchVerified(
  url: string,
  e: CorpusManifestEntry,
  fetchImpl: FetchLike,
): Promise<{ buf: Buffer } | { reason: string }> {
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchImpl(url);
  } catch (err) {
    return { reason: `request failed (${err instanceof Error ? err.message : String(err)})` };
  }
  if (!res.ok) return { reason: `HTTP ${res.status}` };
  const buf = Buffer.from(await res.arrayBuffer());
  const got = sha256(buf);
  if (got !== e.sha256) {
    return {
      reason:
        `content differs from the pin (expected sha256 ${e.sha256.slice(0, 12)}…, ` +
        `got ${got.slice(0, 12)}…, ${buf.length} bytes vs ${e.bytes} pinned)`,
    };
  }
  return { buf };
}

/**
 * Download every volume named in the manifest to `rawDir`, verifying each file
 * against its committed SHA-256. Already-present, checksum-matching files are
 * skipped. Returns counts of fetched/skipped files and how many came from the mirror.
 *
 * Each volume is tried from Project Gutenberg first, then from the manifest's
 * mirror (SHA-340, SHA-464): Gutenberg re-issues some pinned files over time,
 * and the set changes, so the fallback is decided per file by the checksum,
 * never by a list in code. Either source must match the pin; a file that
 * fails verification is never written. A failed volume doesn't stop the run:
 * one error at the end names each failure with its range and the reasons.
 */
export async function fetchCorpus(
  manifestPath: string,
  rawDir: string,
  log: (msg: string) => void = () => {},
  fetchImpl: FetchLike = defaultFetch,
): Promise<{ fetched: number; skipped: number; fromMirror: number }> {
  const manifest = readManifest(manifestPath);
  mkdirSync(rawDir, { recursive: true });
  let fetched = 0;
  let skipped = 0;
  let fromMirror = 0;
  const failures: string[] = [];
  for (const e of manifest.entries) {
    const dest = join(rawDir, `pg${e.id}.txt`);
    if (existsSync(dest) && sha256(readFileSync(dest)) === e.sha256) {
      skipped++;
      continue;
    }
    let got = await fetchVerified(pgUrl(e.id), e, fetchImpl);
    let reasons = 'reason' in got ? [`Project Gutenberg: ${got.reason}`] : [];
    if ('reason' in got && manifest.mirror) {
      got = await fetchVerified(mirrorUrl(manifest.mirror, e.id), e, fetchImpl);
      if ('reason' in got)
        reasons.push(`mirror ${manifest.mirror.repo}@${manifest.mirror.tag}: ${got.reason}`);
      else {
        fromMirror++;
        reasons = [];
      }
    }
    if ('reason' in got) {
      failures.push(`  pg${e.id} (${e.range}): ${reasons.join('; ')}`);
      continue;
    }
    writeFileSync(dest, got.buf);
    fetched++;
    if (fetched % 10 === 0) log(`fetched ${fetched}…`);
  }
  if (failures.length > 0) {
    const ok = manifest.entries.length - failures.length;
    throw new Error(
      [
        `${failures.length} of ${manifest.entries.length} corpus volumes could not be verified:`,
        ...failures,
        `The other ${ok} volumes are verified and saved in ${rawDir}.`,
        ...(manifest.mirror
          ? [
              'Neither Project Gutenberg nor the mirror served a file matching these pins.',
              'Check the mirror release with `npm run harness -- verify-corpus-mirror`.',
            ]
          : [
              'Project Gutenberg has re-issued some pinned volumes, and manifest.json names no mirror.',
            ]),
        'See packages/harness/fixtures/corpus/PROVENANCE.md ("Reproducibility status").',
      ].join('\n'),
    );
  }
  return { fetched, skipped, fromMirror };
}

/** The slice of a GitHub REST response `verifyCorpusMirror` reads; injectable so tests stay offline. */
export type JsonFetch = (
  url: string,
  headers: Record<string, string>,
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const defaultJsonFetch: JsonFetch = (url, headers) => undiciFetch(url, { headers });

interface ReleaseJson {
  immutable?: boolean;
  draft?: boolean;
  assets?: { name: string; size: number; digest?: string | null }[];
}

/**
 * Check that the release named in the manifest's `mirror` holds exactly the
 * pinned files, by the SHA-256 digests GitHub reports per asset (one API call,
 * no downloads). Returns a list of problems; empty means the mirror matches
 * `manifest.json`. Pass a token to avoid the unauthenticated rate limit.
 */
export async function verifyCorpusMirror(
  manifestPath: string,
  opts: { token?: string; fetchJson?: JsonFetch } = {},
): Promise<string[]> {
  const manifest = readManifest(manifestPath);
  const m = manifest.mirror;
  if (!m) return ['manifest.json has no "mirror" entry.'];
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'seekstone-harness',
  };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const url = `https://api.github.com/repos/${m.repo}/releases/tags/${encodeURIComponent(m.tag)}`;
  const res = await (opts.fetchJson ?? defaultJsonFetch)(url, headers);
  if (res.status === 404) return [`release ${m.repo}@${m.tag} does not exist.`];
  if (!res.ok) return [`GitHub API returned HTTP ${res.status} for ${url}.`];
  const rel = (await res.json()) as ReleaseJson;
  const problems: string[] = [];
  if (rel.draft) problems.push(`release ${m.tag} is a draft.`);
  if (rel.immutable !== true) problems.push(`release ${m.tag} is not immutable.`);
  const assets = new Map((rel.assets ?? []).map((a) => [a.name, a]));
  const expected = new Set<string>();
  for (const e of manifest.entries) {
    const name = `pg${e.id}.txt`;
    expected.add(name);
    const a = assets.get(name);
    if (!a) problems.push(`${name} is missing from the release.`);
    else if (a.digest !== `sha256:${e.sha256}`) {
      problems.push(
        `${name} digest ${a.digest ?? '(none)'} does not match the pin sha256:${e.sha256}.`,
      );
    }
  }
  for (const name of assets.keys()) {
    if (!expected.has(name)) problems.push(`${name} is in the release but not in manifest.json.`);
  }
  return problems;
}

/**
 * Check that every pinned volume is present in `rawDir` and matches its pin,
 * returning the file paths in manifest order. `publish-corpus` runs this before
 * uploading anything, so a release can only ever hold pin-exact files.
 */
export function pinnedLocalFiles(manifestPath: string, rawDir: string): string[] {
  const manifest = readManifest(manifestPath);
  const bad: string[] = [];
  const files = manifest.entries.map((e) => {
    const path = join(rawDir, `pg${e.id}.txt`);
    if (!existsSync(path)) bad.push(`  pg${e.id}.txt is missing`);
    else if (sha256(readFileSync(path)) !== e.sha256)
      bad.push(`  pg${e.id}.txt does not match its pin`);
    return path;
  });
  if (bad.length > 0) {
    throw new Error(
      [
        `${bad.length} of ${manifest.entries.length} local volumes in ${rawDir} are not pin-exact:`,
        ...bad,
      ].join('\n'),
    );
  }
  return files;
}

/** Runs an external command (here: the GitHub CLI); injectable so tests never touch GitHub. */
export type CommandRunner = (cmd: string, args: string[]) => Promise<void>;

/**
 * Publish the pinned corpus as the immutable release named in the manifest's
 * `mirror` (SHA-464). Checks every local file against its pin first, refuses
 * to touch a release that already exists, uploads to a draft and only then
 * publishes (an immutable release locks at publish time), and finally confirms
 * the published digests through `verifyCorpusMirror`.
 */
export async function publishCorpus(
  manifestPath: string,
  rawDir: string,
  opts: { run: CommandRunner; verify?: () => Promise<string[]>; log?: (msg: string) => void },
): Promise<void> {
  const manifest = readManifest(manifestPath);
  const m = manifest.mirror;
  if (!m) throw new Error('manifest.json has no "mirror" entry to publish to.');
  const log = opts.log ?? (() => {});
  const verify = opts.verify ?? (() => verifyCorpusMirror(manifestPath));
  const files = pinnedLocalFiles(manifestPath, rawDir);
  log(`${files.length} local volumes match their pins.`);

  const before = await verify();
  const missing = before.length === 1 && before[0]?.endsWith('does not exist.');
  if (!missing) {
    throw new Error(
      before.length === 0
        ? `${m.repo}@${m.tag} is already published and matches manifest.json; nothing to do.`
        : [
            `${m.repo}@${m.tag} already exists and does not match manifest.json:`,
            ...before.map((p) => `  ${p}`),
            'Published releases are immutable. Pick a new tag in manifest.json and publish again.',
          ].join('\n'),
    );
  }

  const notes =
    `${files.length} pinned volumes for Seekstone's benchmark vaults, byte-identical to the ` +
    'SHA-256 pins in packages/harness/fixtures/corpus/manifest.json ' +
    '(https://github.com/shaqmughal/seekstone). Fetched automatically by `npm run harness -- fetch-corpus`.';
  await opts.run('gh', [
    'release',
    'create',
    m.tag,
    '--repo',
    m.repo,
    '--draft',
    '--title',
    `${m.tag}`,
    '--notes',
    notes,
  ]);
  log(`created draft release ${m.repo}@${m.tag}; uploading ${files.length} files…`);
  await opts.run('gh', ['release', 'upload', m.tag, '--repo', m.repo, ...files]);
  await opts.run('gh', ['release', 'edit', m.tag, '--repo', m.repo, '--draft=false', '--latest']);
  log(`published ${m.repo}@${m.tag}.`);

  const after = await verify();
  if (after.length > 0) {
    throw new Error(
      [`published ${m.repo}@${m.tag}, but it does not verify:`, ...after.map((p) => `  ${p}`)].join(
        '\n',
      ),
    );
  }
  log('verified: every asset digest matches its pin, and the release is immutable.');
}

/**
 * Load every `pg<id>.txt` in `rawDir`, parse into articles, and return a
 * deduped, deterministically-ordered pool. Dedup keeps the largest body for a
 * given title (some headwords appear in overlapping PG re-uploads). The pool is
 * sorted by title so sampling with a fixed seed is reproducible regardless of
 * filesystem read order.
 */
export function loadCorpus(rawDir: string, opts: { minBytes?: number } = {}): Article[] {
  const minBytes = opts.minBytes ?? 200;
  const files = readdirSync(rawDir)
    .filter((f) => /^pg\d+\.txt$/.test(f))
    .sort();
  const byTitle = new Map<string, Article>();
  for (const f of files) {
    let articles: Article[];
    try {
      articles = parseVolume(readFileSync(join(rawDir, f), 'utf8')).articles;
    } catch {
      continue; // single-article / malformed volumes (e.g. "English History")
    }
    for (const a of articles) {
      if (a.bytes < minBytes) continue;
      const key = a.title.toLowerCase();
      const existing = byTitle.get(key);
      if (!existing || a.bytes > existing.bytes) byTitle.set(key, a);
    }
  }
  return [...byTitle.values()].sort((a, b) => a.title.localeCompare(b.title, 'en'));
}
