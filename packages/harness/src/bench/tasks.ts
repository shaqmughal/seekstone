import { readFile } from 'node:fs/promises';

/**
 * A task = one question an agent must gather context to answer. The scenario
 * runner (scenarios.ts) picks the cheapest call sequence the backend supports:
 * a single context_pack call, or search → read ×K → backlinks for backends
 * without it. The task file is a methodology artifact like default.json —
 * committed, edited per-vault, and re-run against the same set so results
 * stay comparable across snapshots and adapters.
 */
export interface TaskDef {
  id: string;
  /** The human question — documentation and report label. */
  question: string;
  /** What an agent would feed to search / context_pack. */
  searchQuery: string;
  /** How many top hits the multi-call path reads in full. */
  readTopK: number;
  /** context_pack byte budget; the adapter default (2048) applies when omitted. */
  budgetBytes?: number;
  /** Follow up with get_backlinks on the top hit (multi-call path). Default true. */
  followBacklinks?: boolean;
  notes?: string;
}

export interface TaskSet {
  tasks: TaskDef[];
  runs: number;
}

/**
 * Adapters cap search results (seekstone limit 10, fs slices to 10), so a
 * readTopK beyond that would silently measure fewer reads than declared.
 */
const MAX_READ_TOP_K = 10;

export async function loadTaskSet(path: string): Promise<TaskSet> {
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw) as Partial<TaskSet> & { runs?: number };
  if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
    throw new Error(`Task file ${path} has no tasks.`);
  }
  for (const t of parsed.tasks) {
    if (!t.id || !t.question || !t.searchQuery) {
      throw new Error(`Task file ${path}: every task needs id, question and searchQuery.`);
    }
    if (!Number.isInteger(t.readTopK) || t.readTopK < 1 || t.readTopK > MAX_READ_TOP_K) {
      throw new Error(
        `Task ${t.id}: readTopK must be an integer between 1 and ${MAX_READ_TOP_K} (adapters cap search results at 10).`,
      );
    }
  }
  return {
    tasks: parsed.tasks,
    runs: parsed.runs ?? 5,
  };
}
