import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadQuerySet } from './queries.js';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'seekstone-queries-test-'));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('loadQuerySet', () => {
  it('happy path: reads a valid query file and returns correct object', async () => {
    const filePath = join(tmpDir, 'valid.json');
    const content = JSON.stringify({
      queries: [{ id: 'q1', kind: 'single', query: 'test' }],
      runs: 5,
      reads: { small: null, large: null },
    });
    await writeFile(filePath, content, 'utf8');

    const result = await loadQuerySet(filePath);
    expect(result.queries).toHaveLength(1);
    expect(result.queries[0]).toMatchObject({ id: 'q1', kind: 'single', query: 'test' });
    expect(result.runs).toBe(5);
    expect(result.reads).toEqual({ small: null, large: null });
  });

  it('defaults runs to 20 when not specified in file', async () => {
    const filePath = join(tmpDir, 'no-runs.json');
    await writeFile(
      filePath,
      JSON.stringify({ queries: [{ id: 'q1', kind: 'single', query: 'test' }] }),
      'utf8',
    );

    const result = await loadQuerySet(filePath);
    expect(result.runs).toBe(20);
  });

  it('defaults reads to { small: null, large: null } when not specified', async () => {
    const filePath = join(tmpDir, 'no-reads.json');
    await writeFile(
      filePath,
      JSON.stringify({ queries: [{ id: 'q1', kind: 'single', query: 'test' }], runs: 3 }),
      'utf8',
    );

    const result = await loadQuerySet(filePath);
    expect(result.reads).toEqual({ small: null, large: null });
  });

  it('throws an error containing "no queries" for empty queries array', async () => {
    const filePath = join(tmpDir, 'empty-queries.json');
    await writeFile(filePath, JSON.stringify({ queries: [] }), 'utf8');

    await expect(loadQuerySet(filePath)).rejects.toThrow(/no queries/i);
  });

  it('throws for malformed JSON', async () => {
    const filePath = join(tmpDir, 'malformed.json');
    await writeFile(filePath, '{ not valid json ===', 'utf8');

    await expect(loadQuerySet(filePath)).rejects.toThrow(SyntaxError);
  });

  it('throws ENOENT for a non-existent file', async () => {
    const filePath = join(tmpDir, 'does-not-exist.json');

    await expect(loadQuerySet(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
