import type { IndexedNote } from './types.js';

// Tag filters match the way Obsidian does (SHA-264): case-insensitively, with
// or without the leading `#`, and a parent tag matches its nested children
// (`project` matches `#Project` and `#project/alpha`). They used to be exact
// and case-sensitive, so a tag that differed only in case silently matched
// nothing.

/** Normalize a tag filter for matching: no leading `#`, lowercase. */
export function normalizeTag(tag: string): string {
  return tag.replace(/^#/, '').toLowerCase();
}

/** Whether a note's space-separated tag string satisfies a normalized filter. */
export function noteHasTag(noteTags: string, wanted: string): boolean {
  for (const t of noteTags.split(' ')) {
    if (!t) continue;
    const tag = t.toLowerCase();
    if (tag === wanted || tag.startsWith(`${wanted}/`)) return true;
  }
  return false;
}

/** Levenshtein distance; inputs are short tag names, so the O(n·m) table is fine. */
export function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const sub = (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, sub);
    }
    prev = cur;
  }
  return prev[b.length] ?? 0;
}

const MAX_SUGGESTIONS = 3;

/**
 * Existing vault tags closest to a filter that matched no note. Candidates are
 * every tag plus its parents (a vault with only `project/alpha` can still
 * suggest `project`, which is a valid filter). A candidate qualifies when the
 * filter is within a typo budget of the whole tag or of its last segment (so
 * `alpha` suggests `project/alpha`).
 */
export function suggestTags(notes: Iterable<IndexedNote>, wanted: string): string[] {
  const counts = new Map<string, number>();
  for (const note of notes) {
    const seen = new Set<string>();
    for (const t of note.tags.split(' ')) {
      if (!t) continue;
      const parts = t.toLowerCase().split('/');
      for (let i = 1; i <= parts.length; i++) seen.add(parts.slice(0, i).join('/'));
    }
    for (const tag of seen) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const budget = Math.max(2, Math.ceil(wanted.length / 3));
  const scored: { tag: string; dist: number; count: number }[] = [];
  for (const [tag, count] of counts) {
    const leaf = tag.slice(tag.lastIndexOf('/') + 1);
    const dist = Math.min(editDistance(wanted, tag), editDistance(wanted, leaf));
    if (dist <= budget) scored.push({ tag, dist, count });
  }
  scored.sort((a, b) => a.dist - b.dist || b.count - a.count || a.tag.localeCompare(b.tag));
  return scored.slice(0, MAX_SUGGESTIONS).map((s) => s.tag);
}

/**
 * Throw `unknown_tag` when no note in the vault carries the filtered tag.
 * Callers run this only when a tag-filtered call came back empty, so a valid
 * filter costs nothing extra and a real tag with no other matches still
 * returns an empty result.
 */
export function assertTagExists(notes: Map<string, IndexedNote>, tag: string): void {
  const wanted = normalizeTag(tag);
  for (const note of notes.values()) {
    if (noteHasTag(note.tags, wanted)) return;
  }
  const didYouMean = suggestTags(notes.values(), wanted);
  throw new Error(
    JSON.stringify({
      error: 'unknown_tag',
      tag,
      ...(didYouMean.length > 0 ? { didYouMean } : {}),
      hint: 'No note in the vault has this tag. Matching ignores case and includes nested child tags. Retry with a suggested tag, or call list_tags to see the tags that exist.',
    }),
  );
}
