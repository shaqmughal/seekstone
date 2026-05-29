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
});
export type SearchInput = z.infer<typeof SearchInput>;

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

    hits.push({
      path: r.id,
      title: r.title as string,
      score: r.score,
      excerpt: extractExcerpt(body, terms),
      tags: noteTags,
    });

    if (hits.length >= input.limit) break;
  }

  return hits;
}
