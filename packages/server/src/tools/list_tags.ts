import { z } from 'zod';
import type { ServerContext } from '../context.js';

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

export function listTags(ctx: ServerContext, input: ListTagsInput): ListTagsResult {
  const counts = new Map<string, number>();

  for (const note of ctx.notes.values()) {
    for (const tag of note.tags.split(' ').filter(Boolean)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const tags: TagEntry[] = [];
  for (const [tag, count] of counts) {
    if (input.pattern !== undefined && !tag.includes(input.pattern)) continue;
    if (input.minCount !== undefined && count < input.minCount) continue;
    const slashIdx = tag.lastIndexOf('/');
    const entry: TagEntry = { tag, count };
    if (slashIdx !== -1) entry.parent = tag.slice(0, slashIdx);
    tags.push(entry);
  }

  if (input.sort === 'name') {
    tags.sort((a, b) => a.tag.localeCompare(b.tag));
  } else {
    tags.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  return { tags, total: tags.length };
}
