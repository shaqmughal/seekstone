import { describe, expect, it } from 'vitest';
import {
  extractInlineTags,
  extractLinksWithLines,
  extractUrls,
  extractWikilinks,
  frontmatterTags,
} from './extract.js';

describe('extractWikilinks', () => {
  it('captures targets, fragments, and aliases', () => {
    const body =
      'See [[Note A]] and [[Note B#Section]] and [[Note C|aliased]] and [[Notes/Deep/D#h|x]].';
    const links = extractWikilinks(body);
    expect(links).toHaveLength(4);
    expect(links[0]).toEqual({ target: 'Note A', fragment: null, alias: null });
    expect(links[1]).toEqual({ target: 'Note B', fragment: 'Section', alias: null });
    expect(links[2]).toEqual({ target: 'Note C', fragment: null, alias: 'aliased' });
    expect(links[3]).toEqual({ target: 'Notes/Deep/D', fragment: 'h', alias: 'x' });
  });

  it('does not match unmatched brackets', () => {
    expect(extractWikilinks('one [[ two ] three')).toHaveLength(0);
  });
});

describe('extractLinksWithLines', () => {
  const body = [
    '# Title',
    'See [[Note A]] and [[Note B#Section|alias]].',
    '',
    'An embed: ![[diagram.png]]',
  ].join('\n');

  it('captures wikilinks and embeds with 1-indexed line numbers', () => {
    const links = extractLinksWithLines(body);
    expect(links).toEqual([
      {
        raw: '[[Note A]]',
        target: 'Note A',
        fragment: null,
        alias: null,
        linkType: 'wikilink',
        line: 2,
      },
      {
        raw: '[[Note B#Section|alias]]',
        target: 'Note B',
        fragment: 'Section',
        alias: 'alias',
        linkType: 'wikilink',
        line: 2,
      },
      {
        raw: '![[diagram.png]]',
        target: 'diagram.png',
        fragment: null,
        alias: null,
        linkType: 'embed',
        line: 4,
      },
    ]);
  });

  it('is stateless across calls (shared global regex carries no lastIndex)', () => {
    // A reused global RegExp would skip matches on the second call if matchAll
    // mutated its lastIndex. Same input must yield identical results every time.
    expect(extractLinksWithLines(body)).toEqual(extractLinksWithLines(body));
  });
});

