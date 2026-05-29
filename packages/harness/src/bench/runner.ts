import { readFile } from 'node:fs/promises';
import type { Backend } from './backend.js';
import type { QuerySet } from './queries.js';
import { type RunStats, type StreamStats, runN, runNStream } from './timer.js';

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
  };
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
