import { describe, expect, it } from 'vitest';
import { renderRetrievalMarkdown } from './report.js';
import type { RetrievalSummary } from './runner.js';

const dist = { n: 3, min: 1, median: 2, p90: 3, p95: 3, p99: 3, max: 3, mean: 2 };
const metrics = { hit5: 80, mrr10: 0.7, n: 10 };

const summary: RetrievalSummary = {
  snapshotDate: '2026-08-19T00:00:00.000Z',
  machine: { platform: 'darwin', arch: 'arm64', node: 'v25.0.0', cpus: 8 },
  vaultRoot: '<home>/vault',
  noteCount: 10000,
  querySet: { total: 50, semantic: 30, lexical: 10, topical: 10 },
  runs: 20,
  lexicalBuildMs: 1234.5,
  models: [
    { modelId: 'potion-base-8M', dim: 256, chunkCount: 20000, indexBuildMs: 9000, loadMs: 100 },
  ],
  conditions: [
    {
      condition: 'lexical',
      metrics: { overall: metrics, semantic: metrics, lexical: metrics, topical: metrics },
      latency: { warm: dist },
    },
    {
      condition: 'hybrid-rrf:potion-base-8M',
      metrics: { overall: metrics, semantic: metrics, lexical: metrics, topical: metrics },
      latency: { warm: dist },
    },
  ],
  perQuery: [
    {
      id: 'sem-miss',
      kind: 'semantic',
      query: 'a query the hybrid missed',
      expected: ['Notes/Target.md'],
      conditions: {
        lexical: { hit5: false, rr10: 0, top10: ['Notes/A.md'] },
        'hybrid-rrf:potion-base-8M': { hit5: false, rr10: 0, top10: ['Notes/A.md', 'Notes/B.md'] },
      },
    },
    {
      id: 'sem-hit',
      kind: 'semantic',
      query: 'a query the hybrid found',
      expected: ['Notes/Found.md'],
      conditions: {
        lexical: { hit5: true, rr10: 1, top10: ['Notes/Found.md'] },
        'hybrid-rrf:potion-base-8M': { hit5: true, rr10: 1, top10: ['Notes/Found.md'] },
      },
    },
  ],
  gate: {
    perModel: [
      {
        model: 'potion-base-8M',
        semanticDeltaHit5: 12,
        lexicalDeltaHit5: 0,
        semanticWarmP95Ms: 3,
        verdict: 'ship',
        reasons: ['semantic subset hit@5 +12.0 pts (gate ≥ +10): PASS'],
      },
    ],
    verdict: 'ship',
    chosenModel: 'potion-base-8M',
  },
};

describe('renderRetrievalMarkdown', () => {
  const md = renderRetrievalMarkdown(summary);

  it('includes the pre-registered gate text and verdict', () => {
    expect(md).toContain('Pre-registered gate');
    expect(md).toContain('≥10 points hit@5');
    expect(md).toContain('**Overall: SHIP** — chosen model: potion-base-8M');
  });

  it('renders metrics rows per condition and subset', () => {
    expect(md).toContain('| lexical | overall | 80.0% | 0.700 | 10 |');
    expect(md).toContain('| hybrid-rrf:potion-base-8M | topical | 80.0% | 0.700 | 10 |');
  });

  it('renders warm latency percentiles', () => {
    expect(md).toContain('| lexical | 2.00 ms | 3.00 ms | 3.00 ms | 3.00 ms |');
  });

  it('lists only queries the hybrid missed in the appendix', () => {
    expect(md).toContain('**sem-miss**');
    expect(md).not.toContain('**sem-hit**');
    expect(md).toContain('hybrid-rrf:potion-base-8M top 5: Notes/A.md, Notes/B.md');
  });

  it('omits the competitor section when no competitors ran', () => {
    expect(md).not.toContain('Competitor setup cost');
  });

  it('omits the split section and summary line for a pre-split summary', () => {
    expect(md).not.toContain('Retrieval quality by split');
    expect(md).not.toContain('**Splits:**');
    expect(md).not.toContain('split only]');
  });

  it('labels in-process conditions in the payload column', () => {
    expect(md).toContain('| lexical | 2.00 ms | 3.00 ms | 3.00 ms | 3.00 ms | in-process |');
  });
});

