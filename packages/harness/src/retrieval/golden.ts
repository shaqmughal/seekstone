import { readFile } from 'node:fs/promises';

export type GoldenKind = 'semantic' | 'lexical' | 'topical';

export interface GoldenQuery {
  id: string;
  kind: GoldenKind;
  query: string;
  /** Vault-relative paths of relevant notes; hit@k counts any of them. */
  expected: string[];
  /** Why this query is in the set — the methodology justification. */
  notes?: string;
}

export interface GoldenSet {
  comment?: string;
  queries: GoldenQuery[];
}

const KINDS: ReadonlySet<string> = new Set(['semantic', 'lexical', 'topical']);

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
