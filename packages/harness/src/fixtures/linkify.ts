/**
 * Deterministic prose cross-linking for the synthetic benchmark vault (SHA-322).
 *
 * Why this exists: the v1 fixture's wikilinks were RANDOM by design (the
 * golden-set rule requires relevance labels to come from body prose only), and
 * SHA-315 proved the consequence — the link graph carries no topical signal, so
 * graph-based retrieval features are unmeasurable on it. EB1911 prose natively
 * mentions other articles' headwords ("the limits of the subfamily…", "see
 * EAGLE"); converting those mentions into wikilinks yields real topical edges
 * *derived from the same prose the labels come from*. That correlation is the
 * point: prose links are the signal population, the retained random See-also
 * links are the label-independent noise floor, and the generator reports the
 * two densities separately.
 *
 * The matcher is a pure function of the sampled article set — no PRNG, so the
 * same corpus + count + seed still produces a byte-identical vault.
 *
 * Precision rules (measured on the v1 vault before choosing, SHA-322):
 * - Whole-token n-gram match of another article's title, longest match first,
 *   case-insensitive, plus simple plural (`-s`/`-es`). Unfiltered this yields
 *   27.5 links/note dominated by common-word titles (EB1911 has articles named
 *   "As", "May", "Born", "Man"…).
 * - Document-frequency filter: a title mentioned in more than DF_MAX_FRACTION
 *   of article notes is too common a word (or too generic a hub) to link with
 *   acceptable precision — it is matched (so its span is consumed) but never
 *   linked. At 3% this keeps 82/85 of the topical golden targets linkable
 *   while cutting density to ~6/note; the filter is label-agnostic (derived
 *   from the corpus alone, never from the golden set).
 * - First mention per target per note; self-mentions consume but never link.
 * - `[Illustration` caption lines are left untouched.
 *
 * Mentions become `[[Title]]` when the surface text already equals the note
 * basename, else `[[Title|surface]]` — rendered prose is unchanged either way.
 */

export interface ProseLink {
  /** Note basename the link resolves to. */
  target: string;
  /** The prose text that was wrapped, byte-identical to the original. */
  surface: string;
}

export interface LinkifyResult {
  body: string;
  links: ProseLink[];
}

export interface LinkifierOptions {
  /** Titles mentioned in more than this fraction of notes are never linked. */
  dfMaxFraction?: number;
  /** Titles shorter than this many characters are ignored entirely. */
  minTitleChars?: number;
}

export const DF_MAX_FRACTION = 0.03;
export const MIN_TITLE_CHARS = 3;

