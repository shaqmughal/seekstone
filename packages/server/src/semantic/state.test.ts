import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Embedder } from '@seekstone/core/embed';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { IndexedNote } from '../index/types.js';
import { Semantic, type SemanticCtx } from './state.js';

/** Keyword stub: axis 0 = wind, axis 1 = dairy, axis 2 = other. */
const stubEmbedder: Embedder = {
  id: 'stub-model',
  dim: 3,
  embed(text: string): Float32Array {
    const t = text.toLowerCase();
    if (/\b(wind|mill|breeze)\b/.test(t)) return new Float32Array([1, 0, 0]);
    if (/\b(milk|dairy|cheese)\b/.test(t)) return new Float32Array([0, 1, 0]);
    return new Float32Array([0, 0, 1]);
  },
};

function note(id: string, body: string): IndexedNote {
  const title = (id.split('/').pop() ?? id).replace(/\.md$/, '');
  return {
    id,
    title,
    body,
    tags: '',
    fmKeys: '',
    fm: null,
    raw: body,
    sizeBytes: body.length,
    mtimeMs: 0,
  };
}

function makeCtx(vaultRoot: string): SemanticCtx {
  return {
    vaultRoot,
    notes: new Map<string, IndexedNote>([
      ['Notes/Windmill.md', note('Notes/Windmill.md', 'A mill worked by the wind.')],
      ['Notes/Cheese.md', note('Notes/Cheese.md', 'A dairy food made from milk.')],
      ['Notes/Other.md', note('Notes/Other.md', 'Nothing in particular.')],
    ]),
  };
}

const deps = () => ({
  loadModel: async () => stubEmbedder,
  debounceMs: 5,
  saveDebounceMs: 5,
  yieldEvery: 2,
});

