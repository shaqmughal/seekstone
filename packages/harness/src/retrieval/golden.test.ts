import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type GoldenSet, loadGoldenSet } from './golden.js';

const GOLDEN = fileURLToPath(new URL('../../queries/golden.json', import.meta.url));
const VAULT = fileURLToPath(new URL('../../fixtures/vault', import.meta.url));

describe('committed golden set (drift guard)', async () => {
  const set = await loadGoldenSet(GOLDEN);

  it('keeps the pre-registered subset mix (≥25 semantic, ≥8 lexical, ≥8 topical)', () => {
    const byKind = new Map<string, number>();
    for (const q of set.queries) byKind.set(q.kind, (byKind.get(q.kind) ?? 0) + 1);
    expect(byKind.get('semantic') ?? 0).toBeGreaterThanOrEqual(25);
    expect(byKind.get('lexical') ?? 0).toBeGreaterThanOrEqual(8);
    expect(byKind.get('topical') ?? 0).toBeGreaterThanOrEqual(8);
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