const TOKEN_RE = /[A-Za-z][A-Za-z'’-]*/g;

interface Mention {
  /** Lowercased canonical title key (map key, identifies the target). */
  key: string;
  line: number;
  start: number;
  end: number;
  surface: string;
}

export interface LinkifierStats {
  /** Titles eligible for matching (post length filter). */
  eligibleTitles: number;
  /** Titles excluded by the document-frequency filter. */
  dfExcludedTitles: number;
}

export class Linkifier {
  private readonly targets: Map<string, string>;
  private readonly firstWordMaxN: Map<string, number>;
  private readonly excluded: Set<string>;

  constructor(targets: Map<string, string>, excluded: Set<string>) {
    this.targets = targets;
    this.excluded = excluded;
    this.firstWordMaxN = new Map();
    for (const key of targets.keys()) {
      const words = key.split(' ');
      const first = words[0] as string;
      const n = words.length;
      if (n > (this.firstWordMaxN.get(first) ?? 0)) this.firstWordMaxN.set(first, n);
    }
  }

  stats(): LinkifierStats {
    return { eligibleTitles: this.targets.size, dfExcludedTitles: this.excluded.size };
  }

  /**
   * All consumed mentions in a body, in document order. Longest match wins at
   * each position and consumes its tokens, so a sub-word of a longer title
   * ("England" inside "New England") can never match on its own — this also
   * holds for excluded and self titles, which consume without linking.
   */
  mentions(body: string): Mention[] {
    const out: Mention[] = [];
    const lines = body.split('\n');
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li] as string;
      if (line.startsWith('[Illustration')) continue;
      const toks = [...line.matchAll(TOKEN_RE)];
      for (let i = 0; i < toks.length; i++) {
        const firstTok = (toks[i] as RegExpMatchArray)[0].toLowerCase();
        const maxN = Math.min(this.firstWordMaxN.get(firstTok) ?? 1, toks.length - i);
        for (let n = maxN; n >= 1; n--) {
          const first = toks[i] as RegExpMatchArray;
          const last = toks[i + n - 1] as RegExpMatchArray;
          const start = first.index as number;
          const end = (last.index as number) + last[0].length;
          const surface = line.slice(start, end);
          const norm = surface.toLowerCase().replace(/\s+/g, ' ');
          let key = this.targets.has(norm) ? norm : undefined;
          if (key === undefined && norm.endsWith('s')) {
            const s1 = norm.slice(0, -1);
            if (this.targets.has(s1)) key = s1;
            else if (norm.endsWith('es')) {
              const s2 = norm.slice(0, -2);
              if (this.targets.has(s2)) key = s2;
            }
          }
          if (key === undefined) continue;
          // EB1911 marks transliterations with square brackets ("[Delta]",
          // "[Greek: ...]"); wrapping a span flush against one would emit
          // "[[[" / "]]]" and corrupt the wikilink syntax. Skip those spans.
          if (line[start - 1] === '[' || line[end] === ']') continue;
          out.push({ key, line: li, start, end, surface });
          i += n - 1;
          break;
        }
      }
    }
    return out;
  }

  /** Distinct non-self titles mentioned in a body (for the DF pass). */
  mentionedKeys(body: string, selfKey: string): Set<string> {
    const keys = new Set<string>();
    for (const m of this.mentions(body)) {
      if (m.key !== selfKey) keys.add(m.key);
    }
    return keys;
  }

  /** Wrap the first mention of each linkable target; prose otherwise untouched. */
  linkify(selfTitle: string, body: string): LinkifyResult {
    const selfKey = selfTitle.toLowerCase();
    const seen = new Set<string>();
    const links: ProseLink[] = [];
    const byLine = new Map<number, Mention[]>();
    for (const m of this.mentions(body)) {
      if (m.key === selfKey || seen.has(m.key)) continue;
      seen.add(m.key);
      if (this.excluded.has(m.key)) continue;
      links.push({ target: this.targets.get(m.key) as string, surface: m.surface });
      const list = byLine.get(m.line);
      if (list) list.push(m);
      else byLine.set(m.line, [m]);
    }
    if (links.length === 0) return { body, links };

    const lines = body.split('\n');
    for (const [li, ms] of byLine) {
      let line = lines[li] as string;
      // Right-to-left so earlier offsets stay valid.
      for (let k = ms.length - 1; k >= 0; k--) {
        const m = ms[k] as Mention;
        const target = this.targets.get(m.key) as string;
        const wrapped = m.surface === target ? `[[${target}]]` : `[[${target}|${m.surface}]]`;
        line = line.slice(0, m.start) + wrapped + line.slice(m.end);
      }
      lines[li] = line;
    }
    return { body: lines.join('\n'), links };
  }
}

/**
 * Build a linkifier from the sampled article set. Two passes: index the
 * eligible titles, then measure per-title document frequency over the same
 * bodies to fix the excluded set. Deterministic — a pure function of the
 * (title, body) list.
 */
export function buildLinkifier(
  articles: ReadonlyArray<{ title: string; noteBasename: string; body: string }>,
  opts: LinkifierOptions = {},
): Linkifier {
  const dfMax = opts.dfMaxFraction ?? DF_MAX_FRACTION;
  const minChars = opts.minTitleChars ?? MIN_TITLE_CHARS;

  const targets = new Map<string, string>();
  for (const a of articles) {
    if (a.title.length < minChars) continue;
    targets.set(a.title.toLowerCase(), a.noteBasename);
  }

  const probe = new Linkifier(targets, new Set());
  const df = new Map<string, number>();
  for (const a of articles) {
    for (const key of probe.mentionedKeys(a.body, a.title.toLowerCase())) {
      df.set(key, (df.get(key) ?? 0) + 1);
    }
  }

  const cut = dfMax * articles.length;
  const excluded = new Set<string>();
  for (const [key, count] of df) {
    if (count > cut) excluded.add(key);
  }
  return new Linkifier(targets, excluded);
}
