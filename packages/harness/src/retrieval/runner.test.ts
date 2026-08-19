import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { Embedder } from '@seekstone/core/embed';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { GoldenSet } from './golden.js';
import {
  type ConditionResult,
  computeGate,
  type RetrievalSummary,
  runRetrievalEval,
} from './runner.js';

/**
 * Deterministic keyword embedder: axis 0 = wind, axis 1 = dairy, axis 2 =
 * everything else. Good enough to make semantic ranking predictable.
 */
function stubEmbedder(id: string): Embedder {
  return {
    id,
    dim: 3,
    embed(text: string): Float32Array {
      const t = text.toLowerCase();
      if (/\b(wind|air|breeze|mill)\b/.test(t)) return new Float32Array([1, 0, 0]);
      if (/\b(milk|dairy|cheese|curd)\b/.test(t)) return new Float32Array([0, 1, 0]);
      return new Float32Array([0, 0, 1]);
    },
  };
}

const GOLDEN: GoldenSet = {
  queries: [
    {
      id: 'sem-windmill',
      kind: 'semantic',
      query: 'machine driven by moving air',
      expected: ['Notes/Windmill.md'],
    },
    {
      id: 'lex-cheese',
      kind: 'lexical',
      query: 'cheese',
      expected: ['Notes/Cheese.md'],
    },
    {
      id: 'top-dairy',
      kind: 'topical',
      query: 'dairy products from milk',
      expected: ['Notes/Cheese.md', 'Notes/Butter.md'],
    },
  ],
};

describe('runRetrievalEval', () => {
  let vault: string;
  let summary: RetrievalSummary;

  beforeAll(async () => {
    vault = await mkdtemp(join(tmpdir(), 'seekstone-retrieval-'));
    await mkdir(join(vault, 'Notes'), { recursive: true });
    await writeFile(
      join(vault, 'Notes', 'Windmill.md'),
      '# Windmill\n\nA mill worked by the wind, its sails turning in the breeze.\n',
    );
    await writeFile(
      join(vault, 'Notes', 'Cheese.md'),
      '# Cheese\n\nCheese is a preparation of milk curd, a staple dairy food.\n',
    );
    await writeFile(
      join(vault, 'Notes', 'Butter.md'),
      '# Butter\n\nButter is the fatty portion of milk, a dairy product.\n',
    );
    await writeFile(
      join(vault, 'Notes', 'Distractor.md'),
      '# Distractor\n\nAn essay on the history of medieval heraldry and shields.\n',
    );
    summary = await runRetrievalEval({
      vaultRoot: vault,
      goldenSet: GOLDEN,
      modelsDir: '/nonexistent',
      modelIds: ['stub-small'],
      runs: 2,
      loadEmbedder: async (dir) => stubEmbedder(basename(dir)),
    });
  });
  afterAll(async () => {
    await rm(vault, { recursive: true, force: true });
  });

  it('produces one lexical condition plus semantic and hybrid per model', () => {
    expect(summary.conditions.map((c) => c.condition)).toEqual([
      'lexical',
      'semantic:stub-small',
      'hybrid-rrf:stub-small',
    ]);
  });

  it('semantic ranking finds the description-style query lexical cannot', () => {
    const perQuery = summary.perQuery.find((p) => p.id === 'sem-windmill');
    expect(perQuery?.conditions['semantic:stub-small']?.hit5).toBe(true);
    expect(perQuery?.conditions['semantic:stub-small']?.top10[0]).toBe('Notes/Windmill.md');
    // Hybrid inherits the semantic win.
    expect(perQuery?.conditions['hybrid-rrf:stub-small']?.hit5).toBe(true);
  });

  it('lexical ranking wins its exact-term control', () => {
    const perQuery = summary.perQuery.find((p) => p.id === 'lex-cheese');
    expect(perQuery?.conditions.lexical?.hit5).toBe(true);
    expect(perQuery?.conditions.lexical?.top10[0]).toBe('Notes/Cheese.md');
  });

  it('aggregates metrics per subset with correct n', () => {
    const semantic = summary.conditions.find((c) => c.condition === 'semantic:stub-small');
    expect(semantic?.metrics.overall.n).toBe(3);
    expect(semantic?.metrics.semantic.n).toBe(1);
    expect(semantic?.metrics.semantic.hit5).toBe(100);
    expect(semantic?.metrics.semantic.mrr10).toBe(1);
  });

  it('records latency distributions and model info', () => {
    for (const c of summary.conditions) {
      // runs=2 → 1 warm sample per query × 3 queries.
      expect(c.latency.warm.n).toBe(3);
    }
    expect(summary.models).toHaveLength(1);
    expect(summary.models[0]?.dim).toBe(3);
    expect(summary.models[0]?.chunkCount).toBeGreaterThanOrEqual(4);
    expect(summary.noteCount).toBe(4);
  });

  it('computes a gate verdict for the model', () => {
    expect(summary.gate.perModel).toHaveLength(1);
    expect(['ship', 'discuss', 'no-ship']).toContain(summary.gate.verdict);
  });
});

describe('computeGate', () => {
  const metrics = (hit5: number) => ({ hit5, mrr10: 0.5, n: 10 });
  const dist = (p95: number) => ({
    n: 10,
    min: 0,
    median: p95 / 2,
    p90: p95,
    p95,
    p99: p95,
    max: p95,
    mean: p95 / 2,
  });
  const condition = (
    name: string,
    semanticHit5: number,
    lexicalHit5: number,
    p95: number,
  ): ConditionResult => ({
    condition: name,
    metrics: {
      overall: metrics(50),
      semantic: metrics(semanticHit5),
      lexical: metrics(lexicalHit5),
      topical: metrics(50),
    },
    latency: { warm: dist(p95) },
  });

  it('ships when all three clauses pass, choosing the smallest passing model', () => {
    const gate = computeGate(
      ['small', 'large'],
      [
        condition('lexical', 40, 100, 1),
        condition('semantic:small', 60, 20, 3),
        condition('hybrid-rrf:small', 55, 99, 4),
        condition('semantic:large', 70, 25, 8),
        condition('hybrid-rrf:large', 65, 100, 9),
      ],
    );
    expect(gate.verdict).toBe('ship');
    expect(gate.chosenModel).toBe('small');
    expect(gate.perModel[0]?.semanticDeltaHit5).toBe(15);
  });

  it('lands in the discuss zone between +5 and +10 points', () => {
    const gate = computeGate(
      ['m'],
      [
        condition('lexical', 40, 100, 1),
        condition('semantic:m', 50, 20, 3),
        condition('hybrid-rrf:m', 47, 100, 4),
      ],
    );
    expect(gate.verdict).toBe('discuss');
    expect(gate.chosenModel).toBeNull();
  });

  it('fails on lexical regression beyond 2 points even with a big semantic win', () => {
    const gate = computeGate(
      ['m'],
      [
        condition('lexical', 40, 100, 1),
        condition('semantic:m', 80, 20, 3),
        condition('hybrid-rrf:m', 80, 90, 4),
      ],
    );
    expect(gate.verdict).toBe('no-ship');
  });

  it('fails on semantic warm p95 over 15 ms', () => {
    const gate = computeGate(
      ['m'],
      [
        condition('lexical', 40, 100, 1),
        condition('semantic:m', 80, 20, 40),
        condition('hybrid-rrf:m', 80, 100, 45),
      ],
    );
    expect(gate.verdict).toBe('no-ship');
    expect(gate.perModel[0]?.reasons.join(' ')).toMatch(/p95 40.00 ms .*FAIL/);
  });
});
