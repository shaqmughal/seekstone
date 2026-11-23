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

  describe('forceBatch (read_notes, SHA-339)', () => {
    function batchBackend(
      seen: Array<[string[], number | undefined]>,
      extra: Partial<Backend> = {},
    ) {
      return multicallBackend({
        contextPack: async () => resp({}),
        readMany: async (paths: string[], budgetBytes?: number) => {
          seen.push([paths, budgetBytes]);
          return resp({ notes: paths.map((path) => ({ path })) });
        },
        ...extra,
      });
    }

    it('reads the top K hits with one read_notes call and relabels the run', async () => {
      const seen: Array<[string[], number | undefined]> = [];
      let singleReads = 0;
      const backend = batchBackend(seen, {
        read: async (path: string) => {
          singleReads += 1;
          return resp(path);
        },
        getBacklinks: async (path: string) => resp({ target: path }),
      });
      const summary = await runScenarios({
        backend,
        taskSet: taskSet([task({ readTopK: 5, followBacklinks: false })], 1),
        forceBatch: true,
      });
      const t = summary.tasks[0];
      expect(summary.label).toBe('fake-batch');
      expect(t?.strategy).toBe('search-batch');
      expect(t?.steps.map((s) => [s.op, s.target])).toEqual([
        ['search', 'alpha'],
        ['read_notes', 'A/alpha.md, B/beta.md, C/gamma.md'],
      ]);
      expect(t?.calls).toBe(2);
      // Clamped to the 3 available hits; the server's default budget applies.
      expect(seen).toEqual([[['A/alpha.md', 'B/beta.md', 'C/gamma.md'], undefined]]);
      expect(singleReads).toBe(0);
    });

    it('still follows backlinks unless the task opts out', async () => {
      const backend = batchBackend([], {
        getBacklinks: async (path: string) => resp({ target: path }),
      });
      const t = (await runScenarios({ backend, taskSet: taskSet([task()], 1), forceBatch: true }))
        .tasks[0];
      expect(t?.steps.map((s) => s.op)).toEqual(['search', 'read_notes', 'get_backlinks']);
    });

    it('makes no read_notes call on zero hits', async () => {
      const seen: Array<[string[], number | undefined]> = [];
      const backend = batchBackend(seen, { search: async () => resp([]) });
      const t = (await runScenarios({ backend, taskSet: taskSet([task()], 1), forceBatch: true }))
        .tasks[0];
      expect(t?.steps.map((s) => s.op)).toEqual(['search']);
      expect(seen).toEqual([]);
    });

    it('sends non-search tasks down the multi-call fallbacks', async () => {
      const backend = batchBackend([], {
        vaultStats: async () => resp({}),
        list: async () => resp([{ path: 'a.md', isDirectory: false }]),
      });
      const statsTask = task({ searchQuery: undefined, readTopK: undefined, statsQuery: {} });
      const t = (
        await runScenarios({ backend, taskSet: taskSet([statsTask], 1), forceBatch: true })
      ).tasks[0];
      expect(t?.strategy).toBe('list-fallback');
    });

    it('fails with a clear message on a backend without readMany', async () => {
      await expect(
        runScenarios({ backend: multicallBackend(), taskSet: taskSet([task()]), forceBatch: true }),
      ).rejects.toThrow(/fake has no readMany \(read_notes\); --strategy batch needs it/);
    });

    it('leaves auto and multicall runs on single reads even when readMany exists', async () => {
      const seen: Array<[string[], number | undefined]> = [];
      const backend = batchBackend(seen);
      const auto = await runScenarios({ backend, taskSet: taskSet([task()], 1) });
      expect(auto.tasks[0]?.strategy).toBe('context-pack');
      const multi = await runScenarios({
        backend,
        taskSet: taskSet([task()], 1),
        forceMulticall: true,
      });
      expect(multi.tasks[0]?.steps.map((s) => s.op)).toEqual(['search', 'read', 'read']);
      expect(seen).toEqual([]);
    });
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

  describe('folder-read (taskQuery on a backend without listTasks)', () => {
    const entries = [
      { path: 'Daily/2026-10', isDirectory: true },
      { path: 'Daily/2026-10-02.md', isDirectory: false },
      { path: 'Daily/2026-10-01.md', isDirectory: false },
      { path: 'Daily/2026-09-30.md', isDirectory: false },
      { path: 'Daily/2026-10-01.txt', isDirectory: false },
    ];
    const folderTask = task({ taskQuery: { folder: 'Daily/2026-10' } });

    it('lists the folder prefix and reads matching notes in path order', async () => {
      const listed: string[] = [];
      const backend = multicallBackend({
        list: async (folder?: string) => {
          listed.push(folder ?? '');
          return resp(entries);
        },
      });
      const summary = await runScenarios({ backend, taskSet: taskSet([folderTask], 1) });
      const t = summary.tasks[0];
      expect(t?.strategy).toBe('folder-read');
      expect(listed).toEqual(['Daily/2026-10']);
      expect(t?.steps.map((s) => [s.op, s.target])).toEqual([
        ['list', 'Daily/2026-10'],
        ['read', 'Daily/2026-10-01.md'],
        ['read', 'Daily/2026-10-02.md'],
      ]);
    });

    it('falls back to the parent folder when listing the prefix throws', async () => {
      const listed: string[] = [];
      const backend = multicallBackend({
        list: async (folder?: string) => {
          listed.push(folder ?? '');
          if (folder === 'Daily/2026-10') throw new Error('not a directory');
          return resp(entries);
        },
      });
      const summary = await runScenarios({ backend, taskSet: taskSet([folderTask], 1) });
      expect(listed).toEqual(['Daily/2026-10', 'Daily']);
      expect(summary.tasks[0]?.steps.map((s) => [s.op, s.target])).toEqual([
        ['list', 'Daily'],
        ['read', 'Daily/2026-10-01.md'],
        ['read', 'Daily/2026-10-02.md'],
      ]);
    });

    it('falls back to the vault root when a top-level prefix lists no matches', async () => {
      const listed: string[] = [];
      const backend = multicallBackend({
        list: async (folder?: string) => {
          listed.push(folder ?? '');
          return resp(folder === '' ? [{ path: 'Inbox.md', isDirectory: false }] : []);
        },
      });
      const summary = await runScenarios({
        backend,
        taskSet: taskSet([task({ taskQuery: { folder: 'Inbox' } })], 1),
      });
      expect(listed).toEqual(['Inbox', '']);
      expect(summary.tasks[0]?.steps.map((s) => [s.op, s.target])).toEqual([
        ['list', '(vault)'],
        ['read', 'Inbox.md'],
      ]);
    });
  });

  describe('statsQuery (SHA-290)', () => {
    const statsTask = task({ searchQuery: undefined, readTopK: undefined, statsQuery: {} });
    const listing = [{ path: 'a.md', isDirectory: false }];

    it('uses one vault_stats call when the backend supports it', async () => {
      const backend = multicallBackend({ vaultStats: async () => resp({ notes: 1 }) });
      const t = (await runScenarios({ backend, taskSet: taskSet([statsTask], 1) })).tasks[0];
      expect(t?.strategy).toBe('vault-stats');
      expect(t?.steps.map((s) => [s.op, s.target])).toEqual([['vault_stats', '(vault)']]);
      expect(t?.totalPayloadBytes).toBe(Buffer.byteLength('{"notes":1}'));
    });

    it('falls back to the vault listing plus list_tags, and only the listing without tags', async () => {
      const listed: Array<string | undefined> = [];
      const withTags = multicallBackend({
        vaultStats: async () => resp({}),
        listTags: async () => resp({ tags: [], total: 0 }),
        list: async (folder?: string) => {
          listed.push(folder);
          return resp(listing);
        },
      });
      const forced = await runScenarios({
        backend: withTags,
        taskSet: taskSet([statsTask], 1),
        forceMulticall: true,
      });
      expect(forced.tasks[0]?.strategy).toBe('list-fallback');
      expect(forced.tasks[0]?.steps.map((s) => s.op)).toEqual(['list', 'list_tags']);
      expect(listed).toEqual([undefined]);

      const bare = await runScenarios({
        backend: multicallBackend({ list: async () => resp(listing) }),
        taskSet: taskSet([statsTask], 1),
      });
      expect(bare.tasks[0]?.steps.map((s) => [s.op, s.target])).toEqual([['list', '(vault)']]);
    });
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
