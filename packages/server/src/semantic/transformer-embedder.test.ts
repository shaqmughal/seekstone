import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import { buildIndex } from '../index/build.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import { contextPack } from '../tools/context_pack.js';
import { search } from '../tools/search.js';
import { Semantic } from './state.js';
import {
  type AsyncEmbedder,
  isAsyncEmbedder,
  loadTransformerEmbedder,
  looksLikeTransformerModel,
  TRANSFORMER_RUNTIME,
  type TransformerRuntime,
  transformerModelId,
} from './transformer-embedder.js';

const tmpDirs: string[] = [];
async function modelDir(opts: { onnx?: Record<string, string>; name?: string } = {}) {
  const parent = await mkdtemp(join(tmpdir(), 'seekstone-tjs-'));
  tmpDirs.push(parent);
  const dir = join(parent, opts.name ?? 'model');
  await mkdir(dir);
  await writeFile(join(dir, 'config.json'), '{}');
  if (opts.onnx) {
    await mkdir(join(dir, 'onnx'));
    for (const [f, bytes] of Object.entries(opts.onnx))
      await writeFile(join(dir, 'onnx', f), bytes);
  }
  return dir;
}
afterAll(async () => {
  for (const d of tmpDirs) await rm(d, { recursive: true, force: true });
});

/** A fake transformers.js: axis 0 = wind words, axis 1 = dairy words, axis 2 = other. */
function fakeRuntime(dim = 3): TransformerRuntime & { calls: string[][]; envAtLoad?: object } {
  const rt = {
    calls: [] as string[][],
    envAtLoad: undefined as object | undefined,
    env: { allowRemoteModels: true, allowLocalModels: false },
    pipeline: async (_task: 'feature-extraction', _model: string, _o: { dtype: string }) => {
      rt.envAtLoad = { ...rt.env };
      return async (texts: string | string[]) => {
        const batch = Array.isArray(texts) ? texts : [texts];
        rt.calls.push(batch);
        const data = new Float32Array(batch.length * dim);
        batch.forEach((t, i) => {
          const s = t.toLowerCase();
          const axis = /\b(wind|mill|breeze|air)\b/.test(s)
            ? 0
            : /\b(milk|dairy|cheese|curd)\b/.test(s)
              ? 1
              : 2;
          data[i * dim + axis] = 1;
        });
        return { data, dims: [batch.length, dim] };
      };
    },
  };
  return rt;
}

describe('looksLikeTransformerModel', () => {
  it('detects an HF-style ONNX model directory', async () => {
    expect(
      looksLikeTransformerModel(await modelDir({ onnx: { 'model_quantized.onnx': 'x' } })),
    ).toBe(true);
  });
  it('rejects a Model2Vec directory (no onnx/ subdir) and a missing one', async () => {
    expect(looksLikeTransformerModel(await modelDir())).toBe(false);
    expect(looksLikeTransformerModel(join(tmpdir(), 'seekstone-nope-does-not-exist'))).toBe(false);
  });
});

describe('isAsyncEmbedder', () => {
  it('recognizes async embedders by the embedBatch seam, rejects sync ones', () => {
    const asyncStub: AsyncEmbedder = {
      id: 'stub',
      dim: 2,
      embed: async () => new Float32Array(2),
      embedBatch: async (ts) => ts.map(() => new Float32Array(2)),
    };
    expect(isAsyncEmbedder(asyncStub)).toBe(true);
    expect(isAsyncEmbedder({ id: 'm', dim: 2, embed: () => new Float32Array(2) })).toBe(false);
    expect(isAsyncEmbedder(null)).toBe(false);
    expect(isAsyncEmbedder(undefined)).toBe(false);
  });
});

describe('transformerModelId', () => {
  it('differs for different weights in same-named folders, matches for the same weights elsewhere', async () => {
    const a = await modelDir({ onnx: { 'model_quantized.onnx': 'weights-A' }, name: 'model' });
    const b = await modelDir({ onnx: { 'model_quantized.onnx': 'weights-B' }, name: 'model' });
    const c = await modelDir({ onnx: { 'model_quantized.onnx': 'weights-A' }, name: 'model' });
    expect(transformerModelId(a)).not.toBe(transformerModelId(b));
    expect(transformerModelId(a)).toBe(transformerModelId(c));
    expect(transformerModelId(a)).toMatch(/^model-[0-9a-f]{12}$/);
  });
});

