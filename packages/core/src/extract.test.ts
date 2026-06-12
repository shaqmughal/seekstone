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
