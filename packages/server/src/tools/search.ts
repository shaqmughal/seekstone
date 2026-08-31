import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { extractExcerpt } from '../index/excerpt.js';
import type { SearchHit } from '../index/types.js';
import { chunkExcerpt } from '../semantic/excerpt.js';
import { MAX_ROUTE_WORDS, queryWords, routeToLexical } from '../semantic/route.js';
import type { Semantic } from '../semantic/state.js';

export const SearchInput = z.object({
  query: z.string().min(1).describe('Search query. Supports fuzzy matching and prefix search.'),
  // Optional (not .default()) so the inferred type keeps existing direct
  // callers compiling; search() itself defaults it to 'lexical'.
  mode: z
    .enum(['lexical', 'semantic', 'hybrid'])
    .optional()
    .describe(
      'lexical = keyword search (default). semantic = meaning-based search over local embeddings (requires SEEKSTONE_SEMANTIC=1 and a fetched model). hybrid = exact-title lookups go lexical, everything else semantic.',
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe('Maximum number of results to return.'),
  folder: z
    .string()
    .optional()
    .describe('Restrict results to notes under this vault-relative folder prefix.'),
  tag: z.string().optional().describe('Restrict results to notes containing this tag.'),
  excerptLength: z
    .number()
    .int()
    .min(20)
    .max(2000)
    .optional()
    .describe(
      'Max characters of match context per hit (default 120). Lower trims payload; higher gives more context.',
    ),
});
export type SearchInput = z.infer<typeof SearchInput>;

/** Semantic candidates fetched before folder/tag filtering (the schema's limit max). */
const SEMANTIC_CANDIDATES = 50;

/** Basename without extension — the title is omitted from a hit when it matches this. */
export function basenameNoExt(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

export function search(ctx: ServerContext, input: SearchInput): SearchHit[] {
  // Direct in-process callers bypass the zod defaults — normalize here.
  const mode = input.mode ?? 'lexical';
  if (mode === 'lexical') return lexicalSearch(ctx, input);

  const semantic = requireSemantic(ctx);
  if (mode === 'semantic') return semanticSearch(ctx, semantic, input);

  // hybrid: an exact-title lookup goes lexical; everything else semantic.
  // Long queries can't plausibly be a title, so they skip MiniSearch entirely
  // (fuzzy matching on long queries is the expensive path).
  const words = queryWords(input.query);
  if (words.length > 0 && words.length <= MAX_ROUTE_WORDS) {
    const lexHits = lexicalSearch(ctx, input);
    if (
      routeToLexical(
        input.query,
        lexHits.map((h) => h.path),
      )
    )
      return lexHits;
  }
  return semanticSearch(ctx, semantic, input);
}

function requireSemantic(ctx: ServerContext): Semantic {
  if (!ctx.semantic) {
    throw new Error(
      JSON.stringify({
        error: 'semantic_unavailable',
        hint: 'Semantic search is not enabled. Set SEEKSTONE_SEMANTIC=1 in the server env and run `npx -y seekstone fetch-model` once to download the local embedding model, then restart the session. Meanwhile, mode: "lexical" works.',
      }),
    );
  }
  const progress = ctx.semantic.progress;
  if (progress.state === 'building') {
    throw new Error(
      JSON.stringify({
        error: 'semantic_building',
        done: progress.done,
        total: progress.total,
        hint: 'The semantic index is still embedding this vault (first run only — later runs load a cache). Retry shortly, or use mode: "lexical".',
      }),
    );
  }
  return ctx.semantic;
}

function searchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function lexicalSearch(ctx: ServerContext, input: SearchInput): SearchHit[] {
  const results = ctx.index.search(input.query, {
    boost: { title: 3, tags: 2, body: 1 },
    fuzzy: 0.2,
    prefix: true,
  });
  const terms = searchTerms(input.query);

  const hits: SearchHit[] = [];
  for (const r of results) {
    const note = filterNote(ctx, input, r.id);
    if (!note) continue;
    const hit: SearchHit = {
      path: r.id,
      // Round the raw MiniSearch score: 2 decimals preserve relevance gaps without 17-digit float tax.
      score: Math.round(r.score * 100) / 100,
      excerpt: extractExcerpt(note.body, terms, input.excerptLength ?? 120),
    };
    decorate(hit, r.title as string, note.tags);
    hits.push(hit);
    if (hits.length >= input.limit) break;
  }
  return hits;
}

function semanticSearch(ctx: ServerContext, semantic: Semantic, input: SearchInput): SearchHit[] {
  const queryVec = semantic.embedQuery(input.query);
  // Stage 1: pooled cosine top-50; stage 2: MaxSim rerank (SHA-314).
  // 1-hop graph expansion (semantic/expand.ts) is deliberately NOT wired in:
  // the SHA-315 dev-split eval could not measure a gain on the committed
  // fixture (its links are random by design) — see EXPANSION-SHA-315.md.
  const candidates = semantic.rerank(
    input.query,
    semantic.store.topNotes(queryVec, SEMANTIC_CANDIDATES),
  );
  const terms = searchTerms(input.query);

  const hits: SearchHit[] = [];
  for (const c of candidates) {
    const note = filterNote(ctx, input, c.path);
    if (!note) continue;
    const hit: SearchHit = {
      path: c.path,
      // Cosine similarity ∈ [-1, 1]: 3 decimals keep the ranking legible.
      score: Math.round(c.score * 1000) / 1000,
      excerpt: chunkExcerpt(note.body, c, terms, input.excerptLength ?? 120),
    };
    decorate(hit, note.title, note.tags);
    hits.push(hit);
    if (hits.length >= input.limit) break;
  }
  return hits;
}

/** Apply folder/tag filters; returns the note when it passes, else undefined. */
function filterNote(ctx: ServerContext, input: SearchInput, path: string) {
  if (input.folder && !path.startsWith(input.folder)) return undefined;
  const note = ctx.notes.get(path);
  if (!note) return undefined;
  if (input.tag) {
    const noteTags = note.tags.split(' ');
    if (!noteTags.some((t) => t === input.tag || t === input.tag?.replace(/^#/, ''))) {
      return undefined;
    }
  }
  return note;
}

function decorate(hit: SearchHit, title: string, tags: string): void {
  // Omit redundant/empty metadata to keep the payload lean (both are recoverable).
  if (title && title !== basenameNoExt(hit.path)) hit.title = title;
  const noteTags = tags ? tags.split(' ').filter(Boolean) : [];
  if (noteTags.length > 0) hit.tags = noteTags;
}
