import { extractExcerpt } from '../index/excerpt.js';

/**
 * Excerpt for a semantic hit: slice the winning chunk's span out of the
 * note's in-memory body (spans were recorded at embed time, so there is no
 * re-chunking on the query path) and excerpt within it. Query terms often
 * don't literally appear in a semantic match, in which case extractExcerpt
 * falls back to the START of the matching chunk — the relevant passage —
 * instead of the head of the note.
 */
export function chunkExcerpt(
  body: string,
  span: { start: number; end: number },
  terms: string[],
  maxLen: number,
): string {
  // Spans are offsets into the CRLF-normalized body (chunkNote normalizes).
  const normalized = body.includes('\r') ? body.replace(/\r\n/g, '\n') : body;
  // The note may have changed inside the re-embed debounce window — clamp.
  const start = Math.min(span.start, normalized.length);
  const end = Math.min(Math.max(span.end, start), normalized.length);
  const text = start === end ? normalized : normalized.slice(start, end);
  return extractExcerpt(text, terms, maxLen);
}
