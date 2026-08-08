/**
 * Link / URL / tag extractors. Most run on note *bodies* (post-frontmatter)
 * so frontmatter values don't double-count as inline content;
 * `extractLinksWithLines` takes the full raw note and handles the
 * frontmatter block YAML-aware.
 *
 * Heuristics here intentionally lean toward "what Obsidian sees" rather than
 * full CommonMark parsing — we're profiling shape, not rendering. The regexes
 * are deliberately tolerant of code-fence content; counts are reported with
 * that caveat in the README.
 */
import { parseDocument, visit } from 'yaml';
import { parseFrontmatter } from './frontmatter.js';

export interface Wikilink {
  /** Raw target before `#` and `|`. May include path segments. */
  target: string;
  /** Optional heading/block reference (`#heading` or `#^block`). */
  fragment: string | null;
  /** Optional display alias. */
  alias: string | null;
}

// Quantifiers are bounded at 512 chars — well above any real Obsidian note name
// or heading (~255 byte OS limit) — to eliminate O(n²) backtracking on
// pathological inputs where many [[... sequences appear with no closing ]].
const WIKILINK_RE = /\[\[([^\]|#\n]{1,512})(#[^\]|\n]{1,512})?(\|[^\]\n]{1,512})?\]\]/g;

// Matches both embeds (![[...]]) and plain wikilinks ([[...]]).
const LINK_WITH_LINES_RE =
  /(!?\[\[)([^\]|#\n]{1,512})(#[^\]|\n]{1,512})?(\|[^\]\n]{1,512})?(\]\])/g;

export type LinkType = 'wikilink' | 'embed';

export interface LinkRecord {
  /**
   * Full raw match, e.g. "[[Note Name|alias]]" or "![[embed.png]]". For links
   * found inside folded frontmatter scalars this is the *parsed* (unfolded)
   * text, which may differ from the source bytes.
   */
  raw: string;
  /** Raw target before `#` and `|`. */
  target: string;
  fragment: string | null;
  alias: string | null;
  linkType: LinkType;
  /**
   * 1-indexed line number in the source file. Links inside multi-line
   * frontmatter scalars are attributed to the line where the scalar begins.
   */
  line: number;
}

/**
 * Extract all wikilinks and embeds from a raw note (including frontmatter),
 * annotating each with its 1-indexed line number.
 *
 * The frontmatter block is parsed as YAML and its string values walked, so
 * links split across lines by scalar folding (yaml's default 80-col wrap —
 * hand edits, other tools, or pre-0.12.1 seekstone) still extract: folding
 * turns the newline back into a space on parse. Malformed frontmatter falls
 * back to per-line regex over the block, matching the body treatment.
 */
export function extractLinksWithLines(raw: string): LinkRecord[] {
  const fm = parseFrontmatter(raw);
  // bodyStart 0 covers both "no frontmatter" and "unterminated frontmatter"
  // (where the whole file is treated as body).
  if (!fm.present || fm.bodyStart === 0) return linksFromLines(raw, 1);

  const fmRegion = raw.slice(0, fm.bodyStart);
  const out = frontmatterLinks(fmRegion, fm.malformed);
  const bodyFirstLine = countNewlines(fmRegion) + 1;
  linksFromLinesInto(out, fm.body, bodyFirstLine);
  return out;
}

function linksFromLines(text: string, firstLine: number): LinkRecord[] {
  const out: LinkRecord[] = [];
  linksFromLinesInto(out, text, firstLine);
  return out;
}

function linksFromLinesInto(out: LinkRecord[], text: string, firstLine: number): void {
  const lines = text.split('\n');
  for (const [lineIdx, lineText] of lines.entries()) {
    matchLinksInto(out, lineText, firstLine + lineIdx);
  }
}

function matchLinksInto(out: LinkRecord[], text: string, line: number): void {
  for (const m of text.matchAll(LINK_WITH_LINES_RE)) {
    const prefix = m[1] ?? '';
    out.push({
      raw: m[0] ?? '',
      target: (m[2] ?? '').trim(),
      fragment: m[3] ? m[3].slice(1).trim() : null,
      alias: m[4] ? m[4].slice(1).trim() : null,
      linkType: prefix.startsWith('!') ? 'embed' : 'wikilink',
      line,
    });
  }
}

/**
 * Walk the frontmatter block's string values via the YAML AST. `fmRegion` is
 * the full block including both `---` delimiter lines. Keys are skipped —
 * Obsidian doesn't treat property names as links.
 */
function frontmatterLinks(fmRegion: string, malformed: boolean): LinkRecord[] {
  if (malformed) return linksFromLines(fmRegion, 1);

  // Strip the delimiters: yaml content starts after the opening `---` line and
  // ends before the closing `---` line (parseDocument would read a bare `---`
  // as a document marker).
  const yamlStart = fmRegion.indexOf('\n') + 1;
  const closeLen = fmRegion.endsWith('---\r\n') ? 5 : 4;
  const yamlText = fmRegion.slice(yamlStart, fmRegion.length - closeLen);

  const doc = parseDocument(yamlText);
  if (doc.errors.length > 0) return linksFromLines(fmRegion, 1);

  const out: LinkRecord[] = [];
  visit(doc, {
    Scalar(key, node) {
      if (key === 'key') return;
      if (typeof node.value !== 'string' || node.range == null) return;
      // Opening `---` is line 1, so yamlText's first line is file line 2.
      const line = 2 + countNewlines(yamlText.slice(0, node.range[0]));
      matchLinksInto(out, node.value, line);
    },
  });
  return out;
}

function countNewlines(text: string): number {
  let n = 0;
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) n++;
  return n;
}
const URL_RE = /https?:\/\/[^\s<>"')]+/g;
// Obsidian inline tag: must start with letter or underscore, then word chars, /, -.
// Must not be immediately preceded by `]` (avoids matching `]#` from links) or be
// inside a numeric-only token like `#123` (Obsidian rejects pure-digit tags).
const INLINE_TAG_RE = /(?:^|[^\w\]/])#([A-Za-z_][\w/-]*)/g;

export function extractWikilinks(body: string): Wikilink[] {
  const out: Wikilink[] = [];
  for (const m of body.matchAll(WIKILINK_RE)) {
    out.push({
      target: (m[1] ?? '').trim(),
      fragment: m[2] ? m[2].slice(1).trim() : null,
      alias: m[3] ? m[3].slice(1).trim() : null,
    });
  }
  return out;
}

export function extractUrls(body: string): string[] {
  const TRAILING_PUNCT = '.,;:!?)';
  const out: string[] = [];
  for (const m of body.matchAll(URL_RE)) {
    // Strip trailing punctuation with a backward walk — avoids the O(n²)
    // backtracking that /[.,;:!?)]+$/ exhibits on strings with many punct chars.
    const raw = m[0] ?? '';
    let end = raw.length;
    while (end > 0 && TRAILING_PUNCT.includes(raw.charAt(end - 1))) end--;
    out.push(raw.slice(0, end));
  }
  return out;
}

export function extractInlineTags(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(INLINE_TAG_RE)) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

/**
 * Pull tags out of a parsed frontmatter object. Obsidian accepts `tags:` or
 * `tag:`, as either a string (space- or comma-separated) or a list.
 */
export function frontmatterTags(fm: Record<string, unknown> | null): string[] {
  if (!fm) return [];
  const raw = fm.tags ?? fm.tag;
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((t): t is string => typeof t === 'string').map((t) => t.replace(/^#/, ''));
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((t) => t.replace(/^#/, ''));
  }
  return [];
}
