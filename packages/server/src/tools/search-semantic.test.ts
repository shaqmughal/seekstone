import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Index doc ids are forward-slash vault-relative paths on every platform. */
const id = (name: string) => `Notes/${name}`;

import type { Embedder, TokenEmbedder, TokenEmbedding } from '@seekstone/core/embed';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import { buildIndex } from '../index/build.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import { Semantic } from '../semantic/state.js';
import { search } from './search.js';

/** Keyword stub: axis 0 = wind, axis 1 = dairy, axis 2 = other. */
const stubEmbedder: Embedder = {
  id: 'stub-model',
  dim: 3,
  embed(text: string): Float32Array {
    const t = text.toLowerCase();
    if (/\b(wind|mill|breeze|air)\b/.test(t)) return new Float32Array([1, 0, 0]);
    if (/\b(milk|dairy|cheese|curd)\b/.test(t)) return new Float32Array([0, 1, 0]);
    return new Float32Array([0, 0, 1]);
  },
};

describe('search modes', () => {
  let vault: string;
  let cacheDir: string;
  let ctx: ServerContext;
  let semantic: Semantic;

  beforeAll(async () => {
    vault = await mkdtemp(join(tmpdir(), 'seekstone-searchsem-'));
    cacheDir = await mkdtemp(join(tmpdir(), 'seekstone-searchsem-cache-'));
    await mkdir(join(vault, 'Notes'), { recursive: true });
    await writeFile(
      join(vault, 'Notes', 'Windmill.md'),
      '# Windmill\n\nA mill worked by the wind, its sails turning in the breeze. #machine\n',
    );
    await writeFile(
      join(vault, 'Notes', 'Cheese.md'),
      '# Cheese\n\nCheese is a preparation of milk curd, a staple dairy food.\n',
    );
    await writeFile(
      join(vault, 'Notes', 'Heraldry.md'),
      '# Heraldry\n\nAn essay on medieval shields and coats of arms.\n',
    );
    const { index, notes, backlinks } = await buildIndex(vault);
    ctx = { vaultRoot: vault, index, notes, backlinks, policy: PERMISSIVE_POLICY };
    semantic = await Semantic.start(
      ctx,
      { modelId: 'stub-model', modelDir: '/stubbed', cacheDir },
      {
        loadModel: async () => stubEmbedder,
        debounceMs: 5,
        saveDebounceMs: 5,
      },
    );
    await semantic.ready();
    ctx.semantic = semantic;
  });
  afterAll(async () => {
    semantic.stop();
    await rm(vault, { recursive: true, force: true });
    await rm(cacheDir, { recursive: true, force: true });
  });

  it('defaults to lexical mode (direct calls bypass zod defaults)', () => {
    const hits = search(ctx, { query: 'cheese', limit: 10 });
    expect(hits[0]?.path).toBe(id('Cheese.md'));
  });

  it('semantic mode ranks by meaning, not keywords', () => {
    const hits = search(ctx, { query: 'machine driven by moving air', mode: 'semantic', limit: 5 });
    expect(hits[0]?.path).toBe(id('Windmill.md'));
    expect(hits[0]?.score).toBeGreaterThan(0.9);
    // Chunk-aware excerpt comes from the matching chunk's text, not empty.
    expect(hits[0]?.excerpt).toContain('mill worked by the wind');
  });

  it('semantic mode applies folder and tag filters', () => {
    const folderHits = search(ctx, {
      query: 'dairy food',
      mode: 'semantic',
      limit: 5,
      folder: 'Notes',
    });
    expect(folderHits[0]?.path).toBe(id('Cheese.md'));
    const tagHits = search(ctx, {
      query: 'machine driven by moving air',
      mode: 'semantic',
      limit: 5,
      tag: 'machine',
    });
    expect(tagHits).toHaveLength(1);
    expect(tagHits[0]?.path).toBe(id('Windmill.md'));
  });

  it('hybrid mode routes an exact-title query to lexical', () => {
    const hits = search(ctx, { query: 'Heraldry', mode: 'hybrid', limit: 5 });
    expect(hits[0]?.path).toBe(id('Heraldry.md'));
    // Lexical scores are MiniSearch magnitudes (> 1), not cosines.
    expect(hits[0]?.score).toBeGreaterThan(1);
  });

  it('hybrid mode sends description queries to semantic', () => {
    const hits = search(ctx, {
      query: 'a food made of fermented milk curd for the table',
      mode: 'hybrid',
      limit: 5,
    });
    expect(hits[0]?.path).toBe(id('Cheese.md'));
    expect(hits[0]?.score).toBeLessThanOrEqual(1); // cosine
  });

  it('throws a structured error when semantic search is not enabled', () => {
    const bare: ServerContext = { ...ctx, semantic: undefined };
    expect(() => search(bare, { query: 'x', mode: 'semantic', limit: 5 })).toThrow(
      /semantic_unavailable/,
    );
    expect(() =>
      search(bare, { query: 'some long descriptive query', mode: 'hybrid', limit: 5 }),
    ).toThrow(/semantic_unavailable/);
  });

  it('reports build progress while the index is still embedding', () => {
    const original = semantic.progress;
    semantic.progress = { state: 'building', done: 3, total: 10 };
    try {
      expect(() => search(ctx, { query: 'x', mode: 'semantic', limit: 5 })).toThrow(
        /semantic_building/,
      );
    } finally {
      semantic.progress = original;
    }
  });
});