describe('Semantic', () => {
  let cacheDir: string;
  beforeAll(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'seekstone-semstate-'));
  });
  afterAll(async () => {
    await rm(cacheDir, { recursive: true, force: true });
  });

  const cfg = () => ({ modelDir: '/unused-stubbed', cacheDir });

  it('builds the index in the background and reports progress → ready', async () => {
    const ctx = makeCtx('/vault/build');
    const s = await Semantic.start(ctx, cfg(), deps());
    expect(['building', 'ready']).toContain(s.progress.state);
    await s.ready();
    expect(s.progress).toEqual({ state: 'ready' });
    expect(s.store.noteCount).toBe(3);
    const hits = s.store.topNotes(s.embedQuery('breeze'), 2);
    expect(hits[0]?.path).toBe('Notes/Windmill.md');
    s.stop();
  });

  it('reuses the persisted cache on a second start', async () => {
    const ctx = makeCtx('/vault/cache-reuse');
    const first = await Semantic.start(ctx, cfg(), deps());
    await first.ready();
    // Build saves the cache when anything was freshly embedded — await the
    // internal save by polling the second start's reuse behavior.
    first.stop();

    const embedSpy = vi.fn(stubEmbedder.embed.bind(stubEmbedder));
    const spiedEmbedder: Embedder = { ...stubEmbedder, embed: embedSpy };
    const second = await Semantic.start(ctx, cfg(), {
      ...deps(),
      loadModel: async () => spiedEmbedder,
    });
    await second.ready();
    expect(second.store.noteCount).toBe(3);
    // Every note came from the cache — no note embedding happened.
    expect(embedSpy).not.toHaveBeenCalled();
    // Queries still work against cached vectors.
    expect(second.store.topNotes(second.embedQuery('milk dairy'), 1)[0]?.path).toBe(
      'Notes/Cheese.md',
    );
    second.stop();
  });

  it('re-embeds a changed note after the debounce window', async () => {
    const ctx = makeCtx('/vault/reembed');
    const s = await Semantic.start(ctx, cfg(), deps());
    await s.ready();
    expect(s.store.topNotes(s.embedQuery('milk'), 1)[0]?.path).toBe('Notes/Cheese.md');

    // The watcher refreshes ctx.notes, then pokes noteChanged.
    ctx.notes.set('Notes/Other.md', note('Notes/Other.md', 'Now all about cheese and milk.'));
    s.noteChanged('Notes/Other.md');
    await vi.waitFor(() => {
      const top = s.store.topNotes(s.embedQuery('dairy'), 2);
      // Both dairy notes must score ~1 — Other.md at its build-time score of 0
      // (a tie-break artifact) would mean the re-embed never happened.
      expect(top.map((h) => h.path)).toContain('Notes/Other.md');
      expect(top[1]?.score ?? 0).toBeGreaterThan(0.9);
    });
    s.stop();
  });

  it('skips a re-embed when content is unchanged and drops removed notes', async () => {
    const ctx = makeCtx('/vault/remove');
    const s = await Semantic.start(ctx, cfg(), deps());
    await s.ready();

    s.noteChanged('Notes/Windmill.md'); // same content — debounce fires, hash matches
    await new Promise((r) => setTimeout(r, 20));
    expect(s.store.noteCount).toBe(3);

    ctx.notes.delete('Notes/Windmill.md');
    s.noteRemoved('Notes/Windmill.md');
    expect(s.store.noteCount).toBe(2);
    expect(s.store.topNotes(s.embedQuery('breeze'), 1)[0]?.path).not.toBe('Notes/Windmill.md');
    s.stop();
  });

  it('fails loudly with an actionable message when the model cannot load', async () => {
    await expect(
      Semantic.start(
        makeCtx('/vault/nomodel'),
        { modelDir: '/nope/model', cacheDir },
        {
          loadModel: async () => {
            throw new Error('ENOENT');
          },
        },
      ),
    ).rejects.toThrow(/fetch-model/);
  });

  it('persists the cache after a watcher-driven re-embed', async () => {
    const ctx = makeCtx('/vault/persist');
    const s = await Semantic.start(ctx, cfg(), deps());
    await s.ready();
    // The build already saved once — delete the manifest so a reappearing
    // file can only come from the debounced post-change save.
    const { existsSync } = await import('node:fs');
    const { rm: rmFile } = await import('node:fs/promises');
    const { cachePathsFor, loadCache } = await import('./cache.js');
    const paths = cachePathsFor(cacheDir, '/vault/persist', 'stub-model');
    await rmFile(paths.manifest, { force: true });
    ctx.notes.set('Notes/Other.md', note('Notes/Other.md', 'Fresh cheese content.'));
    s.noteChanged('Notes/Other.md');
    await vi.waitFor(() => {
      expect(existsSync(paths.manifest)).toBe(true);
    });
    const reloaded = await loadCache(paths, 'stub-model', 3);
    expect(reloaded?.vectors.has('Notes/Other.md')).toBe(true);
    s.stop();
  });

  it('drops a pending re-embed when the note is removed first', async () => {
    const ctx = makeCtx('/vault/remove-pending');
    const s = await Semantic.start(ctx, cfg(), deps());
    await s.ready();
    ctx.notes.set('Notes/Other.md', note('Notes/Other.md', 'About milk now.'));
    s.noteChanged('Notes/Other.md'); // pending timer armed
    ctx.notes.delete('Notes/Other.md');
    s.noteRemoved('Notes/Other.md'); // must clear the pending timer too
    await new Promise((r) => setTimeout(r, 30));
    expect(s.store.noteCount).toBe(2);
    expect(s.store.getNote('Notes/Other.md')).toBeUndefined();
    s.stop();
  });

  it('applies default debounce/yield settings and the real model loader path', async () => {
    // No deps beyond loadModel — exercises every ?? default.
    const ctx = makeCtx('/vault/defaults');
    const s = await Semantic.start(ctx, cfg(), { loadModel: async () => stubEmbedder });
    await s.ready();
    expect(s.store.noteCount).toBe(3);
    s.stop();
    // No loadModel seam at all — the real loadModel2Vec path runs and fails
    // actionably on a missing model dir.
    await expect(
      Semantic.start(makeCtx('/vault/realloader'), { modelDir: '/definitely/missing', cacheDir }),
    ).rejects.toThrow(/fetch-model/);
  });

  it('survives a failing cache save with a warning, and a failing build with an error log', async () => {
    const logs: Record<string, string[]> = { error: [], warn: [], info: [], debug: [] };
    const log = {
      level: 'debug' as const,
      error: (m: string) => void logs.error?.push(m),
      warn: (m: string) => void logs.warn?.push(m),
      info: (m: string) => void logs.info?.push(m),
      debug: (m: string) => void logs.debug?.push(m),
    };
    // cacheDir pointing at a FILE makes every cache write fail.
    const { writeFile: wf } = await import('node:fs/promises');
    const notADir = join(cacheDir, 'not-a-dir');
    await wf(notADir, 'occupied');
    const s = await Semantic.start(
      makeCtx('/vault/badsave'),
      { modelDir: '/x', cacheDir: notADir },
      {
        ...deps(),
        log,
      },
    );
    await s.ready();
    expect(s.progress).toEqual({ state: 'ready' }); // save failure never breaks the index
    expect(logs.warn?.join(' ')).toContain('semantic cache save failed');
    s.stop();

    const boom: typeof stubEmbedder = {
      ...stubEmbedder,
      embed: () => {
        throw new Error('embed exploded');
      },
    };
    const failing = await Semantic.start(makeCtx('/vault/badbuild'), cfg(), {
      ...deps(),
      loadModel: async () => boom,
      log,
    });
    await failing.ready(); // resolves — the build failure is caught and logged
    expect(logs.error?.join(' ')).toContain('semantic build failed');
    expect(failing.progress.state).toBe('building'); // never reached ready
    failing.stop();
  });

  it('stop() cancels pending re-embeds and ignores later events', async () => {
    const ctx = makeCtx('/vault/stop');
    const s = await Semantic.start(ctx, cfg(), deps());
    await s.ready();
    ctx.notes.set('Notes/Other.md', note('Notes/Other.md', 'Now dairy milk cheese.'));
    s.noteChanged('Notes/Other.md');
    s.stop(); // before the 5 ms debounce fires
    s.noteChanged('Notes/Other.md'); // no-op after stop
    await new Promise((r) => setTimeout(r, 30));
    const top = s.store.topNotes(s.embedQuery('dairy'), 3);
    expect(top[0]?.path).toBe('Notes/Cheese.md'); // Other.md was never re-embedded
    expect(top[0]?.score ?? 0).toBeGreaterThan(top[1]?.score ?? 0);
  });
});
