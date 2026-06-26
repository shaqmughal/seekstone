import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Article, parseVolume } from './parse-volume.js';

export interface CorpusManifestEntry {
  /** Project Gutenberg ebook id. */
  id: number;
  /** Alphabetical range, e.g. "Anjar to Apollo". */
  range: string;
  /** Canonical source URL. */
  url: string;
  /** SHA-256 of the downloaded file (byte-identical regeneration guarantee). */
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
 */
export async function fetchCorpus(
  manifestPath: string,
  rawDir: string,
  log: (msg: string) => void = () => {},
): Promise<{ fetched: number; skipped: number }> {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CorpusManifest;
  mkdirSync(rawDir, { recursive: true });
  let fetched = 0;
  let skipped = 0;
  for (const e of manifest.entries) {
    const dest = join(rawDir, `pg${e.id}.txt`);
    if (existsSync(dest) && sha256(readFileSync(dest)) === e.sha256) {
      skipped++;
      continue;
    }
    const res = await fetch(e.url);
    if (!res.ok) throw new Error(`fetch ${e.url} failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const got = sha256(buf);
    if (got !== e.sha256) {
      throw new Error(`checksum mismatch for pg${e.id}: expected ${e.sha256}, got ${got}`);
    }
    writeFileSync(dest, buf);
    fetched++;
    if (fetched % 10 === 0) log(`fetched ${fetched}…`);
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