describe('extractLinksWithLines — frontmatter', () => {
  it('extracts single-line frontmatter links with their line number', () => {
    const raw = ['---', 'related: "[[Note A]]"', 'banner: "![[cover.png]]"', '---', 'Body.'].join(
      '\n',
    );
    const links = extractLinksWithLines(raw);
    expect(links).toEqual([
      {
        raw: '[[Note A]]',
        target: 'Note A',
        fragment: null,
        alias: null,
        linkType: 'wikilink',
        line: 2,
      },
      {
        raw: '![[cover.png]]',
        target: 'cover.png',
        fragment: null,
        alias: null,
        linkType: 'embed',
        line: 3,
      },
    ]);
  });

  it('heals a wikilink split across lines by scalar folding', () => {
    // yaml's default 80-col folding (pre-0.12.1 seekstone, other writers)
    // turns a long value into a multi-line plain scalar; parsing folds the
    // newline back into a space, restoring the link.
    const raw = [
      '---',
      'source: this sentence references [[Some Extremely Long',
      '  Note Name That Got Folded]] mid-link',
      '---',
      'Body with [[Inline Link]].',
    ].join('\n');
    const links = extractLinksWithLines(raw);
    expect(links).toHaveLength(2);
    expect(links[0]).toEqual({
      raw: '[[Some Extremely Long Note Name That Got Folded]]',
      target: 'Some Extremely Long Note Name That Got Folded',
      fragment: null,
      alias: null,
      linkType: 'wikilink',
      line: 2, // attributed to the line where the scalar begins
    });
    expect(links[1]?.target).toBe('Inline Link');
    expect(links[1]?.line).toBe(5);
  });

  it('heals folded links inside list items and keeps aliases/fragments', () => {
    const raw = [
      '---',
      'refs:',
      '  - "[[First Note#Some',
      '    Heading|display]]"',
      '  - "[[Second]]"',
      '---',
      '',
    ].join('\n');
    const links = extractLinksWithLines(raw);
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({
      target: 'First Note',
      fragment: 'Some Heading',
      alias: 'display',
      line: 3,
    });
    expect(links[1]).toMatchObject({ target: 'Second', line: 5 });
  });

  it('offsets body line numbers past the frontmatter block', () => {
    const raw = ['---', 'title: T', 'tags: [x]', '---', '', 'See [[Target]].'].join('\n');
    const links = extractLinksWithLines(raw);
    expect(links).toEqual([
      {
        raw: '[[Target]]',
        target: 'Target',
        fragment: null,
        alias: null,
        linkType: 'wikilink',
        line: 6,
      },
    ]);
  });

  it('does not treat YAML keys as links', () => {
    const raw = ['---', '"[[Not A Link]]": value', '---', ''].join('\n');
    expect(extractLinksWithLines(raw)).toHaveLength(0);
  });

  it('falls back to per-line regex when frontmatter is malformed', () => {
    const raw = ['---', 'bad: [unclosed', 'related: "[[Still Found]]"', '---', ''].join('\n');
    const links = extractLinksWithLines(raw);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ target: 'Still Found', line: 3 });
  });

  it('handles CRLF frontmatter', () => {
    const raw = '---\r\nrelated: "[[Windows Note]]"\r\n---\r\nBody [[After]].';
    const links = extractLinksWithLines(raw);
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({ target: 'Windows Note', line: 2 });
    expect(links[1]).toMatchObject({ target: 'After', line: 4 });
  });

  it('extracts per-line inside literal block scalars, attributed to the scalar start', () => {
    const raw = ['---', 'notes: |', '  first [[Block Link]]', '  second line', '---', ''].join(
      '\n',
    );
    const links = extractLinksWithLines(raw);
    expect(links).toHaveLength(1);
    // Attribution rule: multi-line scalars report the line the scalar begins on.
    expect(links[0]).toMatchObject({ target: 'Block Link', line: 2 });
  });

  it('treats an unterminated frontmatter block as body (regex per line)', () => {
    const raw = ['---', 'related: "[[Found Anyway]]"', 'no closing delimiter'].join('\n');
    const links = extractLinksWithLines(raw);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ target: 'Found Anyway', line: 2 });
  });
});

describe('extractUrls', () => {
  it('strips trailing punctuation', () => {
    expect(extractUrls('See https://example.com/foo, and (https://x.io/bar).')).toEqual([
      'https://example.com/foo',
      'https://x.io/bar',
    ]);
  });
});

describe('extractInlineTags', () => {
  it('matches valid tags but not URL fragments', () => {
    const body = '#alpha and #foo/bar but not http://x.io/#fragment or text]#nope.';
    expect(extractInlineTags(body)).toEqual(['alpha', 'foo/bar']);
  });

  it('rejects digit-only tags', () => {
    expect(extractInlineTags('see #123')).toEqual([]);
  });
});

describe('frontmatterTags', () => {
  it('handles array form', () => {
    expect(frontmatterTags({ tags: ['a', 'b', '#c'] })).toEqual(['a', 'b', 'c']);
  });
  it('handles space-separated string form', () => {
    expect(frontmatterTags({ tags: '#a b c' })).toEqual(['a', 'b', 'c']);
  });
  it('handles `tag:` singular alias', () => {
    expect(frontmatterTags({ tag: ['x'] })).toEqual(['x']);
  });
  it('returns [] for null fm', () => {
    expect(frontmatterTags(null)).toEqual([]);
  });
});
