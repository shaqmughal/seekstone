import { describe, expect, it } from 'vitest';
import { renderBenchmarkMarkdown } from './report.js';
import type { BenchmarkSummary } from './runner.js';

const minimalSummary: BenchmarkSummary = {
  snapshotDate: '2026-05-29T00:00:00.000Z',
  machine: { platform: 'darwin', arch: 'arm64', node: 'v22.0.0', cpus: 8 },
  backend: { name: 'test', description: 'Test adapter' },
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
      stats: {
        coldMs: 10.5,
        runs: 5,
        warm: { n: 4, min: 1, median: 2, p90: 3, p95: 4, p99: 5, max: 5, mean: 2.5 },
        all: { n: 5, min: 1, median: 2, p90: 3, p95: 4, p99: 5, max: 5, mean: 2.5 },
        payloadBytesMean: 2048,
        payloadTokensMean: 512,
      },
    },
  ],
  read: {
    small: {
      path: 'notes/small.md',
      stats: {
        coldMs: 1,
        runs: 5,
        warm: { n: 4, min: 0.1, median: 0.2, p90: 0.3, p95: 0.4, p99: 0.5, max: 0.5, mean: 0.2 },
        all: { n: 5, min: 0.1, median: 0.2, p90: 0.3, p95: 0.4, p99: 0.5, max: 0.5, mean: 0.2 },
        payloadBytesMean: 500,
        payloadTokensMean: 125,
      },
    },
    large: null,
  },
  tools: {
    list: null,
    listTags: null,
    outline: null,
    getBacklinks: null,
    getLinks: null,
    getPeriodicNote: null,
  },
};

