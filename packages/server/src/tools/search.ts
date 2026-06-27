import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { extractExcerpt } from '../index/excerpt.js';
import type { SearchHit } from '../index/types.js';

export const SearchInput = z.object({
  query: z.string().min(1).describe('Search query. Supports fuzzy matching and prefix search.'),
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

/** Basename without extension — the title is omitted from a hit when it matches this. */
function basenameNoExt(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

export function search(ctx: ServerContext, input: SearchInput): SearchHit[] {
  const results = ctx.index.search(input.query, {
    boost: { title: 3, tags: 2, body: 1 },
    fuzzy: 0.2,
    prefix: true,
  });

  const terms = input.query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const hits: SearchHit[] = [];
  for (const r of results) {
    if (input.folder && !r.id.startsWith(input.folder)) continue;
    if (input.tag) {
      const note = ctx.notes.get(r.id);
      if (!note) continue;
      const noteTags = note.tags.split(' ');
      if (!noteTags.some((t) => t === input.tag || t === input.tag?.replace(/^#/, ''))) continue;
    }

    const note = ctx.notes.get(r.id);
    const body = note?.body ?? '';
    const noteTags = note?.tags ? note.tags.split(' ').filter(Boolean) : [];

    const title = r.title as string;
    const hit: SearchHit = {
      path: r.id,
      // Round the raw MiniSearch score: 2 decimals preserve relevance gaps without 17-digit float tax.
      score: Math.round(r.score * 100) / 100,
      excerpt: extractExcerpt(body, terms, input.excerptLength ?? 120),
    };
    // Omit redundant/empty metadata to keep the payload lean (both are recoverable).
    if (title && title !== basenameNoExt(r.id)) hit.title = title;
    if (noteTags.length > 0) hit.tags = noteTags;
    hits.push(hit);

    if (hits.length >= input.limit) break;
  }

  return hits;
}
