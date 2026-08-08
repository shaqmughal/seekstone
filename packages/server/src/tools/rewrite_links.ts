import { posix } from 'node:path';
import { resolveLink } from '../index/resolve.js';

/**
 * Pure link-rewriting for link-aware moves: given a referencing note's raw
 * content, rewrite every wikilink, embed, and relative/vault-absolute markdown
 * link that pointed at `oldPath` so it points at `newPath`.
 *
 * Principles:
 * - **Rewrite only what breaks.** A link is left byte-identical when it still
 *   resolves to the moved note after the move (Obsidian's shortest-unique-
 *   basename semantics — e.g. `[[Italy]]` survives a folder move unchanged).
 * - **Preserve everything around the target**: embed `!`, `#fragment`,
 *   `|alias`, `%20`-encoding and `<...>` wrapping in markdown links.
 * - **Skip fenced code blocks** (``` / ~~~). Inline backtick spans are NOT
 *   skipped — consistent with the repo's deliberately loose link parsing.
 *
 * `preNotes` is the notes map as it was before the move (oldPath present),
 * `postNotes` after (newPath present) — both are needed to decide whether a
 * link used to point at the moved note and whether it still does.
 */

// Mirrors LINK_WITH_LINES_RE in @seekstone/core/extract (same bounded
// quantifiers), split into groups for reconstruction.
const WIKI_RE = /(!?)\[\[([^\]|#\n]{1,512})(#[^\]|\n]{1,512})?(\|[^\]\n]{1,512})?\]\]/g;

// Markdown links/embeds: target is everything to the first `)` (titles like
// `[t](x "title")` are out of scope, matching the loose-parsing ethos).
const MD_RE = /(!?)\[([^\]\n]*)\]\(([^)\n]+)\)/g;

const FENCE_RE = /^\s*(```|~~~)/;

/**
 * Map `fn` over every line outside fenced code blocks (``` / ~~~), leaving
 * fence delimiters and fenced content byte-identical. Shared by the move and
 * rename-heading rewriters.
 */
export function mapUnfencedLines(raw: string, fn: (line: string) => string): string {
  let inFence = false;
  return raw
    .split('\n')
    .map((line) => {
      if (FENCE_RE.test(line)) {
        inFence = !inFence;
        return line;
      }
      return inFence ? line : fn(line);
    })
    .join('\n');
}

export interface RewriteNoteLinksResult {
  content: string;
  /** Number of individual links rewritten. */
  count: number;
}

/** Shortest target that still uniquely resolves to newPath: basename if unambiguous, else full path. */
function wikiTargetFor(newPath: string, postNotes: Map<string, unknown>): string {
  const noExt = newPath.replace(/\.md$/i, '');
  const base = noExt.split('/').pop() ?? noExt;
  // Count basename collisions directly — resolveLink picks the first match by
  // map iteration order, which is not a stable notion of "unambiguous".
  const baseLower = base.toLowerCase();
  let matches = 0;
  for (const p of postNotes.keys()) {
    const pBase = (p.replace(/\.md$/i, '').split('/').pop() ?? '').toLowerCase();
    if (pBase === baseLower && ++matches > 1) return noExt;
  }
  return base;
}

/** Interpret a markdown-link target as a vault-relative note path (or undefined). */
function mdTargetToVaultPath(rawTarget: string, sourceDir: string): string | undefined {
  let t = rawTarget.trim();
  if (t.startsWith('<') && t.endsWith('>')) t = t.slice(1, -1);
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return undefined; // http:, mailto:, obsidian:, …
  if (t.startsWith('#') || t === '') return undefined; // intra-note anchor
  const hashIdx = t.indexOf('#');
  if (hashIdx !== -1) t = t.slice(0, hashIdx);
  try {
    t = decodeURIComponent(t);
  } catch {
    /* malformed escape — use as-is */
  }
  const joined = posix.normalize(posix.join(sourceDir, t));
  if (joined.startsWith('..')) return undefined; // escapes the vault
  return joined;
}

export function rewriteNoteLinks(
  raw: string,
  sourcePath: string,
  oldPath: string,
  newPath: string,
  preNotes: Map<string, unknown>,
  postNotes: Map<string, unknown>,
): RewriteNoteLinksResult {
  const sourceDir = posix.dirname(sourcePath);
  const oldNoExt = oldPath.replace(/\.md$/i, '');
  let count = 0;

  const rewriteWikiLine = (line: string): string =>
    line.replace(WIKI_RE, (full, bang: string, target: string, frag?: string, alias?: string) => {
      const t = target.trim();
      // Still resolves to the moved note → Obsidian keeps working; don't touch.
      if (resolveLink(t, postNotes) === newPath) return full;
      // Only rewrite links that used to point at the moved note.
      if (resolveLink(t, preNotes) !== oldPath) return full;
      count++;
      const next = wikiTargetFor(newPath, postNotes);
      return `${bang}[[${next}${frag ?? ''}${alias ?? ''}]]`;
    });

  const rewriteMdLine = (line: string): string =>
    line.replace(MD_RE, (full, bang: string, text: string, rawTarget: string) => {
      // Relative-to-source interpretation first, then vault-absolute.
      const asRelative = mdTargetToVaultPath(rawTarget, sourceDir);
      const asAbsolute = mdTargetToVaultPath(rawTarget, '.');
      let vaultAbsoluteStyle: boolean;
      if (asRelative === oldPath || asRelative === oldNoExt) vaultAbsoluteStyle = false;
      else if (asAbsolute === oldPath || asAbsolute === oldNoExt) vaultAbsoluteStyle = true;
      else return full;
      count++;

      const trimmed = rawTarget.trim();
      const wrapped = trimmed.startsWith('<') && trimmed.endsWith('>');
      const inner = wrapped ? trimmed.slice(1, -1) : trimmed;
      const hashIdx = inner.indexOf('#');
      const fragment = hashIdx === -1 ? '' : inner.slice(hashIdx);
      const hadExt = /\.md(#|$)/i.test(inner);

      let next = vaultAbsoluteStyle ? newPath : posix.relative(sourceDir, newPath);
      if (!hadExt) next = next.replace(/\.md$/i, '');
      // Preserve the original encoding style for spaces; wrap in <> when the
      // new path has spaces and the original used neither style.
      if (inner.includes('%20')) next = next.replaceAll(' ', '%20');
      const needsWrap = wrapped || next.includes(' ');
      const target = needsWrap ? `<${next}${fragment}>` : `${next}${fragment}`;
      return `${bang}[${text}](${target})`;
    });

  const content = mapUnfencedLines(raw, (line) => rewriteMdLine(rewriteWikiLine(line)));

  return { content, count };
}

/**
 * Scan a note's raw content for markdown links resolving to `targetPath` —
 * the candidate-discovery pass for referencing notes the backlink index can't
 * see (it only indexes wikilinks).
 */
export function hasMarkdownLinkTo(raw: string, sourcePath: string, targetPath: string): boolean {
  if (!raw.includes('](')) return false;
  const sourceDir = posix.dirname(sourcePath);
  const noExt = targetPath.replace(/\.md$/i, '');
  for (const m of raw.matchAll(MD_RE)) {
    const rawTarget = m[3] ?? '';
    const asRelative = mdTargetToVaultPath(rawTarget, sourceDir);
    const asAbsolute = mdTargetToVaultPath(rawTarget, '.');
    if (
      asRelative === targetPath ||
      asRelative === noExt ||
      asAbsolute === targetPath ||
      asAbsolute === noExt
    ) {
      return true;
    }
  }
  return false;
}
