import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { filterSplit, type GoldenSet, loadGoldenSet } from './golden.js';

const GOLDEN = fileURLToPath(new URL('../../queries/golden.json', import.meta.url));
const VAULT = fileURLToPath(new URL('../../fixtures/vault', import.meta.url));

/**
 * The original 50-query set (pre-SHA-312). These ids are burned as tuning
 * targets (SHA-307 fusion selection used them), so they are pinned to the
 * dev split forever; their presence keeps historical baselines comparable.
 */
const ORIGINAL_50 = [
  'sem-anemometer',
  'sem-anglesite',
  'sem-enigma',
  'sem-jaguar',
  'sem-kaleidoscope',
  'sem-dahlia',
  'sem-dynamo',
  'sem-geyser',
  'sem-giraffe',
  'sem-guillotine',
  'sem-hurricane',
  'sem-ivory',
  'sem-jade',
  'sem-lemur',
  'sem-candle',
  'sem-cotton',
  'sem-kite-bird',
  'sem-cocoa',
  'sem-comet',
  'sem-coral',
  'sem-duel',
  'sem-fog',
  'sem-llama',
  'sem-fox-statesman',
  'sem-darwin',
  'sem-faraday',
  'sem-kant',
  'sem-japan',
  'sem-machiavelli',
  'sem-livingstone',
  'lex-phlogiston',
  'lex-chateaubriant',
  'lex-asolo',
  'lex-handel',
  'lex-cromwell',
  'lex-dante',
  'lex-emerald-beryl',
  'lex-hydrodynamics',
  'lex-argon',
  'lex-lavoisier',
  'top-birds-of-prey',
  'top-big-cats',
  'top-green-gemstones',
  'top-fermented-drinks',
  'top-hand-weapons',
  'top-weather',
  'top-textiles',
  'top-instruments',
  'top-composers',
  'top-dairy',
] as const;

