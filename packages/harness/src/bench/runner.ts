import { readFile } from 'node:fs/promises';
import type { Backend } from './backend.js';
import type { QuerySet } from './queries.js';
import { type RunStats, type StreamStats, runN, runNStream } from './timer.js';

export interface ToolBenchmarks {
  /** list_notes — vault-wide listing, no filters. */
  list: RunStats | null;
  /** list_tags — all tags sorted by count. */
  listTags: RunStats | null;
  /** outline_note — heading/block structure of the small read target. */
  outline: { path: string; stats: RunStats } | null;
  /** get_backlinks — reverse-link lookup for the small read target. */
  getBacklinks: { path: string; stats: RunStats } | null;
  /** get_links — outgoing link enumeration for the small read target. */
  getLinks: { path: string; stats: RunStats } | null;
  /** get_periodic_note — today's daily note (existence check, no side effects). */
  getPeriodicNote: RunStats | null;
}

export interface BenchmarkSummary {
  snapshotDate: string;
  machine: { platform: string; arch: string; node: string; cpus: number };
  backend: { name: string; description: string };
  runs: number;
  rssBefore: number;
  rssPeak: number;
  search: Array<{
    id: string;
    kind: string;
    query: string;
    stats: RunStats;
    /** First-run hit count — gives a sense of selectivity. */
    firstRunHitCount: number;
    /** TTFR stats. Null when the backend does not implement searchStream. */
    ttfr: StreamStats | null;
  }>;
  read: {
    small: { path: string; stats: RunStats } | null;
    large: { path: string; stats: RunStats } | null;
  };
  /** Per-tool latency for tools beyond search/read. Null when backend does not implement. */
  tools: ToolBenchmarks;
}

export interface RunnerOptions {
  backend: Backend;
  querySet: QuerySet;
  /** If reads.small/large are null, auto-pick from this stats file. */
  vaultStatsPath?: string;
}

export async function runBenchmark(opts: RunnerOptions): Promise<BenchmarkSummary> {
  const { backend, querySet } = opts;
  const reads = await resolveReadPaths(querySet, opts.vaultStatsPath);

  const rssBefore = process.memoryUsage().rss;
  let rssPeak = rssBefore;
  const samplePeak = () => {
    const r = process.memoryUsage().rss;
    if (r > rssPeak) rssPeak = r;
  };

  // ── Search ──────────────────────────────────────────────────────────────────
  const search: BenchmarkSummary['search'] = [];
  for (const q of querySet.queries) {
    let firstHits = 0;
    let firstSeen = false;
    const stats = await runN(async () => {
      const r = await backend.search(q.query);
      if (!firstSeen) {
        firstHits = r.result.length;
        firstSeen = true;
      }
      samplePeak();
      return r;
    }, querySet.runs);
    const streamFn = backend.searchStream?.bind(backend);
    const ttfr = streamFn ? await runNStream(() => streamFn(q.query), querySet.runs) : null;
    search.push({
      id: q.id,
      kind: q.kind,
      query: q.query,
      stats,
      firstRunHitCount: firstHits,
      ttfr,
    });
  }

  // ── Read ────────────────────────────────────────────────────────────────────
  const readSmall = reads.small
    ? {
        path: reads.small,
        stats: await runN(async () => {
          const r = await backend.read(reads.small as string);
          samplePeak();
          return r;
        }, querySet.runs),
      }
    : null;

  const readLarge = reads.large
    ? {
        path: reads.large,
        stats: await runN(async () => {
          const r = await backend.read(reads.large as string);
          samplePeak();
          return r;
        }, querySet.runs),
      }
    : null;

  // ── Extended tool benchmarks ─────────────────────────────────────────────────
  const tools = await runToolBenchmarks(backend, reads.small, querySet.runs, samplePeak);

  return {
    snapshotDate: new Date().toISOString(),
    machine: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      cpus: (await import('node:os')).cpus().length,
    },
    backend: { name: backend.name, description: backend.description },
    runs: querySet.runs,
    rssBefore,
    rssPeak,
    search,
    read: { small: readSmall, large: readLarge },
    tools,
  };
}

async function runToolBenchmarks(
  backend: Backend,
  samplePath: string | null,
  runs: number,
  samplePeak: () => void,
): Promise<ToolBenchmarks> {
  const bench = async <T>(
    fn: () => Promise<{ result: T; payloadBytes: number; payloadText?: string }>,
  ) => {
    const stats = await runN(async () => {
      const r = await fn();
      samplePeak();
      return r;
    }, runs);
    return stats;
  };

  // Capture optional methods bound to `backend` so TypeScript narrows away
  // undefined inside the bench() lambda without losing `this` context.
  const listFn = backend.list?.bind(backend);
  const list = listFn ? await bench(() => listFn()) : null;

  const listTagsFn = backend.listTags?.bind(backend);
  const listTags = listTagsFn ? await bench(() => listTagsFn()) : null;

  // outline, getBacklinks, getLinks — all need a note path
  let outline: ToolBenchmarks['outline'] = null;
  let getBacklinks: ToolBenchmarks['getBacklinks'] = null;
  let getLinks: ToolBenchmarks['getLinks'] = null;

  if (samplePath) {
    const outlineFn = backend.outline?.bind(backend);
    if (outlineFn) {
      outline = {
        path: samplePath,
        stats: await bench(() => outlineFn(samplePath)),
      };
    }
    const getBacklinksFn = backend.getBacklinks?.bind(backend);
    if (getBacklinksFn) {
      getBacklinks = {
        path: samplePath,
        stats: await bench(() => getBacklinksFn(samplePath)),
      };
    }
    const getLinksFn = backend.getLinks?.bind(backend);
    if (getLinksFn) {
      getLinks = {
        path: samplePath,
        stats: await bench(() => getLinksFn(samplePath)),
      };
    }
  }

  // getPeriodicNote — no side effects (existence check only)
  const getPeriodicNoteFn = backend.getPeriodicNote?.bind(backend);
  const getPeriodicNote = getPeriodicNoteFn ? await bench(() => getPeriodicNoteFn('daily')) : null;

  return { list, listTags, outline, getBacklinks, getLinks, getPeriodicNote };
}

async function resolveReadPaths(
  qs: QuerySet,
  statsPath?: string,
): Promise<{ small: string | null; large: string | null }> {
  if (qs.reads.small && qs.reads.large) return qs.reads;
  if (!statsPath) return qs.reads;
  try {
    const stats = JSON.parse(await readFile(statsPath, 'utf8')) as {
      size?: {
        largestNotes?: Array<{ relPath: string; sizeBytes: number }>;
        medianNote?: { relPath: string; sizeBytes: number } | null;
      };
    };
    const largest = stats.size?.largestNotes ?? [];
    if (largest.length === 0) return qs.reads;
    const large = largest[0]?.relPath ?? null;
    const small = stats.size?.medianNote?.relPath ?? null;
    return {
      small: qs.reads.small ?? small,
      large: qs.reads.large ?? large,
    };
  } catch {
    return qs.reads;
  }
}