describe('renderRetrievalMarkdown with competitors (SHA-308)', () => {
  const setupBase = {
    version: '1.0.0',
    provider: 'ollama/stub-embed (loopback HTTP)',
    indexMs: 1_590_000,
    indexStats: '{"chunks_upserted": 65263}',
  };
  const competitorSummary: RetrievalSummary = {
    ...summary,
    conditions: [
      ...summary.conditions,
      {
        condition: 'competitor:stub-tc',
        metrics: { overall: metrics, semantic: metrics, lexical: metrics, topical: metrics },
        latency: { warm: dist },
        payloadBytesMean: 15_770,
      },
      {
        condition: 'competitor:stub-tc-graph',
        metrics: { overall: metrics, semantic: metrics, lexical: metrics, topical: metrics },
        latency: { warm: dist },
        payloadBytesMean: 850,
      },
    ],
    competitorSetups: [
      { ...setupBase, name: 'competitor:stub-tc', notes: ['semantic kNN'] },
      { ...setupBase, name: 'competitor:stub-tc-graph', notes: ['GraphRAG mode'] },
      {
        name: 'competitor:stub-broken',
        version: '9.9.9',
        provider: 'ollama/stub-embed (loopback HTTP)',
        indexMs: 893_000,
        indexStats: 'Invalid string length',
        failed: true,
        notes: ['setup did not complete'],
      },
    ],
  };
  const md = renderRetrievalMarkdown(competitorSummary);

  it('renders the setup-cost table, deduping conditions that share one index', () => {
    expect(md).toContain('## Competitor setup cost (SHA-308)');
    // stub-tc and stub-tc-graph share version|indexMs → one row.
    expect(md).toContain('| stub-tc | 1.0.0 | ollama/stub-embed (loopback HTTP) | 1590.0 s |');
    expect(md).not.toContain('| stub-tc-graph |');
  });

  it('renders failed setups as FAILED with elapsed seconds', () => {
    expect(md).toContain('**FAILED** after 893 s');
  });

  it('renders per-setup notes and raw index stats', () => {
    expect(md).toContain('**competitor:stub-tc** — semantic kNN');
    expect(md).toContain('{"chunks_upserted": 65263}');
    expect(md).toContain('Invalid string length');
  });

  it('formats payload means in KB above 1 KiB and bytes below', () => {
    expect(md).toContain('15.4 KB |');
    expect(md).toContain('850 B |');
  });
});

describe('renderRetrievalMarkdown with splits (SHA-312)', () => {
  const devMetrics = { hit5: 90, mrr10: 0.8, n: 6 };
  const holdMetrics = { hit5: 75, mrr10: 0.6, n: 4 };
  const subset = (m: typeof metrics) => ({ overall: m, semantic: m, lexical: m, topical: m });
  const splitSummary: RetrievalSummary = {
    ...summary,
    querySet: {
      total: 10,
      semantic: 6,
      lexical: 2,
      topical: 2,
      split: 'all',
      splits: {
        dev: { total: 6, semantic: 4, lexical: 1, topical: 1 },
        holdout: { total: 4, semantic: 2, lexical: 1, topical: 1 },
      },
    },
    conditions: summary.conditions.map((c) => ({
      ...c,
      splits: { dev: subset(devMetrics), holdout: subset(holdMetrics) },
    })),
  };

  it('summarizes the split counts in the header', () => {
    const md = renderRetrievalMarkdown(splitSummary);
    expect(md).toContain(
      '- **Splits:** dev 6 (4/1/1), holdout 4 (2/1/1) — tuning reads dev only; gate v2 reports on holdout',
    );
  });

  it('renders the per-split quality table', () => {
    const md = renderRetrievalMarkdown(splitSummary);
    expect(md).toContain('## Retrieval quality by split (SHA-312)');
    expect(md).toContain('| lexical | dev | overall | 90.0% | 0.800 | 6 |');
    expect(md).toContain('| hybrid-rrf:potion-base-8M | holdout | topical | 75.0% | 0.600 | 4 |');
  });

  it('marks a split-restricted run in the query-set line', () => {
    const md = renderRetrievalMarkdown({
      ...splitSummary,
      querySet: { ...splitSummary.querySet, split: 'holdout' },
    });
    expect(md).toContain('[holdout split only]');
  });
});

describe('renderRetrievalMarkdown gate v2 (SHA-316)', () => {
  it('renders the pre-registered text, per-clause reasons, and verdict when present', () => {
    const md = renderRetrievalMarkdown({
      ...summary,
      gateV2: {
        shippedCondition: 'shipped-hybrid:potion-retrieval-32M',
        competitorCondition: 'competitor:obsidian-tc-graph',
        clauses: [
          {
            clause: 'holdout-beats-tc-graph',
            pass: true,
            reason:
              'holdout overall hit@5 88.0% vs competitor:obsidian-tc-graph 85.0% (n=60; gate: strictly greater): PASS',
          },
          {
            clause: 'shipped-warm-p95',
            pass: false,
            reason: 'shipped warm p95 31.00 ms @ 10k notes (gate <= 30 ms): FAIL',
          },
        ],
        verdict: 'fail',
      },
    });
    expect(md).toContain('## Gate v2 verdict (SHA-316)');
    expect(md).toContain(
      'Judged condition: `shipped-hybrid:potion-retrieval-32M` vs `competitor:obsidian-tc-graph`.',
    );
    expect(md).toContain(
      '- holdout overall hit@5 88.0% vs competitor:obsidian-tc-graph 85.0% (n=60; gate: strictly greater): PASS',
    );
    expect(md).toContain('**Gate v2: FAIL**');
  });

  it('omits the section entirely when the run is not the matrix', () => {
    expect(renderRetrievalMarkdown(summary)).not.toContain('Gate v2 verdict');
  });
});
