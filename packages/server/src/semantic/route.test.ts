import { describe, expect, it } from 'vitest';
import { queryWords, routeToLexical } from './route.js';

describe('routeToLexical', () => {
  it('routes a query that IS a top-hit title', () => {
    expect(routeToLexical('Chateaubriant', ['Encyclopedia/C/Chateaubriant.md'])).toBe(true);
    expect(
      routeToLexical('french revolutionary wars', ['Notes/French Revolutionary Wars.md']),
    ).toBe(true);
  });

  it('does not route a query that merely contains a title', () => {
    expect(routeToLexical('green gemstones', ['Notes/Green.md'])).toBe(false);
    expect(routeToLexical('emerald beryl', ['Encyclopedia/E/Emerald.md'])).toBe(false);
  });

  it('only inspects the top N hits and handles empty inputs', () => {
    expect(routeToLexical('handel', [])).toBe(false);
    expect(routeToLexical('', ['Notes/A.md'])).toBe(false);
    expect(
      routeToLexical('handel', ['Notes/A.md', 'Notes/B.md', 'Notes/C.md', 'S/Handel.md']),
    ).toBe(false);
  });
});

describe('queryWords', () => {
  it('lowercases and splits on non-word characters', () => {
    expect(queryWords('Émile Zola’s "J’accuse"')).toEqual(
      'Émile Zola’s "J’accuse"'.toLowerCase().split(/\W+/).filter(Boolean),
    );
    expect(queryWords('  hello,  world!  ')).toEqual(['hello', 'world']);
    expect(queryWords('')).toEqual([]);
  });
});
