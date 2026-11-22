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

export type ScenarioStrategy =
  | 'context-pack'
  | 'search-read'
  | 'search-batch'
  | 'list-tasks'
  | 'folder-read'
  | 'vault-stats'
  | 'list-fallback';

export interface TaskStep {
  op:
    | 'context_pack'
    | 'search'
    | 'read'
    | 'read_notes'
    | 'get_backlinks'
    | 'list_tasks'
    | 'list'
    | 'vault_stats'
    | 'list_tags';
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
  /** backend.name, or `${name}-multicall` / `${name}-batch` for the forced runs. */
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
  /**
   * Like forceMulticall, but search tasks read their top hits with ONE
   * read_notes call instead of read ×K (SHA-339). Requires backend.readMany.
   */
  forceBatch?: boolean;
}

export async function runScenarios(opts: ScenarioOptions): Promise<ScenarioSummary> {
  const { backend, taskSet, forceBatch = false } = opts;
  const forceMulticall = forceBatch || (opts.forceMulticall ?? false);
  if (forceBatch && !backend.readMany) {
    throw new Error(
      `Backend ${backend.name} has no readMany (read_notes); --strategy batch needs it.`,
    );
  }
  const suffix = forceBatch ? '-batch' : forceMulticall ? '-multicall' : '';
  const label = `${backend.name}${suffix}`;

  const tasks: TaskResult[] = [];
  for (const task of taskSet.tasks) {
    let strategy = pickStrategy(backend, task, forceMulticall);
    if (forceBatch && strategy === 'search-read') strategy = 'search-batch';

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

/** The one-call tool when the backend has it (and the run isn't the ablation), else the fallback. */
function pickStrategy(backend: Backend, task: TaskDef, forceMulticall: boolean): ScenarioStrategy {
  if (task.statsQuery) {
    return !forceMulticall && backend.vaultStats ? 'vault-stats' : 'list-fallback';
  }
  if (task.taskQuery) {
    return !forceMulticall && backend.listTasks ? 'list-tasks' : 'folder-read';
  }
  return !forceMulticall && backend.contextPack ? 'context-pack' : 'search-read';
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

  if (strategy === 'vault-stats') {
    const vaultStatsFn = backend.vaultStats?.bind(backend);
    if (!vaultStatsFn) {
      throw new Error(`Backend ${backend.name} has no vaultStats but strategy is vault-stats.`);
    }
    return [step('vault_stats', '(vault)', await vaultStatsFn())];
  }

  if (strategy === 'list-fallback') {
    // Without vault_stats, the closest an agent gets is the vault listing
    // (seekstone caps it at 500 rows) plus list_tags. It still has no sizes or
    // recency and no total past the cap, so this understates the real cost.
    const steps = [step('list', '(vault)', await backend.list())];
    const listTagsFn = backend.listTags?.bind(backend);
    if (listTagsFn) steps.push(step('list_tags', '(vault)', await listTagsFn()));
    return steps;
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
    if (!listing?.result.some(matches)) {
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
  const readManyFn = backend.readMany?.bind(backend);
  if (strategy === 'search-batch' && readManyFn) {
    // One read_notes call at the server's default budget, as an agent would make it.
    if (hits.length > 0) {
      const paths = hits.map((h) => h.path);
      steps.push(step('read_notes', paths.join(', '), await readManyFn(paths)));
    }
  } else {
    for (const hit of hits) {
      const r = await backend.read(hit.path);
      steps.push(step('read', hit.path, r));
    }
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
