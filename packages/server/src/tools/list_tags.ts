import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { cachedByGeneration } from '../index/generation.js';

export const ListTagsInput = z.object({
  pattern: z
    .string()
    .optional()
    .describe('Substring filter on tag name. Example: "work" matches "work" and "area/work".'),
  minCount: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Only return tags used in at least this many notes.'),
  sort: z
    .enum(['count', 'name'])
    .default('count')
    .describe('Sort by usage count descending (default) or alphabetically.'),
});
export type ListTagsInput = z.infer<typeof ListTagsInput>;

export interface TagEntry {
  tag: string;
  count: number;
  parent?: string;
}

export interface ListTagsResult {
  tags: TagEntry[];
  total: number;
}

interface TagCounts {
  /** Every tag, in first-seen order. */
  entries: TagEntry[];
  /** Every tag, by count descending then name. */
  byCount: TagEntry[];
  /** The same entries by name; sorted on first use. */
  byName?: TagEntry[];
}

/** Count every tag in the vault. Cached per index generation. */
function tagCounts(ctx: ServerContext): TagCounts {
  return cachedByGeneration(ctx, 'list_tags', () => {
    const counts = new Map<string, number>();
    for (const note of ctx.notes.values()) {
      for (const tag of note.tags.split(' ')) {
        if (tag === '') continue;
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    const entries: TagEntry[] = [];
    for (const [tag, count] of counts) {
      const slashIdx = tag.lastIndexOf('/');
      const entry: TagEntry = { tag, count };
      if (slashIdx !== -1) entry.parent = tag.slice(0, slashIdx);
      entries.push(entry);
    }
    const byCount = [...entries].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    return { entries, byCount };
  });
}

export function listTags(ctx: ServerContext, input: ListTagsInput): ListTagsResult {
  const cached = tagCounts(ctx);
  let sorted = cached.byCount;
  if (input.sort === 'name') {
    cached.byName ??= [...cached.entries].sort((a, b) => a.tag.localeCompare(b.tag));
    sorted = cached.byName;
  }

  // Filters run on the cached counts, so every filter shares one cache entry.
  // Entries are copied so a caller can't change the cache through the result.
  const tags: TagEntry[] = [];
  for (const entry of sorted) {
    if (input.pattern !== undefined && !entry.tag.includes(input.pattern)) continue;
    if (input.minCount !== undefined && entry.count < input.minCount) continue;
    tags.push({ ...entry });
  }

  return { tags, total: tags.length };
}
