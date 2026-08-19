/**
 * Minimal WordPiece tokenizer for Model2Vec models — implements the subset of
 * the HF `tokenizer.json` contract the potion models use: BertNormalizer →
 * BertPreTokenizer → WordPiece. The [CLS]/[SEP] post-processor is deliberately
 * NOT applied: Model2Vec pools raw word tokens only.
 */

interface BertNormalizerJson {
  type?: string;
  clean_text?: boolean;
  handle_chinese_chars?: boolean;
  strip_accents?: boolean | null;
  lowercase?: boolean;
}

interface WordPieceModelJson {
  type?: string;
  unk_token?: string;
  continuing_subword_prefix?: string;
  max_input_chars_per_word?: number;
  vocab?: Record<string, number>;
}

interface TokenizerJson {
  normalizer?: BertNormalizerJson | null;
  added_tokens?: Array<{ id: number; content: string; special?: boolean }>;
  model?: WordPieceModelJson;
}

export interface WordPieceTokenizer {
  encode(text: string): number[];
  readonly vocabSize: number;
  readonly unkId: number;
  /** Ids of tokens flagged `special` in tokenizer.json ([PAD], [UNK], [CLS], …). */
  readonly specialIds: ReadonlySet<number>;
}

export function loadWordPieceTokenizer(tokenizerJson: unknown): WordPieceTokenizer {
  const tj = tokenizerJson as TokenizerJson;
  const model = tj?.model;
  if (model?.type !== 'WordPiece' || !model.vocab) {
    throw new Error(
      `tokenizer: unsupported model type "${model?.type ?? 'missing'}" (only WordPiece is implemented)`,
    );
  }
  const vocab = new Map(Object.entries(model.vocab));
  const unkToken = model.unk_token ?? '[UNK]';
  const unkId = vocab.get(unkToken);
  if (unkId === undefined) {
    throw new Error(`tokenizer: unk_token "${unkToken}" is not in the vocab`);
  }
  const prefix = model.continuing_subword_prefix ?? '##';
  const maxChars = model.max_input_chars_per_word ?? 100;
  const norm: BertNormalizerJson = tj.normalizer ?? {};
  const cleanText = norm.clean_text ?? true;
  const handleCjk = norm.handle_chinese_chars ?? true;
  const lowercase = norm.lowercase ?? true;
  // HF BertNormalizer: when strip_accents is unset it follows `lowercase`.
  const stripAccents = norm.strip_accents ?? lowercase;
  const specialIds: ReadonlySet<number> = new Set(
    (tj.added_tokens ?? []).filter((t) => t.special).map((t) => t.id),
  );

  function normalize(text: string): string {
    let out = cleanText ? doCleanText(text) : text;
    if (handleCjk) out = padCjkChars(out);
    if (stripAccents) out = out.normalize('NFD').replace(/\p{Mn}/gu, '');
    if (lowercase) out = out.toLowerCase();
    return out;
  }

  function wordPiece(word: string): number[] {
    const chars = [...word];
    if (chars.length > maxChars) return [unkId as number];
    const ids: number[] = [];
    let start = 0;
    while (start < chars.length) {
      let end = chars.length;
      let id: number | undefined;
      while (start < end) {
        const piece = (start > 0 ? prefix : '') + chars.slice(start, end).join('');
        const found = vocab.get(piece);
        if (found !== undefined) {
          id = found;
          break;
        }
        end--;
      }
      // BERT semantics: any unmatchable remainder makes the whole word [UNK].
      if (id === undefined) return [unkId as number];
      ids.push(id);
      start = end;
    }
    return ids;
  }

  return {
    vocabSize: vocab.size,
    unkId,
    specialIds,
    encode(text: string): number[] {
      const ids: number[] = [];
      for (const word of preTokenize(normalize(text))) {
        for (const id of wordPiece(word)) ids.push(id);
      }
      return ids;
    },
  };
}

/** BertPreTokenizer: split on whitespace; every punctuation char is its own token. */
function preTokenize(text: string): string[] {
  const words: string[] = [];
  let cur = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    if (isWhitespace(ch, cp)) {
      if (cur) {
        words.push(cur);
        cur = '';
      }
    } else if (isPunctuation(ch, cp)) {
      if (cur) {
        words.push(cur);
        cur = '';
      }
      words.push(ch);
    } else {
      cur += ch;
    }
  }
  if (cur) words.push(cur);
  return words;
}

/** Drop control chars and U+0000/U+FFFD; fold all whitespace to a plain space. */
function doCleanText(text: string): string {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    if (cp === 0 || cp === 0xfffd || isControl(ch, cp)) continue;
    out += isWhitespace(ch, cp) ? ' ' : ch;
  }
  return out;
}

/** Surround CJK ideographs with spaces so each is tokenized in isolation. */
function padCjkChars(text: string): string {
  let out = '';
  for (const ch of text) {
    out += isCjk(ch.codePointAt(0) as number) ? ` ${ch} ` : ch;
  }
  return out;
}

function isWhitespace(ch: string, cp: number): boolean {
  if (cp === 0x20 || cp === 0x09 || cp === 0x0a || cp === 0x0d) return true;
  return /\p{Zs}/u.test(ch);
}

function isControl(ch: string, cp: number): boolean {
  if (cp === 0x09 || cp === 0x0a || cp === 0x0d) return false;
  return /\p{Cc}|\p{Cf}/u.test(ch);
}

function isPunctuation(ch: string, cp: number): boolean {
  // BERT treats all ASCII non-alphanumeric printables as punctuation, even
  // those Unicode classes as symbols ($, +, <, =, >, ^, `, |, ~).
  if (
    (cp >= 33 && cp <= 47) ||
    (cp >= 58 && cp <= 64) ||
    (cp >= 91 && cp <= 96) ||
    (cp >= 123 && cp <= 126)
  ) {
    return true;
  }
  return /\p{P}/u.test(ch);
}

function isCjk(cp: number): boolean {
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x20000 && cp <= 0x2a6df) ||
    (cp >= 0x2a700 && cp <= 0x2b73f) ||
    (cp >= 0x2b740 && cp <= 0x2b81f) ||
    (cp >= 0x2b820 && cp <= 0x2ceaf) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0x2f800 && cp <= 0x2fa1f)
  );
}
