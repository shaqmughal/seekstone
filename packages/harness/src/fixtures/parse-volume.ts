/**
 * Parse a Project Gutenberg "Encyclopaedia Britannica, 11th Edition" volume
 * (plain-text `.txt`) into individual titled articles.
 *
 * Why this exists: the committed benchmark vault (see PRD SHA-188) is generated
 * from public-domain EB1911 article prose. Each PG volume is one big text file
 * containing ~100-300 alphabetically-ordered articles. We split it into
 * `{ title, body }` chunks the generator can sample.
 *
 * Structure of a PG EB1911 volume we rely on:
 *   1. `*** START OF THE PROJECT GUTENBERG EBOOK … "<RANGE>" ***`  (boilerplate gate)
 *   2. A title line, then `ARTICLES IN THIS SLICE:` followed by a two-column
 *      list of every article headword in the volume — an authoritative TOC.
 *   3. The article bodies, alphabetical, each beginning with an ALL-CAPS
 *      headword at column 0, preceded by a blank line.
 *   4. `*** END OF THE PROJECT GUTENBERG EBOOK … ***`
 *
 * The TOC is the key to robust splitting: a body line only starts a new article
 * when its leading uppercase headword is one the TOC declared. That rejects the
 * mid-paragraph false positives (`GABELLE), and …`, `IV. the Handsome`,
 * `JOINTS).`) that a naive "line starts uppercase" heuristic would split on.
 */

export interface Article {
  /** Uppercase headword used for TOC matching, e.g. `ANNA COMNENA`. */
  headword: string;
  /** Human title, title-cased from the headword, e.g. `Anna Comnena`. */
  title: string;
  /** Full article text, including the heading line. Trailing blank lines trimmed. */
  body: string;
  /** UTF-8 byte length of `body`. */
  bytes: number;
}

export interface ParsedVolume {
  /** Alphabetical range from the START marker, e.g. `Anjar to Apollo`. */
  range: string;
  /** Headwords declared by the volume's "ARTICLES IN THIS SLICE" table. */
  tocHeadwords: string[];
  articles: Article[];
}

const START_RE = /^\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK(.*?)\*\*\*\s*$/im;
const END_RE = /^\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*$/im;
const TOC_MARKER_RE = /^ARTICLES IN THIS SLICE:\s*$/im;

/**
 * The headword is the leading run of a heading up to the first `(` or `,`.
 * Returns the normalized uppercase headword, or null if the prefix isn't a
 * plausible all-caps headword (contains lowercase, too short, etc.).
 *
 * `ANJAR, a fortified town`            -> `ANJAR`
 * `ANNA AMALIA (1739-1807), duchess`  -> `ANNA AMALIA`
 * `ANNA (Hindustani _ana_), a penny`  -> `ANNA`
 * `ANTIMONY is also used in …`        -> null  (no early comma/paren; lowercase leaks in)
 * `GABELLE), and comprised …`         -> null  (`)` not allowed in a headword)
 */
export function headwordOf(line: string): string | null {
  const cut = line.search(/[(,]/);
  const raw = (cut === -1 ? line : line.slice(0, cut)).trim();
  if (raw.length < 2) return null;
  // Allowed: uppercase letters, digits, spaces, and the punctuation that shows
  // up inside real headwords. Crucially, no lowercase and no stray brackets.
  if (!/^[A-Z][A-Z0-9 .&'’-]*$/.test(raw)) return null;
  // Need at least two actual letters so `I.`, `IV.` enumerations don't qualify.
  if ((raw.match(/[A-Z]/g)?.length ?? 0) < 2) return null;
  // Reject leading roman-numeral section markers (`I. EXTERIOR BALLISTICS`,
  // `VII. THEORY`) — these are in-article subsection headers, not headwords.
  if (/^[IVXLCDM]{1,4}\.\s/.test(raw)) return null;
  return raw.replace(/\s+/g, ' ');
}

function titleCase(headword: string): string {
  return headword.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** Strip PG header/footer; return the alphabetical range and the content between markers. */
export function stripGutenbergBoilerplate(raw: string): { range: string; content: string } {
  const start = raw.match(START_RE);
  const end = raw.match(END_RE);
  if (!start || start.index === undefined) {
    throw new Error('No Project Gutenberg START marker found');
  }
  const cap = (start[1] ?? '').trim();
  const rangeMatch = cap.match(/"([^"]+)"\s+to\s+"([^"]+)"/i);
  const range = rangeMatch ? `${rangeMatch[1]} to ${rangeMatch[2]}` : cap;
  const contentStart = start.index + start[0].length;
  const contentEnd = end?.index ?? raw.length;
  return { range, content: raw.slice(contentStart, contentEnd) };
}

export function parseVolume(raw: string): ParsedVolume {
  const { range, content } = stripGutenbergBoilerplate(raw);
  const lines = content.split(/\r?\n/);

  // --- Locate the TOC and the first body line. ---
  const tocIdx = content.match(TOC_MARKER_RE) ? findLine(lines, TOC_MARKER_RE) : -1;
  const tocHeadwords = new Set<string>();
  let bodyStart = 0;

  if (tocIdx !== -1) {
    // TOC entries are indented; the body begins at the first column-0 headword
    // line that appears after the TOC. Collect indented headwords until then.
    let i = tocIdx + 1;
    for (; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (line.trim() === '') continue;
      const indented = /^\s/.test(line);
      if (!indented) break; // first non-indented line ends the TOC
      // Two columns separated by 2+ spaces; each column is a headword.
      for (const col of line.trim().split(/\s{2,}/)) {
        const hw = headwordOf(col);
        if (hw) tocHeadwords.add(hw);
      }
    }
    bodyStart = i;
  }

  // --- Split the body into articles. ---
  // A line starts a new article when it sits at column 0, is preceded by a
  // blank line (or is the first body line), and its headword was declared in
  // the TOC. When there is no usable TOC we fall back to headword shape alone.
  const haveToc = tocHeadwords.size > 0;
  const articles: Article[] = [];
  let current: { headword: string; lines: string[] } | null = null;

  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const prevBlank = i === bodyStart || (lines[i - 1]?.trim() ?? '') === '';
    const atCol0 = line.length > 0 && !/^\s/.test(line);
    let hw: string | null = null;
    if (prevBlank && atCol0) {
      hw = headwordOf(line);
      if (hw && haveToc && !tocHeadwords.has(hw)) hw = null;
    }
    if (hw) {
      if (current) articles.push(finishArticle(current));
      current = { headword: hw, lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
    // lines before the first heading (stray TOC tail / blank) are dropped
  }
  if (current) articles.push(finishArticle(current));

  return { range, tocHeadwords: [...tocHeadwords], articles };
}

function finishArticle(a: { headword: string; lines: string[] }): Article {
  const body = a.lines.join('\n').replace(/\n+$/, '');
  return {
    headword: a.headword,
    title: titleCase(a.headword),
    body,
    bytes: Buffer.byteLength(body, 'utf8'),
  };
}

function findLine(lines: string[], re: RegExp): number {
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i] ?? '')) return i;
  }
  return -1;
}
