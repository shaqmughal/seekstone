import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type LoadModel2VecOptions, loadModel2Vec } from './model2vec.js';
import { lcg, MINI_TOKENIZER_JSON, makeTestSafetensors } from './testutil.js';

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
  opts: { rows?: number[][]; config?: object; tensorName?: string } & LoadModel2VecOptions = {},
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
    return loadModel2Vec(dir, opts);
  }

  it('exposes the model dir basename as id and the tensor dim', async () => {
    const m = await load('potion-mini');
    expect(m.id).toBe('potion-mini');
    expect(m.dim).toBe(3);
  });

  it('suffixes the id with +f32 for the non-default float32 table', async () => {
    const m = await load('potion-f32', { weights: 'f32' });
    expect(m.id).toBe('potion-f32+f32');
    expect((await load('potion-int8', { weights: 'int8' })).id).toBe('potion-int8');
  });

  it('mean-pools token rows and L2-normalizes', async () => {
    // Exact float32 arithmetic: the f32 table is unchanged by SHA-548.
    const m = await load('pool', { weights: 'f32' });
    // hello [1,2,2] + world [3,2,0] → mean [2,2,1], norm 3.
    const v = m.embed('hello world');
    expect(v).toHaveLength(3);
    expect(v[0]).toBeCloseTo(2 / 3, 6);
    expect(v[1]).toBeCloseTo(2 / 3, 6);
    expect(v[2]).toBeCloseTo(1 / 3, 6);
    // The int8 table lands within quantization error of the same answer.
    const q = (await load('pool-int8')).embed('hello world');
    expect(q[0]).toBeCloseTo(2 / 3, 2);
    expect(q[1]).toBeCloseTo(2 / 3, 2);
    expect(q[2]).toBeCloseTo(1 / 3, 2);
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

describe('tokenEmbed', () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'seekstone-tokembed-'));
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function load(name: string, opts: Parameters<typeof writeModelDir>[1] = {}) {
    const dir = join(root, name);
    await mkdir(dir, { recursive: true });
    await writeModelDir(dir, opts);
    return loadModel2Vec(dir, opts);
  }

  it('returns one L2-normalized row per kept token, in input order', async () => {
    // Exact float32 arithmetic: the f32 table is unchanged by SHA-548.
    const m = await load('rows', { weights: 'f32' });
    const t = m.tokenEmbed('hello world');
    expect(t.ids).toEqual([4, 5]);
    expect(t.dim).toBe(3);
    // hello [1,2,2] norm 3; world [3,2,0] norm √13.
    const s13 = Math.sqrt(13);
    expect(t.vectors[0]).toBeCloseTo(1 / 3, 6);
    expect(t.vectors[1]).toBeCloseTo(2 / 3, 6);
    expect(t.vectors[2]).toBeCloseTo(2 / 3, 6);
    expect(t.vectors[3]).toBeCloseTo(3 / s13, 6);
    expect(t.vectors[4]).toBeCloseTo(2 / s13, 6);
    expect(t.vectors[5]).toBeCloseTo(0, 6);
  });

  it('keeps the [UNK] row for out-of-vocab words, like embed()', async () => {
    const m = await load('unk');
    const t = m.tokenEmbed('zebra');
    expect(t.ids).toEqual([1]);
    expect([...t.vectors]).toEqual([0, 0, 1]);
  });

  it('includes punctuation tokens (not special) alongside words', async () => {
    const m = await load('punct');
    expect(m.tokenEmbed('hello.').ids).toEqual([4, 8]);
  });

  it('returns an empty embedding for empty or whitespace-only text', async () => {
    const m = await load('empty');
    const t = m.tokenEmbed(' \n\t ');
    expect(t.ids).toEqual([]);
    expect(t.vectors).toHaveLength(0);
  });

  it('leaves an all-zero matrix row as a zero vector', async () => {
    const rows = ROWS.map((r, i) => (i === 4 ? [0, 0, 0] : r)); // zero out "hello"
    const m = await load('zero-row', { rows });
    expect([...m.tokenEmbed('hello').vectors]).toEqual([0, 0, 0]);
  });
});

