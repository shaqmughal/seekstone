import { chunkNote, type Embedder, loadModel2Vec } from '@seekstone/core/embed';
import { contentHash } from '../content-hash.js';
import type { IndexedNote } from '../index/types.js';
import type { Logger } from '../log.js';
import { type CachePaths, cachePathsFor, loadCache, saveCache } from './cache.js';
import type { SemanticConfig } from './config.js';
import { SemanticStore } from './store.js';

export type SemanticProgress =
  | { state: 'building'; done: number; total: number }
  | { state: 'ready' };

/** The slice of ServerContext the semantic index needs (avoids an import cycle). */
export interface SemanticCtx {
  vaultRoot: string;
  notes: Map<string, IndexedNote>;
}

export interface SemanticDeps {
  log?: Logger;
  /** Per-note re-embed debounce (ms). */
  debounceMs?: number;
  /** Cache re-save debounce after watcher-driven changes (ms). */
  saveDebounceMs?: number;
  /** Yield to the event loop after this many freshly-embedded notes. */
  yieldEvery?: number;
  /** Test seam; defaults to loadModel2Vec. */
  loadModel?: (modelDir: string) => Promise<Embedder>;
}

/**
 * The live semantic index: embeds every note's chunks at boot (in the
 * background, off the hot path — queries during the build get a structured
 * progress error), keeps a per-vault (path, contentHash)-keyed cache so
 * restarts skip re-embedding, and re-embeds individual notes as the watcher
 * reports changes (debounced; the watcher's index update already refreshed
 * ctx.notes by then, so re-embeds read from memory, not disk).
 */
export class Semantic {
  readonly embedder: Embedder;
  readonly store: SemanticStore;
  progress: SemanticProgress;

  private readonly ctx: SemanticCtx;
  private readonly paths: CachePaths;
  private readonly log?: Logger;
  private readonly debounceMs: number;
  private readonly saveDebounceMs: number;
  private readonly yieldEvery: number;
  private readonly hashes = new Map<string, string>();
  private readonly pending = new Map<string, NodeJS.Timeout>();
  private saveTimer: NodeJS.Timeout | undefined;
  private stopped = false;

  private constructor(
    embedder: Embedder,
    ctx: SemanticCtx,
    cfg: SemanticConfig,
    deps: SemanticDeps,
  ) {
    this.embedder = embedder;
    this.store = new SemanticStore(embedder.dim);
    this.ctx = ctx;
    this.paths = cachePathsFor(cfg.cacheDir, ctx.vaultRoot, embedder.id);
    this.log = deps.log;
    this.debounceMs = deps.debounceMs ?? 300;
    this.saveDebounceMs = deps.saveDebounceMs ?? 5000;
    this.yieldEvery = deps.yieldEvery ?? 8;
    this.progress = { state: 'building', done: 0, total: ctx.notes.size };
  }

