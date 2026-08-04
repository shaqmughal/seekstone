import { summarise } from '@seekstone/core/percentiles';
import { describe, expect, it } from 'vitest';
import type { ScenarioSummary, TaskResult } from './scenarios.js';
import { renderScenarioComparisonMarkdown, renderScenarioMarkdown } from './scenarios-report.js';

function taskResult(overrides: Partial<TaskResult> = {}): TaskResult {
  return {
    id: 'phlogiston-theory',
    question: 'What was the phlogiston theory?',
    strategy: 'context-pack',
    steps: [{ op: 'context_pack', target: 'phlogiston', payloadBytes: 2048, payloadTokens: 500 }],
    calls: 1,
    totalPayloadBytes: 2048,
    totalPayloadTokens: 500,
    payloadStable: true,
    latency: { coldMs: 4.2, warm: summarise([1.1, 1.2, 1.3, 1.4]), runs: 5 },
    ...overrides,
  };
}

function summary(label: string, tasks: TaskResult[]): ScenarioSummary {
  return {
    snapshotDate: '2026-08-04T00:00:00.000Z',
    machine: { platform: 'darwin', arch: 'arm64', node: 'v22.0.0', cpus: 8 },
    backend: { name: label.replace(/-multicall$/, ''), description: `${label} adapter` },
    label,
    runs: 5,
    tasks,
  };
}

describe('renderScenarioMarkdown', () => {
  it('renders totals, calls, strategy and the encoder footnote', () => {
    const md = renderScenarioMarkdown(summary('seekstone', [taskResult()]));
    expect(md).toContain('# Scenarios — seekstone');
    expect(md).toContain('| phlogiston-theory | context-pack | 1 | 2.0 KB | 500 |');
    expect(md).toContain('Tokens (approx)');
    expect(md).toContain('encoder-approximate');
  });

  it('renders a step-breakdown row per call', () => {
    const md = renderScenarioMarkdown(
      summary('fs', [
        taskResult({
          strategy: 'search-read',
          steps: [
            { op: 'search', target: 'phlogiston', payloadBytes: 512, payloadTokens: 100 },
            {
              op: 'read',
              target: 'Encyclopedia/P/Phlogiston.md',
              payloadBytes: 4096,
              payloadTokens: 900,
            },
          ],
          calls: 2,
          totalPayloadBytes: 4608,
          totalPayloadTokens: 1000,
        }),
      ]),
    );
    expect(md).toContain('| 1 | `search` | `phlogiston` |');
    expect(md).toContain('| 2 | `read` | `Encyclopedia/P/Phlogiston.md` |');
  });

  it('calls out tasks whose payload was not byte-stable across runs', () => {
    const md = renderScenarioMarkdown(summary('rest', [taskResult({ payloadStable: false })]));
    expect(md).toContain('Payload not byte-stable across runs');
    expect(md).toContain('`phlogiston-theory`');
  });
});

describe('renderScenarioComparisonMarkdown', () => {
  it('orders columns seekstone, seekstone-multicall, fs — unknowns last', () => {
    const md = renderScenarioComparisonMarkdown([
      summary('zzz-unknown', [taskResult()]),
      summary('fs', [taskResult()]),
      summary('seekstone-multicall', [taskResult()]),
      summary('seekstone', [taskResult()]),
    ]);
    const headerLine = md.split('\n').find((l) => l.startsWith('| Task |')) as string;
    expect(headerLine).toBe('| Task | seekstone | seekstone-multicall | fs | zzz-unknown |');
  });

  it('computes token multipliers against the seekstone baseline', () => {
    const md = renderScenarioComparisonMarkdown([
      summary('seekstone', [taskResult({ totalPayloadTokens: 500 })]),
      summary('fs', [taskResult({ totalPayloadTokens: 5000 })]),
    ]);
    expect(md).toContain('## Context multiplier vs seekstone (tokens)');
    expect(md).toContain('1.0×');
    expect(md).toContain('10.0×');
  });

  it('renders — for tasks a backend has no result for', () => {
    const md = renderScenarioComparisonMarkdown([
      summary('seekstone', [taskResult()]),
      summary('fs', [taskResult({ id: 'other-task' })]),
    ]);
    const row = md.split('\n').find((l) => l.startsWith('| phlogiston-theory |')) as string;
    expect(row).toContain('—');
  });

  it('daggers zero-hit search-read tasks instead of pricing them as a win', () => {
    const zeroHit = taskResult({
      strategy: 'search-read',
      steps: [{ op: 'search', target: 'phlogiston', payloadBytes: 56, payloadTokens: 17 }],
      calls: 1,
      totalPayloadBytes: 56,
      totalPayloadTokens: 17,
    });
    const md = renderScenarioComparisonMarkdown([
      summary('seekstone', [taskResult()]),
      summary('obsidian-tc', [zeroHit]),
    ]);
    expect(md).toContain('17†');
    expect(md).toContain('—†');
    expect(md).toContain('retrieval failure');
    // The single-backend report daggers it too.
    expect(renderScenarioMarkdown(summary('obsidian-tc', [zeroHit]))).toContain(
      'phlogiston-theory†',
    );
  });

  it('marks the multicall column as an ablation in the adapter list', () => {
    const md = renderScenarioComparisonMarkdown([
      summary('seekstone', [taskResult()]),
      summary('seekstone-multicall', [taskResult()]),
    ]);
    expect(md).toContain('ablation: context_pack disabled');
  });

  it('returns a stub for empty input', () => {
    expect(renderScenarioComparisonMarkdown([])).toContain('No data');
  });
});
