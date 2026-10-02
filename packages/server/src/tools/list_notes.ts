import { z } from 'zod';
import type { ServerContext } from '../context.js';
import { assertTagExists, normalizeTag, noteHasTag } from '../index/tags.js';

export const ListNotesInput = z.object({
  folder: z
    .string()
    .optional()
    .describe(
      'Vault-relative folder prefix to list. Omit for all notes. Example: "Daily Notes/2026".',
    ),
  tag: z
    .string()
    .optional()
    .describe(
      'Filter by tag. # optional, case-insensitive, and nested child tags match (e.g. "project" matches #project/alpha).',
    ),
  limit: z.number().int().min(1).max(500).default(100).describe('Maximum number of results.'),
});
export type ListNotesInput = z.infer<typeof ListNotesInput>;

export interface NoteEntry {
  path: string;
  title: string;
  tags: string[];
  sizeBytes: number;
}

export function listNotes(ctx: ServerContext, input: ListNotesInput): NoteEntry[] {
  const tag = input.tag === undefined ? undefined : normalizeTag(input.tag);
  const results: NoteEntry[] = [];

  for (const [path, note] of ctx.notes) {
    if (input.folder && !path.startsWith(input.folder)) continue;
    if (tag && !noteHasTag(note.tags, tag)) continue;
    results.push({
      path,
      title: note.title,
      tags: note.tags.split(' ').filter(Boolean),
      sizeBytes: note.sizeBytes,
    });
    if (results.length >= input.limit) break;
  }

  // An empty tag-filtered result may be a misspelled tag: say so (SHA-264).
  if (results.length === 0 && input.tag) assertTagExists(ctx.notes, input.tag);
  return results.sort((a, b) => a.path.localeCompare(b.path));
}
