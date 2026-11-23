import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type LoadModel2VecOptions, loadModel2Vec } from '@seekstone/core/embed';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MINI_TOKENIZER_JSON, makeTestSafetensors } from '../../../core/src/embed/testutil.js';
import type { GoldenSet } from './golden.js';
import { renderRetrievalMarkdown } from './report.js';
import { parseWeights, runRetrievalEval } from './runner.js';

const ROWS = [
  [9, 9, 9],
  [0, 0, 6],
  [9, 9, 9],
  [9, 9, 9],
  [1, 2, 2],
  [3, 2, 0],
  [1, 0, 0],
  [0, 1, 0],
  [5, 5, 5],
  [5, 5, 5],
];

const GOLDEN: GoldenSet = {
  queries: [{ id: 'q1', kind: 'lexical', query: 'wind', expected: ['Notes/Wind.md'] }],
};

describe('parseWeights', () => {
  it('defaults to int8', () => {
    expect(parseWeights(undefined)).toBe('int8');
    expect(parseWeights('')).toBe('int8');
  });

  it('accepts int8 and f32', () => {
    expect(parseWeights('int8')).toBe('int8');
    expect(parseWeights('f32')).toBe('f32');
  });

  it('rejects anything else with a message naming both formats', () => {
    expect(() => parseWeights('fp16')).toThrow(/"fp16".*int8.*f32/);
  });
});

describe('runRetrievalEval weights (SHA-552)', () => {
  let root: string;
  let vault: string;
  let modelsDir: string;
  let cacheDir: string;
  let prevCache: string | undefined;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'seekstone-weights-'));
    vault = join(root, 'vault');
    modelsDir = join(root, 'models');
    cacheDir = join(root, 'cache');
    prevCache = process.env.SEEKSTONE_CACHE_DIR;
    process.env.SEEKSTONE_CACHE_DIR = cacheDir;
    await mkdir(join(vault, 'Notes'), { recursive: true });
    await writeFile(join(vault, 'Notes', 'Wind.md'), '# Wind\n\nhello wind world.\n');
    const dir = join(modelsDir, 'mini');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'config.json'), JSON.stringify({ hidden_dim: 3, normalize: true }));
    await writeFile(join(dir, 'tokenizer.json'), JSON.stringify(MINI_TOKENIZER_JSON));
    await writeFile(join(dir, 'model.safetensors'), makeTestSafetensors({ embeddings: ROWS }));
  });
  afterAll(async () => {
    if (prevCache === undefined) delete process.env.SEEKSTONE_CACHE_DIR;
    else process.env.SEEKSTONE_CACHE_DIR = prevCache;
    await rm(root, { recursive: true, force: true });
  });

  async function run(weights?: string) {
    const seen: Array<LoadModel2VecOptions | undefined> = [];
    const summary = await runRetrievalEval({
      vaultRoot: vault,
      goldenSet: GOLDEN,
      modelsDir,
      modelIds: ['mini'],
      runs: 2,
      shipped: true,
      weights: weights as 'int8' | 'f32' | undefined,
      loadEmbedder: async (dir, opts) => {
        seen.push(opts);
        return loadModel2Vec(dir, opts);
      },
    });
    return { seen, summary };
  }

  it('passes int8 by default to every load, shipped included', async () => {
    const { seen, summary } = await run();
    // One load for the eval index, one for the shipped handle.
    expect(seen).toEqual([{ weights: 'int8' }, { weights: 'int8' }]);
    expect(summary.models[0]?.weights).toBe('int8');
  });

  it('passes f32 to every load and records it in the report header', async () => {
    const { seen, summary } = await run('f32');
    expect(seen).toEqual([{ weights: 'f32' }, { weights: 'f32' }]);
    expect(summary.models[0]?.weights).toBe('f32');
    expect(renderRetrievalMarkdown(summary)).toMatch(/\*\*mini:\*\*.*\(f32 weights\)/);
  });

  it('keeps int8 and f32 shipped caches apart', async () => {
    await run('int8');
    await run('f32');
    const files = await collectFiles(cacheDir);
    expect(files.some((f) => f.includes('mini+f32'))).toBe(true);
    expect(files.some((f) => f.includes('mini') && !f.includes('+f32'))).toBe(true);
  });

  it('rejects an unknown value before any model loads', async () => {
    let loads = 0;
    await expect(
      runRetrievalEval({
        vaultRoot: vault,
        goldenSet: GOLDEN,
        modelsDir,
        modelIds: ['mini'],
        runs: 2,
        weights: 'fp16' as never,
        loadEmbedder: async (dir, opts) => {
          loads++;
          return loadModel2Vec(dir, opts);
        },
      }),
    ).rejects.toThrow(/int8.*f32/);
    expect(loads).toBe(0);
  });
});

async function collectFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (e.isFile()) out.push(join(e.parentPath, e.name));
  }
  return out;
}
