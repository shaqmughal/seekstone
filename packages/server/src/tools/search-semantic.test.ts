import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Index doc ids are forward-slash vault-relative paths on every platform. */
const id = (name: string) => `Notes/${name}`;

import type { Embedder } from '@seekstone/core/embed';
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
