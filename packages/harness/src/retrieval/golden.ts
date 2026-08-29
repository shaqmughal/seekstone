import { readFile } from 'node:fs/promises';

export type GoldenKind = 'semantic' | 'lexical' | 'topical';

/**
 * Committed at authoring time and immutable thereafter (SHA-312): tuning reads
 * the dev split only, gate v2 reports on holdout only. 'all' is the runner
 * default so pre-split reports stay comparable.
 */
export type GoldenSplit = 'dev' | 'holdout';
export type SplitFilter = GoldenSplit | 'all';

export interface GoldenQuery {
  id: string;
  kind: GoldenKind;
  query: string;
  /** Vault-relative paths of relevant notes; hit@k counts any of them. */
  expected: string[];
  /** Dev/holdout assignment, fixed at authoring time. */
  split?: GoldenSplit;
  /** Why this query is in the set — the methodology justification. */
  notes?: string;
}

export interface GoldenSet {
  comment?: string;
  queries: GoldenQuery[];
}

const KINDS: ReadonlySet<string> = new Set(['semantic', 'lexical', 'topical']);
const SPLITS: ReadonlySet<string> = new Set(['dev', 'holdout']);

/**
 * Load and validate a golden retrieval query set. The set is a committed
 * methodology artifact (like queries/default.json): edits must keep ids
 * unique and every expected path resolvable against the target vault — the
 * drift-guard test in golden.test.ts enforces the latter for fixtures/vault.
 */
export async function loadGoldenSet(path: string): Promise<GoldenSet> {
  const raw = JSON.parse(await readFile(path, 'utf8')) as GoldenSet;
  if (!Array.isArray(raw.queries) || raw.queries.length === 0) {
    throw new Error(`golden set ${path}: "queries" must be a non-empty array`);
  }
  const seen = new Set<string>();
  for (const q of raw.queries) {
    if (!q.id || seen.has(q.id)) {
      throw new Error(`golden set ${path}: missing or duplicate query id "${q.id}"`);
    }
    seen.add(q.id);
    if (!KINDS.has(q.kind)) {
      throw new Error(`golden set ${path}: query "${q.id}" has unknown kind "${q.kind}"`);
    }
    if (typeof q.query !== 'string' || q.query.trim().length === 0) {
      throw new Error(`golden set ${path}: query "${q.id}" has an empty query string`);
    }
    if (q.split !== undefined && !SPLITS.has(q.split)) {
      throw new Error(
        `golden set ${path}: query "${q.id}" has invalid split "${q.split}" (expected "dev" or "holdout")`,
      );
    }
    if (!Array.isArray(q.expected) || q.expected.length === 0) {
      throw new Error(`golden set ${path}: query "${q.id}" has no expected paths`);
    }
    for (const p of q.expected) {
      if (typeof p !== 'string' || !p.endsWith('.md') || p.includes('\\') || p.startsWith('/')) {
        throw new Error(
          `golden set ${path}: query "${q.id}" expected path "${p}" must be a vault-relative forward-slash .md path`,
        );
      }
    }
  }
  return raw;
}

/**
 * Restrict a golden set to one split. 'all' returns the set unchanged.
 * Filtering to a split requires every query to carry the field — a set
 * without split assignments cannot answer a split-scoped question.
 */
export function filterSplit(set: GoldenSet, split: SplitFilter): GoldenSet {
  if (split === 'all') return set;
  const unassigned = set.queries.filter((q) => q.split === undefined);
  if (unassigned.length > 0) {
    throw new Error(
      `cannot filter to split "${split}": ${unassigned.length} queries have no split field (e.g. "${unassigned[0]?.id}")`,
    );
  }
  return { ...set, queries: set.queries.filter((q) => q.split === split) };
}
