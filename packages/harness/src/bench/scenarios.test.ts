import { get_encoding } from 'tiktoken';
import { describe, expect, it } from 'vitest';
import type { Backend, BackendResponse, SearchHit } from './backend.js';
import { runScenarios } from './scenarios.js';
import type { TaskDef, TaskSet } from './tasks.js';

const enc = get_encoding('cl100k_base');

function resp<T>(result: T): BackendResponse<T> {
  const text = JSON.stringify(result);
  return { result, payloadBytes: Buffer.byteLength(text, 'utf8'), payloadText: text };
}

const hits: SearchHit[] = [
  { path: 'A/alpha.md', score: 2 },
  { path: 'B/beta.md', score: 1 },
  { path: 'C/gamma.md', score: 0.5 },
];

/** Minimal multi-call backend: search/read/list only, like every competitor. */
function multicallBackend(overrides: Partial<Backend> = {}): Backend {
  return {
    name: 'fake',
    description: 'fake backend for scenario tests',
    search: async () => resp(hits),
    read: async (path: string) => resp(`content of ${path}`),
    write: async () => ({ result: undefined, payloadBytes: 0 }),
    list: async () => resp([]),
    ...overrides,
  };
}

function task(overrides: Partial<TaskDef> = {}): TaskDef {
  return { id: 't1', question: 'What is alpha?', searchQuery: 'alpha', readTopK: 2, ...overrides };
}

function taskSet(tasks: TaskDef[], runs = 2): TaskSet {
  return { tasks, runs };
}

describe('runScenarios', () => {
  it('uses one context_pack call when the backend supports it', async () => {
    const calls: Array<[string, number | undefined]> = [];
    const backend = multicallBackend({
      contextPack: async (query: string, budgetBytes?: number) => {
        calls.push([query, budgetBytes]);
        return resp({ excerpts: ['packed'] });
      },
    });
    const summary = await runScenarios({
      backend,
      taskSet: taskSet([task({ budgetBytes: 4096 })]),
    });
    const t = summary.tasks[0];
    expect(t?.strategy).toBe('context-pack');
    expect(t?.calls).toBe(1);
    expect(t?.steps.map((s) => s.op)).toEqual(['context_pack']);
    expect(t?.steps[0]?.target).toBe('alpha');
    expect(calls[0]).toEqual(['alpha', 4096]);
    expect(summary.label).toBe('fake');
  });

  it('falls back to search → read ×K → get_backlinks without context_pack', async () => {
    const backend = multicallBackend({
      getBacklinks: async (path: string) => resp({ target: path, backlinks: [] }),
    });
    const summary = await runScenarios({ backend, taskSet: taskSet([task()]) });
    const t = summary.tasks[0];
    expect(t?.strategy).toBe('search-read');
    expect(t?.steps.map((s) => s.op)).toEqual(['search', 'read', 'read', 'get_backlinks']);
    expect(t?.steps.map((s) => s.target)).toEqual([
      'alpha',
      'A/alpha.md',
      'B/beta.md',
      'A/alpha.md',
    ]);
    expect(t?.calls).toBe(4);
  });

  it('sums payload bytes and tiktoken tokens across all steps', async () => {
    const backend = multicallBackend();
    const summary = await runScenarios({ backend, taskSet: taskSet([task()]) });
    const t = summary.tasks[0];
    const expectedBytes = [
      JSON.stringify(hits),
      JSON.stringify('content of A/alpha.md'),
      JSON.stringify('content of B/beta.md'),
    ].reduce((a, s) => a + Buffer.byteLength(s, 'utf8'), 0);
    const expectedTokens = [
      JSON.stringify(hits),
      JSON.stringify('content of A/alpha.md'),
      JSON.stringify('content of B/beta.md'),
    ].reduce((a, s) => a + enc.encode(s).length, 0);
    expect(t?.totalPayloadBytes).toBe(expectedBytes);
    expect(t?.totalPayloadTokens).toBe(expectedTokens);
  });

  it('clamps reads to the available hits when fewer than readTopK', async () => {
    const backend = multicallBackend({ search: async () => resp(hits.slice(0, 1)) });
    const summary = await runScenarios({ backend, taskSet: taskSet([task({ readTopK: 5 })]) });
    expect(summary.tasks[0]?.steps.map((s) => s.op)).toEqual(['search', 'read']);
  });

  it('records only the search step on zero hits (no reads, no backlinks)', async () => {
    const backend = multicallBackend({
      search: async () => resp([]),
      getBacklinks: async (path: string) => resp({ target: path }),
    });
    const summary = await runScenarios({ backend, taskSet: taskSet([task()]) });
    expect(summary.tasks[0]?.steps.map((s) => s.op)).toEqual(['search']);
  });

  it('skips get_backlinks when the task sets followBacklinks: false', async () => {
    const backend = multicallBackend({
      getBacklinks: async (path: string) => resp({ target: path }),
    });
    const summary = await runScenarios({
      backend,
      taskSet: taskSet([task({ followBacklinks: false })]),
    });
    expect(summary.tasks[0]?.steps.map((s) => s.op)).toEqual(['search', 'read', 'read']);
  });

  it('falls back to bytes÷4 tokens for steps without payloadText', async () => {
    const backend = multicallBackend({
      search: async () => ({ result: hits.slice(0, 1), payloadBytes: 100 }),
      read: async () => ({ result: 'binary-ish', payloadBytes: 401 }),
    });
    const summary = await runScenarios({ backend, taskSet: taskSet([task()]) });
    const t = summary.tasks[0];
    expect(t?.steps[0]?.payloadTokens).toBe(25);
    expect(t?.steps[1]?.payloadTokens).toBe(101);
  });

  it('forceMulticall pushes a context_pack backend down the search-read path and relabels it', async () => {
    let packCalls = 0;
    const backend = multicallBackend({
      contextPack: async () => {
        packCalls += 1;
        return resp({});
      },
    });
    const summary = await runScenarios({
      backend,
      taskSet: taskSet([task()]),
      forceMulticall: true,
    });
    expect(summary.label).toBe('fake-multicall');
    expect(summary.tasks[0]?.strategy).toBe('search-read');
    expect(packCalls).toBe(0);
  });

  it('flags payloadStable=false when byte totals differ across runs', async () => {
    let call = 0;
    const backend = multicallBackend({
      search: async () => {
        call += 1;
        return { result: [], payloadBytes: call * 100 };
      },
    });
    const summary = await runScenarios({ backend, taskSet: taskSet([task()], 3) });
    expect(summary.tasks[0]?.payloadStable).toBe(false);
  });

  it('reports cold/warm latency with the RunStats split (cold = run 1)', async () => {
    const backend = multicallBackend();
    const summary = await runScenarios({ backend, taskSet: taskSet([task()], 4) });
    const t = summary.tasks[0];
    expect(t?.latency.runs).toBe(4);
    expect(t?.latency.coldMs).toBeGreaterThanOrEqual(0);
    expect(t?.latency.warm.n).toBe(3);
  });
});