  /**
   * Load the model and kick off the background index build. Rejects with an
   * actionable message when the model files are missing — the user enabled
   * the feature explicitly, so a broken setup should fail loudly at boot.
   */
  static async start(
    ctx: SemanticCtx,
    cfg: SemanticConfig,
    deps: SemanticDeps = {},
  ): Promise<Semantic> {
    let embedder: Embedder;
    try {
      embedder = await (deps.loadModel ?? loadModel2Vec)(cfg.modelDir);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `semantic search: could not load the embedding model from ${cfg.modelDir} — ` +
          `run \`npx -y seekstone fetch-model\` to download it, or point SEEKSTONE_MODEL_PATH at a Model2Vec model directory (${reason})`,
      );
    }
    const semantic = new Semantic(embedder, ctx, cfg, deps);
    void semantic.build();
    return semantic;
  }

  /** Resolves when the initial build has finished (tests and progress checks). */
  private buildDone: Promise<void> = Promise.resolve();

  ready(): Promise<void> {
    return this.buildDone;
  }

  private build(): Promise<void> {
    this.buildDone = this.buildInner().catch((err) => {
      this.log?.error('semantic build failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
    return this.buildDone;
  }

  private async buildInner(): Promise<void> {
    const t0 = performance.now();
    const cached = await loadCache(this.paths, this.embedder.id, this.embedder.dim);
    const ids = [...this.ctx.notes.keys()];
    this.progress = { state: 'building', done: 0, total: ids.length };
    let reused = 0;
    let sinceYield = 0;
    for (const id of ids) {
      if (this.stopped) return;
      // A watcher-driven re-embed may have processed this note already;
      // never overwrite fresh vectors with build-time ones.
      if (!this.hashes.has(id)) {
        const note = this.ctx.notes.get(id);
        if (note) {
          const hash = contentHash(note.raw);
          const cachedVecs = cached?.hashes.get(id) === hash ? cached.vectors.get(id) : undefined;
          if (cachedVecs !== undefined && cachedVecs.length > 0) {
            this.store.setNote(id, cachedVecs);
            reused++;
          } else {
            this.store.setNote(id, this.embedNote(note));
            if (++sinceYield >= this.yieldEvery) {
              sinceYield = 0;
              await new Promise((r) => setImmediate(r));
            }
          }
          this.hashes.set(id, hash);
        }
      }
      if (this.progress.state === 'building') this.progress.done++;
    }
    this.progress = { state: 'ready' };
    this.log?.info('semantic index ready', {
      notes: this.store.noteCount,
      chunks: this.store.chunkCount,
      reusedFromCache: reused,
      buildMs: Math.round(performance.now() - t0),
    });
    if (reused < this.store.noteCount) await this.save();
  }

  private embedNote(note: Pick<IndexedNote, 'title' | 'body'>): Float32Array {
    const chunks = chunkNote(note.title, note.body);
    const dim = this.embedder.dim;
    const packed = new Float32Array(chunks.length * dim);
    for (let i = 0; i < chunks.length; i++) {
      packed.set(this.embedder.embed((chunks[i] as { text: string }).text), i * dim);
    }
    return packed;
  }

  embedQuery(query: string): Float32Array {
    return this.embedder.embed(query);
  }

  /** Watcher hook: a note was added or changed (ctx.notes is already fresh). */
  noteChanged(path: string): void {
    if (this.stopped) return;
    const existing = this.pending.get(path);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.pending.delete(path);
      this.reembed(path);
    }, this.debounceMs);
    timer.unref?.();
    this.pending.set(path, timer);
  }

  /** Watcher hook: a note was deleted. */
  noteRemoved(path: string): void {
    const existing = this.pending.get(path);
    if (existing) {
      clearTimeout(existing);
      this.pending.delete(path);
    }
    if (this.hashes.has(path) || this.store.getNote(path)) {
      this.store.removeNote(path);
      this.hashes.delete(path);
      this.scheduleSave();
    }
  }

  private reembed(path: string): void {
    const note = this.ctx.notes.get(path);
    if (!note) return;
    const hash = contentHash(note.raw);
    if (this.hashes.get(path) === hash) return;
    this.store.setNote(path, this.embedNote(note));
    this.hashes.set(path, hash);
    this.log?.debug('semantic re-embed', { path });
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined;
      void this.save();
    }, this.saveDebounceMs);
    this.saveTimer.unref?.();
  }

  private async save(): Promise<void> {
    if (this.stopped) return;
    try {
      await saveCache(
        this.paths,
        this.embedder.id,
        this.embedder.dim,
        this.store.entries(),
        this.hashes,
      );
      this.log?.debug('semantic cache saved', { notes: this.store.noteCount });
    } catch (err) {
      // Cache persistence is an optimization — never let it break the server.
      this.log?.warn('semantic cache save failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Tear down timers (tests; the process otherwise runs for the session). */
  stop(): void {
    this.stopped = true;
    for (const timer of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
  }
}
