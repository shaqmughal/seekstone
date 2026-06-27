import { describe, expect, it } from 'vitest';
import { renderComparisonMarkdown } from './compare.js';
import type { BenchmarkSummary } from './runner.js';
import type { RunStats } from './timer.js';

function stats(payloadBytesMean: number, coldMs = 5): RunStats {
  const dist = { n: 4, min: 1, median: 2, p90: 3, p95: 4, p99: 5, max: 5, mean: 2.5 };
  return {
    coldMs,
    runs: 5,
    warm: dist,
    all: dist,
    payloadBytesMean,
    payloadTokensMean: Math.round(payloadBytesMean / 4),
  };
}

function summary(
  name: string,
  description: string,
  overrides: Partial<BenchmarkSummary> = {},
): BenchmarkSummary {
  return {
    snapshotDate: '2026-06-27T00:00:00.000Z',
    machine: { platform: 'darwin', arch: 'arm64', node: 'v22.0.0', cpus: 8 },
    backend: { name, description },
    runs: 5,
    rssBefore: 100 * 1024 * 1024,
    rssPeak: 150 * 1024 * 1024,
    search: [
      {
        id: 'q1',
        kind: 'single',
        query: 'hello world',
        firstRunHitCount: 3,
        ttfr: null,
        stats: stats(2048),
      },
    ],
    read: {
      small: { path: 'notes/small.md', stats: stats(500) },
      large: { path: 'notes/large.md', stats: stats(3 * 1024 * 1024) },
    },
    tools: {
      list: stats(800),
      listTags: stats(400),
      outline: null,
      getBacklinks: null,
      getLinks: null,
      getPeriodicNote: null,
    },
    ...overrides,
  };
}

describe('renderComparisonMarkdown', () => {
  it('renders a placeholder when there is no data', () => {
    expect(renderComparisonMarkdown([])).toBe('# Benchmark Comparison\n\nNo data.\n');
  });

  it('renders the header, query, and adapter description for a single summary', () => {
    const md = renderComparisonMarkdown([summary('fs', 'Filesystem-direct')]);
    expect(md).toContain('# Obsidian MCP Server Benchmark Comparison');
    expect(md).toContain('hello world');
    expect(md).toContain('Filesystem-direct');
    // formatBytes hits the KB and MB branches
    expect(md).toContain('2.0 KB');
    expect(md).toContain('3.00 MB');
  });

  it('computes a payload-size multiplier table against the fs baseline', () => {
    const fs = summary('fs', 'Filesystem-direct');
    // rest returns 4× the search payload and 8× the small-read payload of fs
    const rest = summary('rest', 'REST proxy', {
      backend: { name: 'rest', description: 'REST proxy' },
      search: [
        {
          id: 'q1',
          kind: 'single',
          query: 'hello world',
          firstRunHitCount: 3,
          ttfr: null,
          stats: stats(8192),
        },
      ],
      read: {
        small: { path: 'notes/small.md', stats: stats(4000) },
        large: null,
      },
    });

    const md = renderComparisonMarkdown([fs, rest]);
    expect(md).toContain('## Payload size multiplier vs seekstone (fs)');
    expect(md).toContain('Baseline: **fs**');
    expect(md).toContain('4.0×'); // search payload multiplier
    // rest has no large read → an em-dash cell appears
    expect(md).toContain('—');
  });

  it('renders the tool support matrix and shared-tool latency for tools all adapters share', () => {
    const fs = summary('fs', 'Filesystem-direct', {
      tools: {
        list: stats(800),
        listTags: stats(400),
        outline: { path: 'notes/o.md', stats: stats(600) },
        getBacklinks: null,
        getLinks: null,
        getPeriodicNote: null,
      },
    });
    const rest = summary('rest', 'REST proxy', {
      backend: { name: 'rest', description: 'REST proxy' },
    });

    const md = renderComparisonMarkdown([fs, rest]);
    expect(md).toContain('## Tool support matrix');
    // list + listTags are non-null on both → shared latency table present
    expect(md).toContain('### Tool latency comparison (ms)');
    expect(md).toContain('`list_notes`');
    expect(md).toContain('`list_tags`');
    // outline supported on fs only → both ✅ and ❌ appear in the matrix
    expect(md).toContain('✅');
    expect(md).toContain('❌');
  });

  it('falls back to the query id when a query is missing from the first summary', () => {
    const a = summary('fs', 'Filesystem-direct');
    const b = summary('rest', 'REST proxy', {
      backend: { name: 'rest', description: 'REST proxy' },
      search: [
        {
          id: 'q2',
          kind: 'single',
          query: 'only-in-b',
          firstRunHitCount: 1,
          ttfr: null,
          stats: stats(100),
        },
      ],
    });
    const md = renderComparisonMarkdown([a, b]);
    // q2 is absent from the FIRST summary, so the label falls back to the id
    // (`?? id`) and a's payload cell shows an em-dash.
    expect(md).toContain('`q2`');
    expect(md).toContain('—');
  });
});
