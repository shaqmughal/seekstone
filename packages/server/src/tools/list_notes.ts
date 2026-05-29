import { z } from 'zod';
import type { ServerContext } from '../context.js';

export const ListNotesInput = z.object({
  folder: z
    .string()
    .optional()
    .describe(
      'Vault-relative folder prefix to list. Omit for all notes. Example: "Daily Notes/2026".',
    ),
  tag: z.string().optional().describe('Filter by tag. Include or omit the leading #.'),
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
  const tag = input.tag?.replace(/^#/, '');
  const results: NoteEntry[] = [];

  for (const [path, note] of ctx.notes) {
    if (input.folder && !path.startsWith(input.folder)) continue;
    if (tag) {
      const noteTags = note.tags.split(' ').filter(Boolean);
      if (!noteTags.includes(tag)) continue;
    }
    results.push({
      path,
      title: note.title,
      tags: note.tags.split(' ').filter(Boolean),
      sizeBytes: note.sizeBytes,
    });
    if (results.length >= input.limit) break;
  }

  return results.sort((a, b) => a.path.localeCompare(b.path));
}
