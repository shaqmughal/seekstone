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

export interface CorpusManifest {
  source: string;
  license: string;
  note: string;
  entries: CorpusManifestEntry[];
}

export function pgUrl(id: number): string {
  return `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`;
}

export function sha256(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Download every volume named in the manifest to `rawDir`, verifying each file
 * against its committed SHA-256. Already-present, checksum-matching files are
 * skipped. Returns counts of fetched/skipped files.
 *
 * A failed volume doesn't stop the run: every verified volume is still saved,
 * and one error at the end names each failure with its range and the reason.
 * Project Gutenberg re-issues some pinned files over time (SHA-340), and the
 * set changes, so the failures are reported as found rather than listed in code.
 * A file that fails verification is never written.
 */
export async function fetchCorpus(
  manifestPath: string,
  rawDir: string,
  log: (msg: string) => void = () => {},
  fetchImpl: FetchLike = defaultFetch,
): Promise<{ fetched: number; skipped: number }> {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CorpusManifest;
  mkdirSync(rawDir, { recursive: true });
  let fetched = 0;
  let skipped = 0;
  const failures: string[] = [];
  for (const e of manifest.entries) {
    const dest = join(rawDir, `pg${e.id}.txt`);
    if (existsSync(dest) && sha256(readFileSync(dest)) === e.sha256) {
      skipped++;
      continue;
    }
    const res = await fetchImpl(pgUrl(e.id));
    if (!res.ok) {
      failures.push(`  pg${e.id} (${e.range}): HTTP ${res.status} from ${pgUrl(e.id)}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const got = sha256(buf);
    if (got !== e.sha256) {
      failures.push(
        `  pg${e.id} (${e.range}): content differs from the pin ` +
          `(expected sha256 ${e.sha256.slice(0, 12)}…, got ${got.slice(0, 12)}…, ` +
          `${buf.length} bytes vs ${e.bytes} pinned)`,
      );
      continue;
    }
    writeFileSync(dest, buf);
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
        'Project Gutenberg has re-issued some pinned volumes since the manifest was committed,',
        'so a download that differs from its pin is expected, not a network fault. The committed',
        'vaults still regenerate byte-identically from the pinned files, but those files are not',
        'all downloadable today. See packages/harness/fixtures/corpus/PROVENANCE.md',
        '("Reproducibility status") and Linear SHA-340.',
      ].join('\n'),
    );
  }
  return { fetched, skipped };
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
