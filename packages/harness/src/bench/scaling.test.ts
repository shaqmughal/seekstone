import { describe, expect, it } from 'vitest';
import type { BenchmarkSummary } from './runner.js';
import { renderScalingMarkdown } from './scaling.js';

/** Minimal BenchmarkSummary builder — only the fields the renderer reads. */
function summary(
  name: string,
  opts: { searchMs: number; searchBytes: number; largeBytes: number },
): BenchmarkSummary {
  const stats = (ms: number, bytes: number) =>
    ({ coldMs: ms, payloadBytesMean: bytes, warm: { median: ms } }) as never;
  return {
    backend: { name, description: `${name} adapter` },
    machine: { platform: 'darwin', arch: 'arm64', node: 'v20', cpus: 8 },
    snapshotDate: '2026-06-26T00:00:00.000Z',
    runs: 20,
    search: [
      { id: 'single', query: 'church', stats: stats(opts.searchMs, opts.searchBytes) },
      { id: 'rare', query: 'phlogiston', stats: stats(opts.searchMs, opts.searchBytes) },
    ],
    read: {
      small: { path: 'Small.md', stats: stats(1, 2000) },
      large: { path: 'Large.md', stats: stats(2, opts.largeBytes) },
    },
  } as unknown as BenchmarkSummary;
}

describe('renderScalingMarkdown', () => {
  const groups = [
    {
      size: 1000,
      summaries: [
        summary('seekstone', { searchMs: 1, searchBytes: 2700, largeBytes: 400_000 }),
        summary('mcpvault', { searchMs: 100, searchBytes: 2500, largeBytes: 400_000 }),
      ],
    },
    {
      size: 10000,
      summaries: [
        summary('seekstone', { searchMs: 1, searchBytes: 2700, largeBytes: 800_000 }),
        summary('mcpvault', { searchMs: 900, searchBytes: 2500, largeBytes: 800_000 }),
      ],
    },
  ];

  const md = renderScalingMarkdown(groups);

  it('pivots adapters × sizes with a scaling-factor column', () => {
    expect(md).toContain('| Adapter | 1k | 10k | scaling 1k→10k |');
    // seekstone stays flat (1.0×), mcpvault grows (9.0×).
    expect(md).toMatch(/\*\*seekstone\*\* \| 1\.0 \| 1\.0 \| 1\.0×/);
    expect(md).toMatch(/\*\*mcpvault\*\* \| 100\.0 \| 900\.0 \| 9\.0×/);
  });

  it('computes the vs-seekstone multiplier at the largest size', () => {
    expect(md).toContain('Search latency vs seekstone at 10k notes');
    expect(md).toMatch(/\*\*mcpvault\*\* \| 900\.0 \| 900×/);
  });

  it('orders filesystem-direct adapters first', () => {
    expect(md.indexOf('**seekstone**')).toBeLessThan(md.indexOf('**mcpvault**'));
  });

  it('notes uncaptured adapters in a coverage section', () => {
    const partial = [
      {
        size: 1000,
        summaries: [summary('seekstone', { searchMs: 1, searchBytes: 2700, largeBytes: 1 })],
      },
      {
        size: 10000,
        summaries: [
          summary('seekstone', { searchMs: 1, searchBytes: 2700, largeBytes: 1 }),
          summary('rest', { searchMs: 50, searchBytes: 500_000, largeBytes: 1 }),
        ],
      },
    ];
    const out = renderScalingMarkdown(partial);
    expect(out).toContain('## Partial coverage');
    expect(out).toContain('`rest@1k`');
    // Headless competitors with no data at all are listed with a reason.
    expect(out).toContain('## Not yet captured');
    expect(out).toContain('**obsidian-mcp-pro**');
  });
});
