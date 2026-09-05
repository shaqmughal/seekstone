/**
 * "Shipped-path" eval conditions: run golden-set queries through the
 * server's actual search tool with mode semantic/hybrid — the exact code
 * users get — rather than the harness's own rankers. Uses the real model
 * and the real per-vault embedding cache (so repeated eval runs also
 * exercise the warm-cache load path).
 */
import { basename } from 'node:path';
import type { Embedder } from '@seekstone/core/embed';
import type { ServerContext } from '../../../server/src/context.js';
import { Semantic } from '../../../server/src/semantic/state.js';
import { search as searchTool } from '../../../server/src/tools/search.js';

export interface ShippedHandle {
  rank: (mode: 'semantic' | 'hybrid') => (query: string) => string[];
  buildMs: number;
  stop: () => void;
}

export async function buildShipped(
  ctx: ServerContext,
  modelDir: string,
  cacheDir: string,
  loadModel?: (modelDir: string) => Promise<Embedder>,
): Promise<ShippedHandle> {
  const t0 = performance.now();
  const semantic = await Semantic.start(
    ctx,
    { modelId: basename(modelDir), modelDir, cacheDir },
    { loadModel },
  );
  await semantic.ready();
  return {
    // One handle per model shares the single server ctx (SHA-323), so each
    // call re-points ctx.semantic at this handle's index before searching.
    rank: (mode) => (query) => {
      ctx.semantic = semantic;
      return searchTool(ctx, { query, mode, limit: 50 }).map((h) => h.path);
    },
    buildMs: performance.now() - t0,
    stop: () => semantic.stop(),
  };
}