/**
 * SHA-314: semantic search runs the MaxSim rerank when the embedder exposes
 * token vectors. Stage 1 is engineered to TIE (both notes embed to the same
 * axis), so the rerank's token-level evidence is the only thing that can put
 * the note holding the discriminating token first.
 */
describe('semantic search with MaxSim rerank', () => {
  const VOCAB = new Map<string, { id: number; vec: [number, number, number] }>([
    ['mineral', { id: 11, vec: [0, 1, 0] }],
    ['lead', { id: 10, vec: [1, 0, 0] }],
    ['rock', { id: 12, vec: [0.6, 0.8, 0] }],
  ]);
  const BY_ID = new Map([...VOCAB.values()].map((v) => [v.id, v.vec]));
  const tokenStub: TokenEmbedder = {
    id: 'token-stub',
    dim: 3,
    embed(text: string): Float32Array {
      // Coarse: anything mineral-flavoured lands on axis 1 — a stage-1 tie.
      return /\bmineral\b/i.test(text) ? new Float32Array([0, 1, 0]) : new Float32Array([0, 0, 1]);
    },
    tokenIds(text: string): number[] {
      return text
        .toLowerCase()
        .split(/\W+/)
        .map((w) => VOCAB.get(w)?.id)
        .filter((v) => v !== undefined);
    },
    tokenEmbed(text: string): TokenEmbedding {
      const ids = this.tokenIds(text);
      const vectors = new Float32Array(ids.length * 3);
      for (const [i, tid] of ids.entries()) {
        vectors.set(BY_ID.get(tid) as [number, number, number], i * 3);
      }
      return { ids, dim: 3, vectors };
    },
    tokenVector(tid: number): Float32Array {
      return Float32Array.from(BY_ID.get(tid) as [number, number, number]);
    },
  };

  let vault: string;
  let cacheDir: string;
  let ctx: ServerContext;
  let semantic: Semantic;

  beforeAll(async () => {
    vault = await mkdtemp(join(tmpdir(), 'seekstone-rerank-'));
    cacheDir = await mkdtemp(join(tmpdir(), 'seekstone-rerank-cache-'));
    await mkdir(join(vault, 'Notes'), { recursive: true });
    // Path-ascending tiebreak would put Calcite first; only the rerank
    // (Galena's chunk holds "lead") can promote Galena.
    await writeFile(join(vault, 'Notes', 'Calcite.md'), '# Calcite\n\nA mineral of rock.\n');
    await writeFile(join(vault, 'Notes', 'Galena.md'), '# Galena\n\nA mineral of lead.\n');
    const { index, notes, backlinks } = await buildIndex(vault);
    ctx = { vaultRoot: vault, index, notes, backlinks, policy: PERMISSIVE_POLICY };
    semantic = await Semantic.start(
      ctx,
      { modelId: 'token-stub', modelDir: '/stubbed', cacheDir },
      { loadModel: async () => tokenStub, debounceMs: 5, saveDebounceMs: 5 },
    );
    await semantic.ready();
    ctx.semantic = semantic;
  });
  afterAll(async () => {
    semantic.stop();
    await rm(vault, { recursive: true, force: true });
    await rm(cacheDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  it('promotes the note whose chunk holds the discriminating token', () => {
    const hits = search(ctx, { query: 'mineral bearing lead', mode: 'semantic', limit: 2 });
    expect(hits.map((h) => h.path)).toEqual([id('Galena.md'), id('Calcite.md')]);
    // Excerpt still comes from the stage-1 winning chunk's span.
    expect(hits[0]?.excerpt).toContain('mineral of lead');
  });
});
