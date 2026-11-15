import { describe, expect, it } from 'vitest';
import { compareBench, confirmed, measurements, renderRegressions } from './bench-compare.mjs';

const warm = (median: number, p95: number) => ({ median, p95 });

function report(searchMs: number, readMs = 0.07, listMs = 0.04) {
  return {
    search: [{ id: 'phrase', stats: { warm: warm(searchMs, searchMs * 1.2) } }],
    read: { small: { stats: { warm: warm(readMs, readMs * 1.3) } } },
    tools: { list: { warm: warm(listMs, listMs * 1.5) } },
  };
}

describe('weekly bench comparison', () => {
  it('collects search, read and tool measurements', () => {
    expect([...measurements(report(1)).keys()]).toEqual([
      'search/phrase',
      'read/small',
      'tools/list',
    ]);
  });

  it('reports nothing when timings hold', () => {
    expect(compareBench(report(16.8), report(17.2))).toEqual([]);
  });

  it('flags a real slowdown on median and p95', () => {
    const r = compareBench(report(16.8), report(22));
    expect(r.map((x) => `${x.key}:${x.metric}`)).toEqual([
      'search/phrase:median',
      'search/phrase:p95',
    ]);
    expect(r[0]?.pct).toBeCloseTo(0.31, 2);
  });

  it('ignores sub-millisecond jitter even when the percentage is large', () => {
    // 0.07 → 0.12 ms is +71%, but only 0.05 ms: below the 0.2 ms floor.
    expect(compareBench(report(16.8, 0.07), report(16.8, 0.12))).toEqual([]);
  });

  it('reads every tool-entry shape the harness writes, and skips unsupported tools', () => {
    const r = {
      tools: {
        list: { warm: warm(0.04, 0.06) }, // timings on the entry
        getBacklinks: { path: 'a.md', stats: { warm: warm(0.3, 0.5) } }, // under stats
        getPeriodicNote: null, // backend lacks the tool
      },
    };
    expect([...measurements(r).keys()]).toEqual(['tools/list', 'tools/getBacklinks']);
    const slower = structuredClone(r);
    slower.tools.getBacklinks.stats.warm = warm(0.9, 1.5);
    expect(compareBench(r, slower).map((x) => x.key)).toEqual([
      'tools/getBacklinks',
      'tools/getBacklinks',
    ]);
  });

  it('skips measurements that exist on only one side', () => {
    const prev = { search: [] };
    expect(compareBench(prev, report(50))).toEqual([]);
  });

  it('keeps only regressions a re-run reproduces', () => {
    const first = compareBench(report(10), report(14));
    const second = compareBench(report(10), report(10.2));
    expect(confirmed(first, second)).toEqual([]);
    expect(confirmed(first, first)).toEqual(first);
  });

  it('renders a markdown table', () => {
    const md = renderRegressions(compareBench(report(16.8), report(22)));
    expect(md).toContain('| `search/phrase` | median | 16.800 | 22.000 | +31.0% |');
  });
});
