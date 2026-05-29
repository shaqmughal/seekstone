import { readFile } from 'node:fs/promises';

export interface QueryDef {
  id: string;
  kind: 'single' | 'multi' | 'phrase' | 'rare';
  query: string;
  notes?: string;
}

export interface QuerySet {
  queries: QueryDef[];
  reads: { small: string | null; large: string | null };
  runs: number;
}

export async function loadQuerySet(path: string): Promise<QuerySet> {
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw) as Partial<QuerySet> & { runs?: number };
  if (!Array.isArray(parsed.queries) || parsed.queries.length === 0) {
    throw new Error(`Query file ${path} has no queries.`);
  }
  return {
    queries: parsed.queries,
    reads: parsed.reads ?? { small: null, large: null },
    runs: parsed.runs ?? 20,
  };
}
