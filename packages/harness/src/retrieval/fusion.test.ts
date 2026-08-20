import { describe, expect, it } from 'vitest';
import { routeToLexical, wsumFuse } from './fusion.js';

describe('routeToLexical', () => {
  const hits = (...paths: string[]) => paths.map((path) => ({ path }));

  it('routes a query that IS a top-hit title', () => {
    expect(routeToLexical('Chateaubriant', hits('Encyclopedia/C/Chateaubriant.md'))).toBe(true);
    expect(routeToLexical('emerald', hits('Encyclopedia/E/Emerald.md'))).toBe(true);
  });

  it('does not route a query that merely contains a title', () => {
    // "green gemstones" vs a note titled "Green": describing, not naming.
    expect(routeToLexical('green gemstones', hits('Notes/Green.md'))).toBe(false);
    expect(routeToLexical('emerald beryl', hits('Encyclopedia/E/Emerald.md'))).toBe(false);
  });

  it('never routes long description-style queries, even on a title collision', () => {
    expect(
      routeToLexical('green ornamental stone comprising nephrite and jadeite', [
        { path: 'Notes/Stone.md' },
      ]),
    ).toBe(false);
  });

  it('does not route when no top hit is a title match', () => {
    expect(
      routeToLexical('phlogiston', hits('Sources/Combustion.md', 'Sources/Lavoisier.md')),
    ).toBe(false);
  });

  it('requires every word of a multi-word title to appear in the query', () => {
    expect(routeToLexical('french wars', hits('Notes/French Revolutionary Wars.md'))).toBe(false);
    expect(
      routeToLexical('french revolutionary wars', hits('Notes/French Revolutionary Wars.md')),
    ).toBe(true);
  });

  it('only inspects the top N hits and handles empty inputs', () => {
    expect(routeToLexical('handel', [])).toBe(false);
    expect(routeToLexical('', hits('Notes/A.md'))).toBe(false);
    expect(
      routeToLexical('handel', hits('Notes/A.md', 'Notes/B.md', 'Notes/C.md', 'Sources/Handel.md')),
    ).toBe(false);
  });
});

describe('wsumFuse', () => {
  it('weights normalized scores by alpha', () => {
    const lexical = [
      { path: 'lex.md', score: 10 },
      { path: 'both.md', score: 5 },
      { path: 'low.md', score: 0 },
    ];
    const semantic = [
      { path: 'sem.md', score: 0.9 },
      { path: 'both.md', score: 0.6 },
      { path: 'floor.md', score: 0.3 },
    ];
    // alpha 0.7: sem.md = 0.7·1, lex.md = 0.3·1, both.md = 0.3·0.5 + 0.7·0.5 = 0.5;
    // low.md and floor.md both normalize to 0 and tie-break path-ascending.
    expect(wsumFuse(lexical, semantic, 0.7)).toEqual([
      'sem.md',
      'both.md',
      'lex.md',
      'floor.md',
      'low.md',
    ]);
  });

  it('alpha 1 is semantic-only ordering; alpha 0 is lexical-only', () => {
    const lexical = [
      { path: 'a.md', score: 2 },
      { path: 'b.md', score: 1 },
    ];
    const semantic = [
      { path: 'b.md', score: 0.9 },
      { path: 'a.md', score: 0.1 },
    ];
    expect(wsumFuse(lexical, semantic, 1)[0]).toBe('b.md');
    expect(wsumFuse(lexical, semantic, 0)[0]).toBe('a.md');
  });

  it('handles a constant-score list (span 0) and empty lists', () => {
    const flat = [
      { path: 'x.md', score: 3 },
      { path: 'y.md', score: 3 },
    ];
    expect(wsumFuse(flat, [], 0.5)).toEqual(['x.md', 'y.md']);
    expect(wsumFuse([], [], 0.5)).toEqual([]);
  });

  it('breaks ties by path ascending', () => {
    const semantic = [
      { path: 'z.md', score: 1 },
      { path: 'a.md', score: 1 },
    ];
    expect(wsumFuse([], semantic, 0.7)).toEqual(['a.md', 'z.md']);
  });
});
