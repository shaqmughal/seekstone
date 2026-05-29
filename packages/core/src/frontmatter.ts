import { parse as parseYaml } from 'yaml';

export interface FrontmatterResult {
  /** true if the note starts with a YAML block delimited by `---` lines. */
  present: boolean;
  /** Parsed object (null if not present or parse error or block empty). */
  data: Record<string, unknown> | null;
  /** Distinct top-level keys (empty if absent or malformed). */
  keys: string[];
  /** True if a `---` block exists but yaml.parse threw. */
  malformed: boolean;
  /** Byte offset where the body (post-frontmatter) starts. */
  bodyStart: number;
  /** Body text, frontmatter stripped. */
  body: string;
}

/**
 * Split a note into frontmatter + body without round-tripping through any
 * YAML stringifier. We need to know the *bytes* of the FM block so writers
 * can be byte-faithful — that's the write-safety contract.
 *
 * Obsidian's rule: a YAML block is present iff the file starts with `---`
 * on its own line (no leading whitespace, no BOM stripped silently — though
 * we tolerate a leading BOM since Windows users exist).
 */
export function parseFrontmatter(text: string): FrontmatterResult {
  let offset = 0;
  if (text.charCodeAt(0) === 0xfeff) offset = 1; // BOM

  // Must start with `---\n` or `---\r\n`
  const head = text.slice(offset, offset + 4);
  if (head !== '---\n' && text.slice(offset, offset + 5) !== '---\r\n') {
    return {
      present: false,
      data: null,
      keys: [],
      malformed: false,
      bodyStart: 0,
      body: text,
    };
  }
  const fmStart = offset + (head === '---\n' ? 4 : 5);

  // Find closing `\n---\n` (or CRLF variant) — Obsidian requires `---` on its own line.
  // We search line-by-line from fmStart.
  const closeLF = text.indexOf('\n---\n', fmStart - 1);
  const closeCRLF = text.indexOf('\r\n---\r\n', fmStart - 1);
  let closeIdx = -1;
  let closeLen = 0;
  if (closeLF !== -1 && (closeCRLF === -1 || closeLF < closeCRLF)) {
    closeIdx = closeLF;
    closeLen = 5;
  } else if (closeCRLF !== -1) {
    closeIdx = closeCRLF;
    closeLen = 7;
  }
  if (closeIdx === -1) {
    // Unterminated frontmatter — count as malformed, treat whole file as body.
    return {
      present: true,
      data: null,
      keys: [],
      malformed: true,
      bodyStart: 0,
      body: text,
    };
  }

  const yamlText = text.slice(fmStart, closeIdx + 1); // include trailing \n before ---
  const bodyStart = closeIdx + closeLen;
  const body = text.slice(bodyStart);

  let data: Record<string, unknown> | null = null;
  let malformed = false;
  try {
    const parsed = parseYaml(yamlText);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    } else {
      // YAML parsed but isn't a mapping — Obsidian also treats this as malformed-for-our-purposes.
      malformed = parsed !== null && parsed !== undefined;
    }
  } catch {
    malformed = true;
  }

  return {
    present: true,
    data,
    keys: data ? Object.keys(data) : [],
    malformed,
    bodyStart,
    body,
  };
}
