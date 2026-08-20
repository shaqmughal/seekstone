import { chunkNote } from '@seekstone/core/embed';
import { extractExcerpt } from '../index/excerpt.js';

/**
 * Excerpt for a semantic hit: re-chunk the note's in-memory body with the
 * same chunker the index used, take the winning chunk, and excerpt within
 * it. Query terms often don't literally appear in a semantic match, in
 * which case extractExcerpt falls back to the START of the matching chunk —
 * the relevant passage — instead of the head of the note.
 */
export function chunkExcerpt(
  note: { title: string; body: string },
  chunkIndex: number,
  terms: string[],
  maxLen: number,
): string {
  const chunks = chunkNote(note.title, note.body);
  // The note may have changed between embedding and query (debounce window);
  // clamp rather than crash.
  const chunk = chunks[Math.min(Math.max(chunkIndex, 0), chunks.length - 1)];
  if (!chunk) return '';
  const prefix = `${note.title}\n\n`;
  const text = chunk.text.startsWith(prefix) ? chunk.text.slice(prefix.length) : chunk.text;
  return extractExcerpt(text, terms, maxLen);
}