describe('loadTransformerEmbedder', () => {
  it('loads through the runtime with remote models disabled, pins dim from a warmup, batches', async () => {
    const dir = await modelDir({ onnx: { 'model_quantized.onnx': 'w' } });
    const rt = fakeRuntime(3);
    const e = await loadTransformerEmbedder(dir, { importRuntime: async () => rt });
    expect(rt.envAtLoad).toEqual({ allowRemoteModels: false, allowLocalModels: true });
    expect(e.dim).toBe(3);
    expect(e.id).toBe(transformerModelId(dir));
    expect(rt.calls).toEqual([['warmup']]);
    const vecs = await e.embedBatch(['the wind', 'some milk']);
    expect(rt.calls).toHaveLength(2); // one session call for the whole batch
    expect(Array.from(vecs[0] ?? [])).toEqual([1, 0, 0]);
    expect(Array.from(vecs[1] ?? [])).toEqual([0, 1, 0]);
    expect(Array.from(await e.embed('a breeze'))).toEqual([1, 0, 0]);
    expect(await e.embedBatch([])).toEqual([]);
  });

  it('gives an actionable error naming the install command when the runtime is absent', async () => {
    const dir = await modelDir({ onnx: { 'model_quantized.onnx': 'w' } });
    const missing = Object.assign(new Error(`Cannot find package '${TRANSFORMER_RUNTIME}'`), {
      code: 'ERR_MODULE_NOT_FOUND',
    });
    await expect(
      loadTransformerEmbedder(dir, {
        importRuntime: async () => {
          throw missing;
        },
      }),
    ).rejects.toThrow(new RegExp(`not installed.*-p ${TRANSFORMER_RUNTIME} seekstone`));
  });

  it('passes other runtime failures through unchanged', async () => {
    const dir = await modelDir({ onnx: { 'model_quantized.onnx': 'w' } });
    await expect(
      loadTransformerEmbedder(dir, {
        importRuntime: async () => {
          throw new Error('onnxruntime: unsupported CPU');
        },
      }),
    ).rejects.toThrow('onnxruntime: unsupported CPU');
  });
});

describe('search and context_pack over a transformer embedder', () => {
  let vault: string;
  let cacheDir: string;
  let ctx: ServerContext;
  let semantic: Semantic;
  let rt: ReturnType<typeof fakeRuntime>;

  beforeAll(async () => {
    vault = await mkdtemp(join(tmpdir(), 'seekstone-tjs-vault-'));
    cacheDir = await mkdtemp(join(tmpdir(), 'seekstone-tjs-cache-'));
    tmpDirs.push(vault, cacheDir);
    await mkdir(join(vault, 'Notes'));
    await writeFile(
      join(vault, 'Notes', 'Windmill.md'),
      '# Windmill\n\nA mill worked by the wind, its sails turning in the breeze.\n',
    );
    await writeFile(
      join(vault, 'Notes', 'Cheese.md'),
      '# Cheese\n\nCheese is a preparation of milk curd, a staple dairy food.\n',
    );
    const dir = await modelDir({ onnx: { 'model_quantized.onnx': 'w' } });
    rt = fakeRuntime(3);
    const { index, notes, backlinks } = await buildIndex(vault);
    ctx = { vaultRoot: vault, index, notes, backlinks, policy: PERMISSIVE_POLICY };
    semantic = await Semantic.start(
      ctx,
      { modelId: 'tjs', modelDir: dir, cacheDir },
      { loadModel: (d) => loadTransformerEmbedder(d, { importRuntime: async () => rt }) },
    );
    await semantic.ready();
    ctx.semantic = semantic;
  });
  afterAll(() => semantic.stop());

  it('search in semantic mode awaits the query embedding and ranks by meaning', async () => {
    const hits = await search(ctx, {
      query: 'machine driven by moving air',
      mode: 'semantic',
      limit: 5,
    });
    expect(hits[0]?.path).toBe('Notes/Windmill.md');
    expect(hits[0]?.score).toBeGreaterThan(0.9);
  });

  it('hybrid mode routes an exact title lexically and everything else through the runtime', async () => {
    const before = rt.calls.length;
    expect((await search(ctx, { query: 'Cheese', mode: 'hybrid', limit: 5 }))[0]?.path).toBe(
      'Notes/Cheese.md',
    );
    expect(rt.calls.length).toBe(before); // no embedding for the title lookup
    expect(
      (await search(ctx, { query: 'something made from milk', mode: 'hybrid', limit: 5 }))[0]?.path,
    ).toBe('Notes/Cheese.md');
    expect(rt.calls.length).toBe(before + 1);
  });

  it('lexical mode never touches the runtime', async () => {
    const before = rt.calls.length;
    const hits = await search(ctx, { query: 'breeze', mode: 'lexical', limit: 5 });
    expect(hits[0]?.path).toBe('Notes/Windmill.md');
    expect(rt.calls.length).toBe(before);
  });

  it('context_pack shares the same async retrieval path', async () => {
    const pack = await contextPack(ctx, {
      query: 'a dairy staple',
      mode: 'semantic',
      budgetBytes: 2048,
    });
    expect(pack.excerpts[0]?.path).toBe('Notes/Cheese.md');
    expect(pack.confidence).not.toBe('none');
  });
});
