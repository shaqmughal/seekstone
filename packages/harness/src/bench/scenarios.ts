import { cpus } from 'node:os';
import type { Distribution } from '@seekstone/core/percentiles';
import { summarise } from '@seekstone/core/percentiles';
import type { Backend, BackendResponse } from './backend.js';
import type { TaskDef, TaskSet } from './tasks.js';
import { countTokens, timed } from './timer.js';

/**
 * Task-level "tokens per answered question" benchmark (SHA-274).
 *
 * Where runner.ts measures single operations, this simulates the call
 * sequence an agent actually makes to answer a question and sums the payload
 * across it. Backends with context_pack answer in ONE call; everything else
 * pays for search → read ×K → backlinks. The sum is the context tax per task.
 */

export type ScenarioStrategy = 'context-pack' | 'search-read' | 'list-tasks' | 'folder-read';

export interface TaskStep {
  op: 'context_pack' | 'search' | 'read' | 'get_backlinks' | 'list_tasks' | 'list';
  /** Query string (context_pack/search), folder, or vault-relative note path. */
  target: string;
  payloadBytes: number;
  payloadTokens: number;
}

export interface TaskResult {
  id: string;
  question: string;
  strategy: ScenarioStrategy;
  /** Step breakdown captured from run 1 (payload is deterministic per backend). */
  steps: TaskStep[];
  calls: number;
  totalPayloadBytes: number;
  totalPayloadTokens: number;
  /** False when per-run byte totals differed — flags nondeterministic backends. */
  payloadStable: boolean;
  /** Whole-task wall time; cold = run 1, warm = runs 2..N (same split as RunStats). */
  latency: { coldMs: number; warm: Distribution; runs: number };
}

export interface ScenarioSummary {
  snapshotDate: string;
  machine: { platform: string; arch: string; node: string; cpus: number };
  backend: { name: string; description: string };
  /** backend.name, or `${name}-multicall` for the forced-ablation run. */
  label: string;
  runs: number;
  tasks: TaskResult[];
}

export interface ScenarioOptions {
  backend: Backend;
  taskSet: TaskSet;
  /**
   * Force the search-read path even when the backend supports context_pack.
   * The ablation row proves the win comes from context_pack, not the adapter.
   */
  forceMulticall?: boolean;
}

export async function runScenarios(opts: ScenarioOptions): Promise<ScenarioSummary> {
  const { backend, taskSet, forceMulticall = false } = opts;
  const label = forceMulticall ? `${backend.name}-multicall` : backend.name;

  const tasks: TaskResult[] = [];
  for (const task of taskSet.tasks) {
    const strategy: ScenarioStrategy = task.taskQuery
      ? !forceMulticall && backend.listTasks
        ? 'list-tasks'
        : 'folder-read'
      : !forceMulticall && backend.contextPack
        ? 'context-pack'
        : 'search-read';

    const durations: number[] = [];
    const byteTotals: number[] = [];
    let firstSteps: TaskStep[] | null = null;
    for (let i = 0; i < taskSet.runs; i++) {
      const t = await timed(() => executeTask(backend, task, strategy));
      durations.push(t.durationMs);
      byteTotals.push(t.result.reduce((a, s) => a + s.payloadBytes, 0));
      if (firstSteps === null) firstSteps = t.result;
    }

    const steps = firstSteps ?? [];
    tasks.push({
      id: task.id,
      question: task.question,
      strategy,
      steps,
      calls: steps.length,
      totalPayloadBytes: steps.reduce((a, s) => a + s.payloadBytes, 0),
      totalPayloadTokens: steps.reduce((a, s) => a + s.payloadTokens, 0),
      payloadStable: byteTotals.every((b) => b === byteTotals[0]),
      latency: {
        coldMs: durations[0] ?? 0,
        warm: summarise(durations.slice(1)),
        runs: taskSet.runs,
      },
    });
  }

  return {
    snapshotDate: new Date().toISOString(),
    machine: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      cpus: cpus().length,
    },
    backend: { name: backend.name, description: backend.description },
    label,
    runs: taskSet.runs,
    tasks,
  };
}

