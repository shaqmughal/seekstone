/**
 * Lexical ranking via the server's own MiniSearch machinery, called
 * in-process exactly like the seekstone bench adapter — same boosts
 * (title 3, tags 2, body 1), fuzzy 0.2, prefix matching.
 */
import type { ServerContext } from '../../../server/src/context.js';
import { buildIndex } from '../../../server/src/index/build.js';
import { PERMISSIVE_POLICY } from '../../../server/src/policy.js';
import { search as searchTool } from '../../../server/src/tools/search.js';

export interface LexicalContext {
  ctx: ServerContext;
  noteCount: number;
  buildMs: number;
}

export async function buildLexicalContext(vaultRoot: string): Promise<LexicalContext> {
  const { index, notes, backlinks, buildMs } = await buildIndex(vaultRoot);
  const ctx: ServerContext = { vaultRoot, index, notes, backlinks, policy: PERMISSIVE_POLICY };
  return { ctx, noteCount: notes.size, buildMs };
}

/**
 * Top-`limit` note paths for a query. Direct tool calls bypass the zod
 * schema, so the limit is passed explicitly; 50 is the SearchInput maximum
 * and the retrieval depth every eval condition uses.
 */
export function rankLexical(ctx: ServerContext, query: string, limit = 50): string[] {
  return rankLexicalScored(ctx, query, limit).map((h) => h.path);
}

/** Like rankLexical but keeps MiniSearch scores (needed by score fusion). */
export function rankLexicalScored(
  ctx: ServerContext,
  query: string,
  limit = 50,
): Array<{ path: string; score: number }> {
  // Index doc ids carry the platform separator (walkVault uses path.relative);
  // golden-set paths are forward-slash canonical, so normalize here.
  return searchTool(ctx, { query, limit }).map((h) => ({
    path: h.path.replace(/\\/g, '/'),
    score: h.score,
  }));
}