describe('tokenIds / tokenVector', () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'seekstone-tokvec-'));
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('tokenIds matches tokenEmbed ids and tokenVector matches its rows', async () => {
    const dir = join(root, 'ids');
    await mkdir(dir, { recursive: true });
    await writeModelDir(dir);
    const m = await loadModel2Vec(dir);
    expect(m.tokenIds('hello world.')).toEqual([4, 5, 8]);
    const t = m.tokenEmbed('hello world.');
    for (const [i, id] of t.ids.entries()) {
      const row = m.tokenVector(id);
      for (let j = 0; j < 3; j++) expect(row[j]).toBeCloseTo(t.vectors[i * 3 + j] as number, 7);
    }
    expect(() => m.tokenVector(99)).toThrow(/outside vocab/);
  });
});

describe('int8 vs f32 parity (SHA-548)', () => {
  const WORDS = 200;
  const DIM = 64;
  let root: string;
  let f32: Awaited<ReturnType<typeof loadModel2Vec>>;
  let int8: Awaited<ReturnType<typeof loadModel2Vec>>;
  const rand = lcg(548);
  const words = Array.from({ length: WORDS }, (_, i) => `w${i}`);
  const texts = Array.from({ length: 50 }, () =>
    Array.from(
      { length: 1 + Math.floor(rand() * 12) },
      () => words[Math.floor(rand() * WORDS)],
    ).join(' '),
  );

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'seekstone-parity-'));
    const vocab: Record<string, number> = { '[PAD]': 0, '[UNK]': 1, '[CLS]': 2, '[SEP]': 3 };
    for (const [i, w] of words.entries()) vocab[w] = 4 + i;
    // Row magnitudes vary 100×, like real Model2Vec tables; row 10 is all zeros.
    const rows = Array.from({ length: 4 + WORDS }, (_, r) => {
      const mag = 0.01 + rand();
      return Array.from({ length: DIM }, () => (r === 10 ? 0 : (rand() * 2 - 1) * mag));
    });
    await writeFile(join(root, 'config.json'), JSON.stringify({ hidden_dim: DIM }));
    await writeFile(
      join(root, 'tokenizer.json'),
      JSON.stringify({ ...MINI_TOKENIZER_JSON, model: { ...MINI_TOKENIZER_JSON.model, vocab } }),
    );
    await writeFile(join(root, 'model.safetensors'), makeTestSafetensors({ embeddings: rows }));
    f32 = await loadModel2Vec(root, { weights: 'f32' });
    int8 = await loadModel2Vec(root);
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const cosine = (a: Float32Array, b: Float32Array) => {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += (a[i] as number) * (b[i] as number);
      na += (a[i] as number) ** 2;
      nb += (b[i] as number) ** 2;
    }
    return na === 0 && nb === 0 ? 1 : dot / Math.sqrt(na * nb);
  };

  it('embed() output has cosine ≥ 0.999 with f32 on 50 fixed texts', () => {
    for (const text of texts) {
      expect(cosine(int8.embed(text), f32.embed(text))).toBeGreaterThanOrEqual(0.999);
    }
  });

  it('tokenVector() has cosine ≥ 0.999 with f32 for every id', () => {
    for (let id = 0; id < 4 + WORDS; id++) {
      expect(cosine(int8.tokenVector(id), f32.tokenVector(id))).toBeGreaterThanOrEqual(0.999);
    }
    expect([...int8.tokenVector(10)].every((x) => x === 0)).toBe(true);
  });

  it('tokenEmbed() rows match f32 per token', () => {
    for (const text of texts.slice(0, 10)) {
      const a = int8.tokenEmbed(text);
      const b = f32.tokenEmbed(text);
      expect(a.ids).toEqual(b.ids);
      for (let t = 0; t < a.ids.length; t++) {
        const lo = t * DIM;
        expect(
          cosine(a.vectors.subarray(lo, lo + DIM), b.vectors.subarray(lo, lo + DIM)),
        ).toBeGreaterThanOrEqual(0.999);
      }
    }
  });
});
