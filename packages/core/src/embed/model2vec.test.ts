import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadModel2Vec } from './model2vec.js';
import { MINI_TOKENIZER_JSON, makeTestSafetensors } from './testutil.js';

/** Rows for the 10-token mini vocab; only the rows the tests pool are non-trivial. */
const ROWS: number[][] = [
  [9, 9, 9], // [PAD] — special, never pooled
  [0, 0, 6], // [UNK] — pooled (carries signal in Model2Vec)
  [9, 9, 9], // [CLS]
  [9, 9, 9], // [SEP]
  [1, 2, 2], // hello
  [3, 2, 0], // world
  [1, 0, 0], // wind
  [0, 1, 0], // ##mill
  [5, 5, 5], // .
  [5, 5, 5], // ,
];

async function writeModelDir(
  dir: string,
  opts: { rows?: number[][]; config?: object; tensorName?: string } = {},
): Promise<void> {
  const rows = opts.rows ?? ROWS;
  const config = opts.config ?? { hidden_dim: 3, normalize: true };
  await writeFile(join(dir, 'config.json'), JSON.stringify(config));
  await writeFile(join(dir, 'tokenizer.json'), JSON.stringify(MINI_TOKENIZER_JSON));
  await writeFile(
    join(dir, 'model.safetensors'),
    makeTestSafetensors({ [opts.tensorName ?? 'embeddings']: rows }),
  );
}

describe('loadModel2Vec', () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'seekstone-embed-'));
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function load(name: string, opts: Parameters<typeof writeModelDir>[1] = {}) {
    const dir = join(root, name);
    await (await import('node:fs/promises')).mkdir(dir, { recursive: true });
    await writeModelDir(dir, opts);
    return loadModel2Vec(dir);
  }

  it('exposes the model dir basename as id and the tensor dim', async () => {
    const m = await load('potion-mini');
    expect(m.id).toBe('potion-mini');
    expect(m.dim).toBe(3);
  });

  it('mean-pools token rows and L2-normalizes', async () => {
    const m = await load('pool');
    // hello [1,2,2] + world [3,2,0] → mean [2,2,1], norm 3.
    const v = m.embed('hello world');
    expect(v).toHaveLength(3);
    expect(v[0]).toBeCloseTo(2 / 3, 6);
    expect(v[1]).toBeCloseTo(2 / 3, 6);
    expect(v[2]).toBeCloseTo(1 / 3, 6);
  });

  it('pools the [UNK] row for out-of-vocab words', async () => {
    const m = await load('unk');
    expect([...m.embed('zebra')]).toEqual([0, 0, 1]);
  });

  it('returns unit-norm vectors for arbitrary text', async () => {
    const m = await load('norm');
    const v = m.embed('windmill, hello.');
    const norm = Math.sqrt([...v].reduce((a, x) => a + x * x, 0));
    expect(norm).toBeCloseTo(1, 6);
  });

  it('returns the zero vector for empty input', async () => {
    const m = await load('empty');
    expect([...m.embed('')]).toEqual([0, 0, 0]);
    expect([...m.embed(' \n\t ')]).toEqual([0, 0, 0]);
  });

  it('rejects an embedding matrix whose rows do not match the vocab size', async () => {
    await expect(load('bad-rows', { rows: ROWS.slice(0, 9) })).rejects.toThrow(
      /rows \(9\) do not match tokenizer vocab size \(10\)/,
    );
  });

  it('rejects a config hidden_dim that disagrees with the tensor', async () => {
    await expect(load('bad-dim', { config: { hidden_dim: 5 } })).rejects.toThrow(
      /hidden_dim 5 does not match tensor dim 3/,
    );
  });

  it('falls back to a sole unnamed tensor but reports multi-tensor mismatches', async () => {
    const m = await load('other-name', { tensorName: 'weights' });
    expect(m.dim).toBe(3);
  });

  it('rejects a multi-tensor file with no "embeddings" tensor by listing names', async () => {
    const dir = join(root, 'multi');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'config.json'), JSON.stringify({ hidden_dim: 3 }));
    await writeFile(join(dir, 'tokenizer.json'), JSON.stringify(MINI_TOKENIZER_JSON));
    await writeFile(
      join(dir, 'model.safetensors'),
      makeTestSafetensors({ alpha: ROWS, beta: ROWS }),
    );
    await expect(loadModel2Vec(dir)).rejects.toThrow(/no "embeddings" tensor.*alpha, beta/);
  });

  it('rejects a non-2-D embedding tensor', async () => {
    const dir = join(root, 'flat');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'config.json'), JSON.stringify({}));
    await writeFile(join(dir, 'tokenizer.json'), JSON.stringify(MINI_TOKENIZER_JSON));
    // Hand-build a 1-D tensor: shape [30] over the same 30 floats.
    const flat = makeTestSafetensors({ embeddings: [ROWS.flat()] });
    const header = JSON.parse(
      new TextDecoder().decode(
        flat.subarray(8, 8 + Number(new DataView(flat.buffer).getBigUint64(0, true))),
      ),
    );
    header.embeddings.shape = [30];
    const headerBytes = new TextEncoder().encode(JSON.stringify(header));
    const rebuilt = new Uint8Array(8 + headerBytes.length + 120);
    new DataView(rebuilt.buffer).setBigUint64(0, BigInt(headerBytes.length), true);
    rebuilt.set(headerBytes, 8);
    rebuilt.set(flat.subarray(flat.length - 120), 8 + headerBytes.length);
    await writeFile(join(dir, 'model.safetensors'), rebuilt);
    await expect(loadModel2Vec(dir)).rejects.toThrow(/expected a 2-D embedding matrix/);
  });

  it('returns the zero vector unnormalized when every pooled row is zero', async () => {
    const rows = ROWS.map((r, i) => (i === 4 ? [0, 0, 0] : r)); // zero out "hello"
    const m = await load('zero-row', { rows });
    expect([...m.embed('hello')]).toEqual([0, 0, 0]);
  });
});

// Runs only when the real model has been fetched:
//   npm run harness -- fetch-models
const REAL_MODEL_DIR = fileURLToPath(
  new URL('../../../harness/fixtures/models/potion-base-8M', import.meta.url),
);

describe.skipIf(!existsSync(join(REAL_MODEL_DIR, 'model.safetensors')))(
  'loadModel2Vec (real potion-base-8M)',
  () => {
    it('loads with the published shape and ranks a semantic pair sensibly', async () => {
      const m = await loadModel2Vec(REAL_MODEL_DIR);
      expect(m.dim).toBe(256);
      const dot = (a: Float32Array, b: Float32Array) => {
        let s = 0;
        for (let i = 0; i < a.length; i++) s += (a[i] as number) * (b[i] as number);
        return s;
      };
      const query = m.embed('instrument for measuring wind speed');
      const onTopic = m.embed('anemometer wind velocity measurement device');
      const offTopic = m.embed('medieval French earldom feudal succession');
      expect(dot(query, onTopic)).toBeGreaterThan(dot(query, offTopic));
    });
  },
);
