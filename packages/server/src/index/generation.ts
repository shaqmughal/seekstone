/**
 * Index generation: a counter on ServerContext that goes up every time the
 * note index changes (ctx.notes, a cached note's fields, or ctx.backlinks).
 * Whole-vault tools cache what they compute under the generation it was built
 * at and reuse it until the counter moves, so a repeat call on an unchanged
 * vault skips the pass over every note.
 *
 * Only the helpers in index/doc.ts and index/backlinks.ts change the index,
 * and each one bumps. `index-guard.test.ts` fails if a direct
 * `ctx.notes.set`/`delete` or `ctx.backlinks.set`/`delete` shows up anywhere
 * else.
 *
 * Caches hold aggregates (counts, lookup maps of paths and aliases), never
 * note content.
 */

import { buildResolveMaps, type ResolveMaps } from './resolve.js';

export interface Generational {
  generation: number;
}

/** Mark the index as changed. Call after (or alongside) every mutation. */
export function bumpGeneration(ctx: Generational): void {
  ctx.generation++;
}

interface Entry {
  generation: number;
  value: unknown;
}

// Keyed by the context object so ServerContext doesn't carry cache plumbing,
// and a dropped context takes its caches with it.
const caches = new WeakMap<Generational, Map<string, Entry>>();

/**
 * Return the value cached under `key` for the current generation, or build,
 * cache and return it. `build` must only read the index; it must not bump.
 */
export function cachedByGeneration<T>(ctx: Generational, key: string, build: () => T): T {
  let perCtx = caches.get(ctx);
  if (perCtx === undefined) {
    perCtx = new Map();
    caches.set(ctx, perCtx);
  }
  const hit = perCtx.get(key);
  if (hit !== undefined && hit.generation === ctx.generation) return hit.value as T;
  const value = build();
  perCtx.set(key, { generation: ctx.generation, value });
  return value;
}

/**
 * buildResolveMaps for the context's notes, built once per index generation
 * and shared by read-only callers until the index changes. Don't mutate the
 * result. Write paths that change the index mid-operation build their own.
 */
export function cachedResolveMaps(
  ctx: Generational & { notes: Map<string, unknown> },
): ResolveMaps {
  return cachedByGeneration(ctx, 'resolveMaps', () => buildResolveMaps(ctx.notes));
}
