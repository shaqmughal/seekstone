import { frontmatterAliases } from '@seekstone/core/extract';
import { z } from 'zod';
import type { ServerContext } from '../context.js';
import type { ResolveCandidate } from '../index/resolve.js';
import { resolveCandidates } from '../index/resolve.js';
import { editDistance } from '../index/tags.js';

export const ResolveNoteInput = z.object({
  reference: z
    .string()
    .min(1)
    .describe(
      'Reference to resolve: a vault-relative path ("Projects/Core.md"), a path without extension, a bare note name ("Core"), or a frontmatter alias.',
    ),
});
export type ResolveNoteInput = z.infer<typeof ResolveNoteInput>;

export interface ResolveNoteResult {
  reference: string;
  /** Candidates in resolution order — matches[0] is what a wikilink with this target resolves to. */
  matches: ResolveCandidate[];
  ambiguous: boolean;
  /** Closest existing note names/aliases when nothing matched. */
  didYouMean?: string[];
}

const MAX_SUGGESTIONS = 3;

/**
 * Existing basenames and aliases closest to an unresolved reference — same
 * typo budget and shape as the unknown-tag suggestions (index/tags.ts).
 */
function suggestReferences(ctx: ServerContext, reference: string): string[] {
  const wanted = reference.toLowerCase();
  const counts = new Map<string, number>();
  for (const [path, note] of ctx.notes) {
    const base = path.replace(/\.md$/i, '').split('/').pop();
    const names = base ? [base, ...frontmatterAliases(note.fm)] : frontmatterAliases(note.fm);
    for (const name of new Set(names)) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  const budget = Math.max(2, Math.ceil(wanted.length / 3));
  const scored: { name: string; dist: number; count: number }[] = [];
  for (const [name, count] of counts) {
    const dist = editDistance(wanted, name.toLowerCase());
    if (dist <= budget) scored.push({ name, dist, count });
  }
  scored.sort((a, b) => a.dist - b.dist || b.count - a.count || a.name.localeCompare(b.name));
  return scored.slice(0, MAX_SUGGESTIONS).map((s) => s.name);
}

export function resolveNote(ctx: ServerContext, input: ResolveNoteInput): ResolveNoteResult {
  const matches = resolveCandidates(input.reference, ctx.notes);
  const result: ResolveNoteResult = {
    reference: input.reference,
    matches,
    ambiguous: matches.length > 1,
  };
  if (matches.length === 0) {
    const didYouMean = suggestReferences(ctx, input.reference);
    if (didYouMean.length > 0) result.didYouMean = didYouMean;
  }
  return result;
}