/**
 * folder-read reads at most this many notes — a month of daily notes, so a
 * month-scoped task-triage question is answered COMPLETELY by both paths and
 * the multiplier compares like for like. The remaining conservatism is the
 * fixture itself: its daily notes are a few hundred bytes, far smaller than
 * real ones, so the read-whole-notes cost is still understated.
 */
const FOLDER_READ_CAP = 31;

/** One pass over a task: the ordered calls an agent would make. */
async function executeTask(
  backend: Backend,
  task: TaskDef,
  strategy: ScenarioStrategy,
): Promise<TaskStep[]> {
  if (strategy === 'list-tasks') {
    const listTasksFn = backend.listTasks?.bind(backend);
    if (!listTasksFn) {
      throw new Error(`Backend ${backend.name} has no listTasks but strategy is list-tasks.`);
    }
    const q = task.taskQuery ?? {};
    const r = await listTasksFn(q);
    return [step('list_tasks', q.folder ?? '(vault)', r)];
  }

  if (strategy === 'folder-read') {
    // Fallback for backends without list_tasks: list the prefix (date-named
    // notes make a folder prefix a date range — what an agent would ask for),
    // read the first K matches, scan client-side. Backends whose list only
    // accepts real directories get the containing folder + a client filter.
    const folder = task.taskQuery?.folder ?? '';
    const steps: TaskStep[] = [];
    const matches = (e: { path: string; isDirectory: boolean }) =>
      !e.isDirectory && e.path.endsWith('.md') && e.path.startsWith(folder);

    let listing: BackendResponse<{ path: string; isDirectory: boolean }[]> | null = null;
    let listedAs = folder || '(vault)';
    try {
      listing = await backend.list(folder);
    } catch {
      listing = null;
    }
    if (!listing || !listing.result.some(matches)) {
      const parent = folder.includes('/') ? folder.slice(0, folder.lastIndexOf('/')) : '';
      listing = await backend.list(parent);
      listedAs = parent || '(vault)';
    }
    steps.push(step('list', listedAs, listing));
    const notePaths = listing.result
      .filter(matches)
      .map((e) => e.path)
      .sort()
      .slice(0, FOLDER_READ_CAP);
    for (const p of notePaths) {
      const r = await backend.read(p);
      steps.push(step('read', p, r));
    }
    return steps;
  }

  const searchQuery = task.searchQuery;
  if (!searchQuery) {
    throw new Error(`Task ${task.id}: searchQuery missing for strategy ${strategy}.`);
  }

  if (strategy === 'context-pack') {
    const contextPackFn = backend.contextPack?.bind(backend);
    if (!contextPackFn) {
      throw new Error(`Backend ${backend.name} has no contextPack but strategy is context-pack.`);
    }
    const r = await contextPackFn(searchQuery, task.budgetBytes);
    return [step('context_pack', searchQuery, r)];
  }

  const steps: TaskStep[] = [];
  const search = await backend.search(searchQuery);
  steps.push(step('search', searchQuery, search));

  const hits = search.result.slice(0, task.readTopK ?? 1);
  for (const hit of hits) {
    const r = await backend.read(hit.path);
    steps.push(step('read', hit.path, r));
  }

  const getBacklinksFn = backend.getBacklinks?.bind(backend);
  const topHit = hits[0];
  if (getBacklinksFn && topHit && task.followBacklinks !== false) {
    const r = await getBacklinksFn(topHit.path);
    steps.push(step('get_backlinks', topHit.path, r));
  }

  return steps;
}

function step(op: TaskStep['op'], target: string, r: BackendResponse<unknown>): TaskStep {
  return {
    op,
    target,
    payloadBytes: r.payloadBytes,
    payloadTokens: countTokens(r.payloadText, r.payloadBytes),
  };
}
