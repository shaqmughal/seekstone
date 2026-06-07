import { parseFrontmatter } from './frontmatter.js';

export interface HeadingEntry {
  text: string;
  level: number;
  /** 1-based line number in the file. */
  line: number;
  /** Character offset of the leading `#` in the raw file string. */
  byteOffset: number;
  /** Characters from this heading to the next (or end of file). Only present when includeSizes is true. */
  byteLength?: number;
}

export interface BlockEntry {
  id: string;
  /** 1-based line number in the file. */
  line: number;
  /** Character offset of the `^` in the raw file string. */
  byteOffset: number;
}

export interface NoteOutline {
  headings: HeadingEntry[];
  blocks: BlockEntry[];
  /** Top-level frontmatter keys in original order (empty if no frontmatter). */
  frontmatterKeys: string[];
  /** True UTF-8 byte length of the file. */
  totalBytes: number;
}

export interface OutlineOptions {
  /** Include block-reference anchors (^id). Default true. */
  includeBlocks?: boolean;
  /** Include per-section character length in each heading entry. Default false. */
  includeSizes?: boolean;
}

const HEADING_RE = /^(#{1,6})\s+(.+)/;
const BLOCK_REF_RE = /\^([a-zA-Z0-9-]+)$/;

/**
 * Parse a note's structure — heading tree, block anchors, frontmatter keys —
 * without touching the prose. Shared by outline_note and patch_note.
 *
 * Offsets are character positions in the raw string (identical to UTF-8 byte
 * offsets for ASCII content, which covers the vast majority of vault notes).
 */
export function buildOutline(raw: string, options: OutlineOptions = {}): NoteOutline {
  const { includeBlocks = true, includeSizes = false } = options;

  const fm = parseFrontmatter(raw);
  const totalBytes = Buffer.byteLength(raw, 'utf8');
  const headings: HeadingEntry[] = [];
  const blocks: BlockEntry[] = [];

  let charOffset = 0;

  for (const [i, line] of raw.split('\n').entries()) {
    const lineCharOffset = charOffset;
    const lineNum = i + 1;

    if (charOffset >= fm.bodyStart) {
      const hm = HEADING_RE.exec(line);
      if (hm) {
        headings.push({
          text: (hm[2] ?? '').trim(),
          level: (hm[1] ?? '').length,
          line: lineNum,
          byteOffset: lineCharOffset,
        });
      }

      if (includeBlocks) {
        const trimmed = line.trimEnd();
        const bm = BLOCK_REF_RE.exec(trimmed);
        if (bm) {
          const caretPos = trimmed.lastIndexOf('^');
          blocks.push({
            id: bm[1] ?? '',
            line: lineNum,
            byteOffset: lineCharOffset + caretPos,
          });
        }
      }
    }

    charOffset += line.length + 1; // +1 for the '\n' consumed by split
  }

  if (includeSizes) {
    for (const [i, heading] of headings.entries()) {
      const next = headings[i + 1];
      heading.byteLength = (next?.byteOffset ?? raw.length) - heading.byteOffset;
    }
  }

  return { headings, blocks, frontmatterKeys: fm.keys, totalBytes };
}
