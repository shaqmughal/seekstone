/**
 * Link / URL / tag extractors. These run on note *bodies* (post-frontmatter)
 * so frontmatter values don't double-count as inline content.
 *
 * Heuristics here intentionally lean toward "what Obsidian sees" rather than
 * full CommonMark parsing — we're profiling shape, not rendering. The regexes
 * are deliberately tolerant of code-fence content; counts are reported with
 * that caveat in the README.
 */

export interface Wikilink {
  /** Raw target before `#` and `|`. May include path segments. */
  target: string;
  /** Optional heading/block reference (`#heading` or `#^block`). */
  fragment: string | null;
  /** Optional display alias. */
  alias: string | null;
}

const WIKILINK_RE = /\[\[([^\]|#\n]+)(#[^\]|\n]+)?(\|[^\]\n]+)?\]\]/g;
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
  const out: string[] = [];
  for (const m of body.matchAll(URL_RE)) {
    // Strip trailing punctuation that almost certainly isn't part of the URL.
    out.push((m[0] ?? '').replace(/[.,;:!?)]+$/, ''));
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