describe('committed golden set (drift guard)', async () => {
  const set = await loadGoldenSet(GOLDEN);

  it('keeps the pre-registered subset mix (≥80 semantic, ≥25 lexical, ≥25 topical; ≥150 total)', () => {
    const byKind = new Map<string, number>();
    for (const q of set.queries) byKind.set(q.kind, (byKind.get(q.kind) ?? 0) + 1);
    expect(set.queries.length).toBeGreaterThanOrEqual(150);
    expect(byKind.get('semantic') ?? 0).toBeGreaterThanOrEqual(80);
    expect(byKind.get('lexical') ?? 0).toBeGreaterThanOrEqual(25);
    expect(byKind.get('topical') ?? 0).toBeGreaterThanOrEqual(25);
  });

  it('assigns every query to a split, with both splits non-empty per subset', () => {
    const unassigned = set.queries.filter((q) => q.split === undefined).map((q) => q.id);
    expect(unassigned).toEqual([]);
    for (const kind of ['semantic', 'lexical', 'topical'] as const) {
      for (const split of ['dev', 'holdout'] as const) {
        const n = set.queries.filter((q) => q.kind === kind && q.split === split).length;
        expect(n, `${kind}/${split} must be non-empty`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the original 50 ids, pinned to the dev split', () => {
    const byId = new Map(set.queries.map((q) => [q.id, q]));
    const missing = ORIGINAL_50.filter((id) => !byId.has(id));
    expect(missing).toEqual([]);
    const notDev = ORIGINAL_50.filter((id) => byId.get(id)?.split !== 'dev');
    expect(notDev).toEqual([]);
  });

  it('topical queries carry at least two expected paths', () => {
    const thin = set.queries
      .filter((q) => q.kind === 'topical' && q.expected.length < 2)
      .map((q) => q.id);
    expect(thin).toEqual([]);
  });

  it('every expected path exists in fixtures/vault', () => {
    const missing: string[] = [];
    for (const q of set.queries) {
      for (const p of q.expected) {
        if (!existsSync(join(VAULT, p))) missing.push(`${q.id}: ${p}`);
      }
    }
    // Regenerating the vault (gen-vault) can drop articles — fix the golden
    // set in the same change, never let it silently go stale.
    expect(missing).toEqual([]);
  });

  it('semantic queries never contain their target headword', () => {
    const offenders: string[] = [];
    for (const q of set.queries) {
      if (q.kind !== 'semantic') continue;
      const words = new Set(q.query.toLowerCase().split(/\W+/));
      for (const p of q.expected) {
        const base = (p.split('/').pop() ?? '').replace(/\.md$/, '').toLowerCase();
        if (words.has(base)) offenders.push(`${q.id}: "${base}" appears in the query`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('loadGoldenSet validation', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'seekstone-golden-'));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function write(name: string, set: unknown): Promise<string> {
    const p = join(dir, name);
    await writeFile(p, JSON.stringify(set));
    return p;
  }

  const valid = (over: object = {}): GoldenSet => ({
    queries: [
      { id: 'q1', kind: 'semantic', query: 'a question', expected: ['Notes/A.md'], ...over },
    ],
  });

  it('accepts a valid set', async () => {
    const set = await loadGoldenSet(await write('ok.json', valid()));
    expect(set.queries).toHaveLength(1);
  });

  it('rejects an empty query list', async () => {
    await expect(loadGoldenSet(await write('empty.json', { queries: [] }))).rejects.toThrow(
      /non-empty/,
    );
  });

  it('rejects duplicate ids', async () => {
    const set = { queries: [valid().queries[0], valid().queries[0]] };
    await expect(loadGoldenSet(await write('dup.json', set))).rejects.toThrow(/duplicate/);
  });

  it('rejects unknown kinds', async () => {
    await expect(loadGoldenSet(await write('kind.json', valid({ kind: 'vibes' })))).rejects.toThrow(
      /unknown kind/,
    );
  });

  it('accepts valid splits and rejects invalid ones', async () => {
    const ok = await loadGoldenSet(await write('split-ok.json', valid({ split: 'holdout' })));
    expect(ok.queries[0]?.split).toBe('holdout');
    await expect(
      loadGoldenSet(await write('split-bad.json', valid({ split: 'test' }))),
    ).rejects.toThrow(/invalid split/);
  });

  it('rejects empty expected lists and non-vault-relative paths', async () => {
    await expect(loadGoldenSet(await write('noexp.json', valid({ expected: [] })))).rejects.toThrow(
      /no expected paths/,
    );
    await expect(
      loadGoldenSet(await write('abs.json', valid({ expected: ['/etc/passwd.md'] }))),
    ).rejects.toThrow(/vault-relative/);
    await expect(
      loadGoldenSet(await write('ext.json', valid({ expected: ['Notes/A.txt'] }))),
    ).rejects.toThrow(/vault-relative/);
  });
});

describe('filterSplit', () => {
  const q = (id: string, split?: 'dev' | 'holdout') => ({
    id,
    kind: 'semantic' as const,
    query: 'q',
    expected: ['Notes/A.md'],
    ...(split ? { split } : {}),
  });

  it("returns the set unchanged for 'all'", () => {
    const set: GoldenSet = { queries: [q('a', 'dev'), q('b')] };
    expect(filterSplit(set, 'all')).toBe(set);
  });

  it('restricts to the requested split', () => {
    const set: GoldenSet = { queries: [q('a', 'dev'), q('b', 'holdout'), q('c', 'dev')] };
    expect(filterSplit(set, 'dev').queries.map((x) => x.id)).toEqual(['a', 'c']);
    expect(filterSplit(set, 'holdout').queries.map((x) => x.id)).toEqual(['b']);
  });

  it('refuses to split a set with unassigned queries', () => {
    const set: GoldenSet = { queries: [q('a', 'dev'), q('b')] };
    expect(() => filterSplit(set, 'dev')).toThrow(/no split field.*"b"/);
  });
});
