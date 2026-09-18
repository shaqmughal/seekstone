import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { afterAll, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import type { IndexedNote } from '../index/types.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import type { Semantic } from '../semantic/state.js';
import { SemanticStore } from '../semantic/store.js';
import {
  type AsyncEmbedder,
  isAsyncEmbedder,
  looksLikeTransformerModel,
} from '../semantic/transformer-embedder.js';
import { searchAsync } from './search.js';

const tmpDirs: string[] = [];
function tmpModelDir(withOnnx: boolean): string {
  const dir = mkdtempSync(join(tmpdir(), 'seekstone-model-'));
  tmpDirs.push(dir);
  writeFileSync(join(dir, 'config.json'), '{}');
  if (withOnnx) mkdirSync(join(dir, 'onnx'));
  return dir;
}
afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

describe('looksLikeTransformerModel', () => {
  it('detects an HF-style ONNX model directory', () => {
    expect(looksLikeTransformerModel(tmpModelDir(true))).toBe(true);
  });
  it('rejects a Model2Vec directory (no onnx/ subdir)', () => {
    expect(looksLikeTransformerModel(tmpModelDir(false))).toBe(false);
  });
  it('rejects a nonexistent directory', () => {
    expect(looksLikeTransformerModel(join(tmpdir(), 'seekstone-nope-does-not-exist'))).toBe(false);
  });
});

describe('isAsyncEmbedder', () => {
  const asyncStub: AsyncEmbedder = {
    id: 'stub',
    dim: 2,
    embed: async (t: string) => new Float32Array([t.length, 1]),
    embedBatch: async (ts: readonly string[]) => ts.map((t) => new Float32Array([t.length, 1])),
  };
  it('recognizes async embedders by the embedBatch seam', () => {
    expect(isAsyncEmbedder(asyncStub)).toBe(true);
  });
  it('rejects sync (Model2Vec-shaped) embedders', () => {
    expect(isAsyncEmbedder({ id: 'm', dim: 2, embed: () => new Float32Array(2) })).toBe(false);
    expect(isAsyncEmbedder(null)).toBe(false);
    expect(isAsyncEmbedder(undefined)).toBe(false);
  });
});

describe('searchAsync (transformer path)', () => {
  function buildCtx(body: string): ServerContext {
    const index = new MiniSearch<IndexedNote>({
      idField: 'id',
      fields: ['title', 'body', 'tags', 'fmKeys'],
      storeFields: ['id', 'title', 'tags', 'sizeBytes', 'mtimeMs'],
      searchOptions: { boost: { title: 3, tags: 2, body: 1 }, fuzzy: 0.2, prefix: true },
    });
    const doc: IndexedNote = {
      id: 'notes/a.md',
      title: 'Alpha',
      body,
      tags: '',
      fmKeys: '',
      fm: null,
      raw: body,
      sizeBytes: Buffer.byteLength(body, 'utf8'),
      mtimeMs: Date.now(),
    };
    index.addAll([doc]);
    return {
      vaultRoot: '/vault',
      index,
      notes: new Map([[doc.id, doc]]),
      backlinks: new Map(),
      policy: PERMISSIVE_POLICY,
    };
  }

  function fakeSemantic(dim: number, vecFor: (text: string) => number[]): Semantic {
    const store = new SemanticStore(dim);
    const vec = Float32Array.from(vecFor('chunk'));
    store.setNote('notes/a.md', vec, Uint32Array.from([0, 5]));
    const embedder: AsyncEmbedder = {
      id: 'stub-async',
      dim,
      embed: async (t: string) => Float32Array.from(vecFor(t)),
      embedBatch: async (ts: readonly string[]) => ts.map((t) => Float32Array.from(vecFor(t))),
    };
    return {
      embedder,
      progress: { state: 'ready' },
      store,
      rerank: (_q: string, hits: never[]) => [...hits],
      embedQueryAsync: async (q: string) => embedder.embed(q),
    } as unknown as Semantic;
  }

  it('embeds the query through the async embedder and ranks by cosine', async () => {
    const ctx = buildCtx('lorem ipsum dolor');
    ctx.semantic = fakeSemantic(2, (t) => (t.includes('lorem') ? [1, 0] : [0.9, 0.1]));
    const hits = await searchAsync(ctx, { query: 'lorem', mode: 'semantic', limit: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.path).toBe('notes/a.md');
  });

  it('lexical mode never touches the async embedder', async () => {
    const ctx = buildCtx('lorem ipsum dolor');
    let called = 0;
    const sem = fakeSemantic(2, () => {
      called++;
      return [1, 0];
    });
    ctx.semantic = sem;
    called = 0; // setup embeds (index build) don't count — only query-time embeds
    const hits = await searchAsync(ctx, { query: 'lorem', mode: 'lexical', limit: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(called).toBe(0);
  });
});
