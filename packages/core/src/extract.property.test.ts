import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  extractInlineTags,
  extractLinksWithLines,
  extractUrls,
  extractWikilinks,
  frontmatterTags,
} from './extract.js';

// Fixed seed keeps CI deterministic (repo convention — same reason the
// fixture vault pins seed 42). Bump numRuns locally when hunting.
fc.configureGlobal({ seed: 42, numRuns: 200 });

/** Wikilink target: anything the WIKILINK_RE target group accepts, minus `[`
 * so a generated target can't open a nested match at a shifted position. */
const linkTarget = fc
  .string({ minLength: 1, maxLength: 60 })
  .filter((s) => !/[[\]|#\n]/.test(s) && s.trim().length > 0);

/** Filler that can never form or terminate a wikilink. */
const filler = fc.string({ maxLength: 40 }).filter((s) => !/[[\]\n]/.test(s));

describe('extractWikilinks properties', () => {
  it('is total and never yields a delimiter inside a field', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (body) => {
        for (const link of extractWikilinks(body)) {
          expect(link.target).not.toMatch(/[\]|#\n]/);
          if (link.fragment !== null) expect(link.fragment).not.toMatch(/[\]|\n]/);
          if (link.alias !== null) expect(link.alias).not.toMatch(/[\]\n]/);
        }
      }),
    );
  });

  it('extracts constructed links in order with correct fields', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            target: linkTarget,
            fragment: fc.option(linkTarget),
            alias: fc.option(linkTarget),
            pad: filler,
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (specs) => {
          const body = specs
            .map(
              (s) =>
                `${s.pad}[[${s.target}${s.fragment ? `#${s.fragment}` : ''}${
                  s.alias ? `|${s.alias}` : ''
                }]]`,
            )
            .join(' and ');
          const links = extractWikilinks(body);
          expect(links.map((l) => l.target)).toEqual(specs.map((s) => s.target.trim()));
          expect(links.map((l) => l.fragment)).toEqual(
            specs.map((s) => (s.fragment ? s.fragment.trim() : null)),
          );
          expect(links.map((l) => l.alias)).toEqual(
            specs.map((s) => (s.alias ? s.alias.trim() : null)),
          );
        },
      ),
    );
  });
});

describe('extractLinksWithLines properties', () => {
  it('reports 1-indexed line numbers within the file', () => {
    fc.assert(
      fc.property(
        fc.array(filler, { maxLength: 20 }),
        linkTarget,
        fc.nat({ max: 20 }),
        (lines, target, at) => {
          const insertAt = Math.min(at, lines.length);
          const withLink = [...lines];
          withLink.splice(insertAt, 0, `see [[${target}]] here`);
          const records = extractLinksWithLines(withLink.join('\n'));
          expect(records).toHaveLength(1);
          expect(records[0]?.target).toBe(target.trim());
          expect(records[0]?.line).toBe(insertAt + 1);
          expect(records[0]?.linkType).toBe('wikilink');
        },
      ),
    );
  });

  it('is total on arbitrary input and lines stay in range', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (raw) => {
        const lineCount = raw.split('\n').length;
        for (const record of extractLinksWithLines(raw)) {
          expect(record.line).toBeGreaterThanOrEqual(1);
          expect(record.line).toBeLessThanOrEqual(lineCount);
        }
      }),
    );
  });
});

describe('extractUrls properties', () => {
  it('never returns a URL with trailing punctuation and only http(s) schemes', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (body) => {
        for (const url of extractUrls(body)) {
          expect(url).toMatch(/^https?:\/\//);
          expect(url).not.toMatch(/[.,;:!?)]$/);
        }
      }),
    );
  });
});

describe('extractInlineTags properties', () => {
  it('only yields tags Obsidian would accept', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (body) => {
        for (const tag of extractInlineTags(body)) {
          expect(tag).toMatch(/^[A-Za-z_][\w/-]*$/);
        }
      }),
    );
  });
});

describe('frontmatterTags properties', () => {
  const tagValue = fc
    .string({ minLength: 1, maxLength: 20 })
    .filter((s) => !/[\s,]/.test(s) && !s.startsWith('#'));

  it('strips a single leading # from list-form tags', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(fc.boolean(), tagValue).map(([hash, t]) => (hash ? `#${t}` : t)),
          { maxLength: 8 },
        ),
        (tags) => {
          expect(frontmatterTags({ tags })).toEqual(tags.map((t) => t.replace(/^#/, '')));
        },
      ),
    );
  });

  it('splits string-form tags on whitespace/commas with no empty results', () => {
    fc.assert(
      fc.property(
        fc.array(tagValue, { minLength: 1, maxLength: 8 }),
        fc.constantFrom(' ', ', ', ',', '  '),
        (tags, sep) => {
          expect(frontmatterTags({ tags: tags.join(sep) })).toEqual(tags);
        },
      ),
    );
  });
});

// Regression guards for the polynomial-ReDoS findings fixed in code-scanning
// alerts #25/#26 — the exact adversarial shapes CodeQL flagged, at a size
// that ran for minutes pre-fix. Wall-clock bound is deliberately generous so
// slow CI runners can't flake it; a backtracking regression blows past it by
// orders of magnitude.
describe('ReDoS regression (bounded runtime on adversarial input)', () => {
  const BUDGET_MS = 2000;

  it.each([
    ['unclosed openers', '[['.repeat(25_000)],
    ['openers with quote-hash tail', '[["#'.repeat(12_500)],
    ['embed bangs', `${'!'.repeat(25_000)}[[x]]`],
    ['opener then bang flood', `[[${'!'.repeat(50_000)}`],
  ])('extractors stay fast on %s', (_name, body) => {
    const start = performance.now();
    extractWikilinks(body);
    extractLinksWithLines(body);
    expect(performance.now() - start).toBeLessThan(BUDGET_MS);
  });

  it('extractUrls stays fast on punctuation floods', () => {
    const body = `https://example.com/${'.'.repeat(50_000)}`;
    const start = performance.now();
    extractUrls(body);
    expect(performance.now() - start).toBeLessThan(BUDGET_MS);
  });
});
