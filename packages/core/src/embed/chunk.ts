/**
 * Paragraph-window chunking for note embedding.
 *
 * Notes are split on blank lines (single newlines are hard-wrap artifacts and
 * stay inside their paragraph), then adjacent paragraphs are merged greedily
 * into ~250–400-word windows. A single mean-pooled vector over a very large
 * note dilutes every topic in it — the fixture vault's tail runs to 832 KB —
 * so retrieval scores each chunk and max-pools per note.
 *
 * Each chunk also carries its `[start, end)` character span in the
 * CRLF-normalized body, so consumers (chunk-aware excerpts) can slice the
 * matching passage without re-chunking the note.
 */

export interface Chunk {
  /** Embedding input: note title, blank line, window text. */
  text: string;
  /** Word count of the window body (excludes the title). */
  words: number;
  /** Start offset of the window in the CRLF-normalized body. */
  start: number;
  /** End offset (exclusive) of the window in the CRLF-normalized body. */
  end: number;
}

interface Paragraph {
  text: string;
  words: number;
  start: number;
  end: number;
}

const MIN_WINDOW_WORDS = 250;
const MAX_WINDOW_WORDS = 400;

export function chunkNote(title: string, body: string): Chunk[] {
  const normalized = body.replace(/\r\n/g, '\n');
  const paragraphs = splitParagraphs(normalized).flatMap(splitOversized);

  if (paragraphs.length === 0) return [{ text: title, words: 0, start: 0, end: 0 }];

  const chunks: Chunk[] = [];
  let window: Paragraph[] = [];
  let windowWords = 0;
  const flush = () => {
    const first = window[0];
    const last = window[window.length - 1];
    if (!first || !last) return;
    chunks.push({
      text: `${title}\n\n${window.map((p) => p.text).join('\n\n')}`,
      words: windowWords,
      start: first.start,
      end: last.end,
    });
    window = [];
    windowWords = 0;
  };
  for (const para of paragraphs) {
    if (windowWords >= MIN_WINDOW_WORDS || windowWords + para.words > MAX_WINDOW_WORDS) flush();
    window.push(para);
    windowWords += para.words;
  }
  flush();
  return chunks;
}

/** Blank-line-delimited paragraphs with trimmed text and exact spans. */
function splitParagraphs(normalized: string): Paragraph[] {
  const out: Paragraph[] = [];
  const push = (rawStart: number, raw: string) => {
    const text = raw.trim();
    if (text.length === 0) return;
    const start = rawStart + (raw.length - raw.trimStart().length);
    out.push({ text, words: countWords(text), start, end: start + text.length });
  };
  const sep = /\n[ \t]*\n+/g;
  let prev = 0;
  for (const m of normalized.matchAll(sep)) {
    push(prev, normalized.slice(prev, m.index));
    prev = m.index + m[0].length;
  }
  push(prev, normalized.slice(prev));
  return out;
}

/**
 * Hard-split a paragraph longer than the window cap on word boundaries.
 * Piece text joins words with single spaces (identical embedding input to
 * the pre-span implementation); spans stay exact via word offsets.
 */
function splitOversized(para: Paragraph): Paragraph[] {
  if (para.words <= MAX_WINDOW_WORDS) return [para];
  const words = [...para.text.matchAll(/\S+/g)];
  const pieces: Paragraph[] = [];
  for (let i = 0; i < words.length; i += MAX_WINDOW_WORDS) {
    const slice = words.slice(i, i + MAX_WINDOW_WORDS);
    const first = slice[0];
    const last = slice[slice.length - 1];
    if (!first || !last) continue;
    pieces.push({
      text: slice.map((w) => w[0]).join(' '),
      words: slice.length,
      start: para.start + first.index,
      end: para.start + last.index + last[0].length,
    });
  }
  return pieces;
}

function countWords(text: string): number {
  const m = text.match(/\S+/g);
  return m ? m.length : 0;
}
