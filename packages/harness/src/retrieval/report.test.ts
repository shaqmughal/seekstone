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
});
