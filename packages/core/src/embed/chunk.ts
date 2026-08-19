/**
 * Paragraph-window chunking for note embedding.
 *
 * Notes are split on blank lines (single newlines are hard-wrap artifacts and
 * stay inside their paragraph), then adjacent paragraphs are merged greedily
 * into ~250–400-word windows. A single mean-pooled vector over a very large
 * note dilutes every topic in it — the fixture vault's tail runs to 832 KB —
 * so retrieval scores each chunk and max-pools per note.
 */

export interface Chunk {
  /** Embedding input: note title, blank line, window text. */
  text: string;
  /** Word count of the window body (excludes the title). */
  words: number;
}

const MIN_WINDOW_WORDS = 250;
const MAX_WINDOW_WORDS = 400;

export function chunkNote(title: string, body: string): Chunk[] {
  const paragraphs = body
    .replace(/\r\n/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .flatMap(splitOversized);

  if (paragraphs.length === 0) return [{ text: title, words: 0 }];

  const chunks: Chunk[] = [];
  let window: string[] = [];
  let windowWords = 0;
  const flush = () => {
    if (window.length === 0) return;
    chunks.push({ text: `${title}\n\n${window.join('\n\n')}`, words: windowWords });
    window = [];
    windowWords = 0;
  };
  for (const para of paragraphs) {
    const words = countWords(para);
    if (windowWords >= MIN_WINDOW_WORDS || windowWords + words > MAX_WINDOW_WORDS) flush();
    window.push(para);
    windowWords += words;
  }
  flush();
  return chunks;
}

/** Hard-split a paragraph longer than the window cap on word boundaries. */
function splitOversized(para: string): string[] {
  const words = para.split(/\s+/).filter((w) => w.length > 0);
  if (words.length <= MAX_WINDOW_WORDS) return [para];
  const pieces: string[] = [];
  for (let i = 0; i < words.length; i += MAX_WINDOW_WORDS) {
    pieces.push(words.slice(i, i + MAX_WINDOW_WORDS).join(' '));
  }
  return pieces;
}

function countWords(text: string): number {
  const m = text.match(/\S+/g);
  return m ? m.length : 0;
}
