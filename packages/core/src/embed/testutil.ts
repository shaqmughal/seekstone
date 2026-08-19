/**
 * Test-only builders for the embed module: a synthetic safetensors buffer and
 * a miniature WordPiece tokenizer.json, so unit tests never need the real
 * (downloaded) model files. Imported by *.test.ts only — never by runtime code.
 */

/**
 * Serialize named F32 matrices into a valid safetensors buffer.
 * `padHeader` appends spaces to the JSON header (allowed by the spec) to
 * shift the data section off 4-byte alignment.
 */
export function makeTestSafetensors(
  tensors: Record<string, number[][]>,
  opts: { padHeader?: number; dtype?: string } = {},
): Uint8Array {
  const dtype = opts.dtype ?? 'F32';
  const header: Record<string, { dtype: string; shape: number[]; data_offsets: [number, number] }> =
    {};
  const blobs: Float32Array[] = [];
  let offset = 0;
  for (const [name, rows] of Object.entries(tensors)) {
    const cols = rows[0]?.length ?? 0;
    const flat = new Float32Array(rows.flat());
    header[name] = {
      dtype,
      shape: [rows.length, cols],
      data_offsets: [offset, offset + flat.byteLength],
    };
    blobs.push(flat);
    offset += flat.byteLength;
  }
  let headerJson = JSON.stringify(header);
  if (opts.padHeader) headerJson += ' '.repeat(opts.padHeader);
  const headerBytes = new TextEncoder().encode(headerJson);

  const out = new Uint8Array(8 + headerBytes.length + offset);
  new DataView(out.buffer).setBigUint64(0, BigInt(headerBytes.length), true);
  out.set(headerBytes, 8);
  let cursor = 8 + headerBytes.length;
  for (const blob of blobs) {
    out.set(new Uint8Array(blob.buffer, 0, blob.byteLength), cursor);
    cursor += blob.byteLength;
  }
  return out;
}

/**
 * 10-token WordPiece vocab shaped like the real potion tokenizer.json
 * (BertNormalizer + BertPreTokenizer + WordPiece, specials in added_tokens).
 */
export const MINI_TOKENIZER_JSON = {
  normalizer: {
    type: 'BertNormalizer',
    clean_text: true,
    handle_chinese_chars: true,
    strip_accents: null,
    lowercase: true,
  },
  pre_tokenizer: { type: 'BertPreTokenizer' },
  added_tokens: [
    { id: 0, content: '[PAD]', special: true },
    { id: 1, content: '[UNK]', special: true },
    { id: 2, content: '[CLS]', special: true },
    { id: 3, content: '[SEP]', special: true },
  ],
  model: {
    type: 'WordPiece',
    unk_token: '[UNK]',
    continuing_subword_prefix: '##',
    max_input_chars_per_word: 100,
    vocab: {
      '[PAD]': 0,
      '[UNK]': 1,
      '[CLS]': 2,
      '[SEP]': 3,
      hello: 4,
      world: 5,
      wind: 6,
      '##mill': 7,
      '.': 8,
      ',': 9,
    },
  },
};