describe('renderBenchmarkMarkdown', () => {
  it('output starts with "# Benchmark — test"', () => {
    const md = renderBenchmarkMarkdown(minimalSummary);
    expect(md.startsWith('# Benchmark — test')).toBe(true);
  });

  it('contains backend description "Test adapter"', () => {
    const md = renderBenchmarkMarkdown(minimalSummary);
    expect(md).toContain('Test adapter');
  });

  it('contains the query string "hello world"', () => {
    const md = renderBenchmarkMarkdown(minimalSummary);
    expect(md).toContain('hello world');
  });

  it('contains cold ms formatted as "10.50 ms"', () => {
    const md = renderBenchmarkMarkdown(minimalSummary);
    expect(md).toContain('10.50 ms');
  });

  it('contains payload formatted as "2.0 KB"', () => {
    const md = renderBenchmarkMarkdown(minimalSummary);
    expect(md).toContain('2.0 KB');
  });

  it('contains "512" tokens', () => {
    const md = renderBenchmarkMarkdown(minimalSummary);
    expect(md).toContain('512');
  });

  it('contains "3" hit count', () => {
    const md = renderBenchmarkMarkdown(minimalSummary);
    expect(md).toContain('| 3 |');
  });

  it('small read entry is in the output with path "notes/small.md"', () => {
    const md = renderBenchmarkMarkdown(minimalSummary);
    expect(md).toContain('notes/small.md');
  });

  it('large read shows "—" because it is null', () => {
    const md = renderBenchmarkMarkdown(minimalSummary);
    // The large row renders all cells as "—"
    expect(md).toContain('| large | — | — | — | — | — |');
  });

  it('a query with "|" in its text has it escaped as "\\|" in the table', () => {
    const baseSearch = minimalSummary.search[0];
    if (!baseSearch) throw new Error('test setup error');
    const summaryWithPipe: BenchmarkSummary = {
      ...minimalSummary,
      search: [
        {
          ...baseSearch,
          query: 'foo | bar',
        },
      ],
    };
    const md = renderBenchmarkMarkdown(summaryWithPipe);
    expect(md).toContain('foo \\| bar');
    // Raw pipe should NOT appear inside the code span for this query
    // (the escaped form proves the replacement occurred)
    expect(md).not.toContain('`foo | bar`');
  });

  it('formats payload bytes < 1 KB as integer bytes', () => {
    const baseSearch = minimalSummary.search[0];
    if (!baseSearch) throw new Error('test setup error');
    const s: BenchmarkSummary = {
      ...minimalSummary,
      search: [{ ...baseSearch, stats: { ...baseSearch.stats, payloadBytesMean: 512 } }],
    };
    const md = renderBenchmarkMarkdown(s);
    expect(md).toContain('512 B');
  });

  it('formats payload bytes >= 1 MB as MB', () => {
    const baseSearch = minimalSummary.search[0];
    if (!baseSearch) throw new Error('test setup error');
    const s: BenchmarkSummary = {
      ...minimalSummary,
      search: [
        { ...baseSearch, stats: { ...baseSearch.stats, payloadBytesMean: 2 * 1024 * 1024 } },
      ],
    };
    const md = renderBenchmarkMarkdown(s);
    expect(md).toContain('2.00 MB');
  });

  it('renders TTFR columns when ttfr is present', () => {
    const baseSearch = minimalSummary.search[0];
    if (!baseSearch) throw new Error('test setup error');
    const s: BenchmarkSummary = {
      ...minimalSummary,
      search: [
        {
          ...baseSearch,
          ttfr: {
            coldTtfrMs: 5.25,
            warmTtfr: {
              n: 4,
              min: 1,
              median: 2.1,
              p90: 3,
              p95: 4,
              p99: 5,
              max: 5,
              mean: 2.5,
            },
          },
        },
      ],
    };
    const md = renderBenchmarkMarkdown(s);
    expect(md).toContain('5.25 ms');
    expect(md).toContain('2.10 ms');
  });

  it('renders large read row when non-null', () => {
    const s: BenchmarkSummary = {
      ...minimalSummary,
      read: {
        ...minimalSummary.read,
        large: {
          path: 'notes/large.md',
          stats: {
            coldMs: 20,
            runs: 5,
            warm: { n: 4, min: 5, median: 10, p90: 15, p95: 18, p99: 20, max: 20, mean: 10 },
            all: { n: 5, min: 5, median: 10, p90: 15, p95: 18, p99: 20, max: 20, mean: 10 },
            payloadBytesMean: 10240,
            payloadTokensMean: 2560,
          },
        },
      },
    };
    const md = renderBenchmarkMarkdown(s);
    expect(md).toContain('notes/large.md');
    expect(md).toContain('10.0 KB');
  });

  it('renders ## Tools section when at least one tool is non-null', () => {
    const toolStats = {
      coldMs: 3,
      runs: 5,
      warm: { n: 4, min: 1, median: 2, p90: 3, p95: 4, p99: 5, max: 5, mean: 2 },
      all: { n: 5, min: 1, median: 2, p90: 3, p95: 4, p99: 5, max: 5, mean: 2 },
      payloadBytesMean: 1024,
      payloadTokensMean: 256,
    };
    const s: BenchmarkSummary = {
      ...minimalSummary,
      tools: {
        list: toolStats,
        listTags: toolStats,
        outline: { path: 'notes/small.md', stats: toolStats },
        getBacklinks: { path: 'notes/small.md', stats: toolStats },
        getLinks: { path: 'notes/small.md', stats: toolStats },
        getPeriodicNote: toolStats,
      },
    };
    const md = renderBenchmarkMarkdown(s);
    expect(md).toContain('## Tools');
    expect(md).toContain('list_notes');
    expect(md).toContain('list_tags');
    expect(md).toContain('outline_note');
    expect(md).toContain('get_backlinks');
    expect(md).toContain('get_links');
    expect(md).toContain('get_periodic_note');
  });

  it('renders "Not supported by this backend" for null tools when others are present', () => {
    const toolStats = {
      coldMs: 1,
      runs: 5,
      warm: { n: 4, min: 1, median: 1, p90: 1, p95: 1, p99: 1, max: 1, mean: 1 },
      all: { n: 5, min: 1, median: 1, p90: 1, p95: 1, p99: 1, max: 1, mean: 1 },
      payloadBytesMean: 100,
      payloadTokensMean: 25,
    };
    const s: BenchmarkSummary = {
      ...minimalSummary,
      tools: {
        list: toolStats,
        listTags: null,
        outline: null,
        getBacklinks: null,
        getLinks: null,
        getPeriodicNote: null,
      },
    };
    const md = renderBenchmarkMarkdown(s);
    expect(md).toContain('Not supported by this backend');
    expect(md).toContain('list_tags');
    expect(md).toContain('outline_note');
  });

  it('omits ## Tools section when all tools are null', () => {
    const md = renderBenchmarkMarkdown(minimalSummary);
    expect(md).not.toContain('## Tools');
  });
});
