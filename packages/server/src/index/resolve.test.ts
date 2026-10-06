import { describe, expect, it } from 'vitest';
import { buildResolveMaps, resolveCandidates, resolveLink } from './resolve.js';

const notesOf = (...paths: string[]): Map<string, unknown> => new Map(paths.map((p) => [p, {}]));

/** Notes map whose values carry parsed frontmatter, like real IndexedNote docs. */
const notesWithFm = (
  entries: Record<string, Record<string, unknown> | null>,
): Map<string, unknown> => new Map(Object.entries(entries).map(([path, fm]) => [path, { fm }]));

describe('resolveLink', () => {
  it('exact path match wins', () => {
    const notes = notesOf('Projects/Core.md');
    expect(resolveLink('Projects/Core.md', notes)).toBe('Projects/Core.md');
  });

  it('adds .md for path-style targets', () => {
    const notes = notesOf('Projects/Core.md');
    expect(resolveLink('Projects/Core', notes)).toBe('Projects/Core.md');
  });

  it('resolves a bare basename to a nested note', () => {
    const notes = notesOf('Projects/Core.md', 'Home.md');
    expect(resolveLink('Core', notes)).toBe('Projects/Core.md');
  });

  it('basename match is case-insensitive', () => {
    const notes = notesOf('Projects/Core.md');
    expect(resolveLink('core', notes)).toBe('Projects/Core.md');
  });

  it('path-without-extension match is case-insensitive', () => {
    const notes = notesOf('Projects/Core.md');
    expect(resolveLink('projects/core', notes)).toBe('Projects/Core.md');
  });

  it('exact match beats basename match', () => {
    // Target names an existing full path; a same-basename note elsewhere must not win.
    const notes = notesOf('a/Core.md', 'Core.md');
    expect(resolveLink('Core.md', notes)).toBe('Core.md');
    expect(resolveLink('Core', notes)).toBe('Core.md');
  });

  it('basename match beats path-without-extension match', () => {
    // Documented precedence: the basename tier resolves before the case-variant
    // full-path tier, so "b/note" goes to the basename winner (A < B) even
    // though B/Note.md matches the target's full path case-insensitively.
    const notes = notesOf('A/Note.md', 'B/Note.md');
    expect(resolveLink('b/note', notes)).toBe('A/Note.md');
  });

  it('returns undefined when nothing matches', () => {
    const notes = notesOf('Projects/Core.md');
    expect(resolveLink('Missing', notes)).toBeUndefined();
    expect(resolveLink('Missing', new Map())).toBeUndefined();
  });

  it('ambiguous basename resolves deterministically regardless of insertion order', () => {
    const a = ['Encyclopedia/I/Index.md', 'zoo/Index.md'];
    const forward = notesOf(...a);
    const reverse = notesOf(...[...a].reverse());
    expect(resolveLink('index', forward)).toBe('Encyclopedia/I/Index.md');
    expect(resolveLink('index', reverse)).toBe('Encyclopedia/I/Index.md');
  });

  it('prebuilt maps resolve identically to mapless calls', () => {
    const notes = notesOf('Projects/Core.md', 'a/Core.md', 'Home.md', 'x/note.md', 'B/Note.md');
    const maps = buildResolveMaps(notes);
    for (const target of [
      'Projects/Core.md',
      'Projects/Core',
      'Core',
      'core',
      'projects/core',
      'b/note',
      'Home',
      'Missing',
    ]) {
      expect(resolveLink(target, notes, maps)).toBe(resolveLink(target, notes));
    }
  });

  it('resolves a frontmatter alias to its owning note', () => {
    const notes = notesWithFm({
      'People/Robert.md': { aliases: ['Bob', 'Robert Smith'] },
      'Home.md': null,
    });
    expect(resolveLink('Bob', notes)).toBe('People/Robert.md');
    expect(resolveLink('Robert Smith', notes)).toBe('People/Robert.md');
  });

  it('alias match is case-insensitive', () => {
    const notes = notesWithFm({ 'People/Robert.md': { aliases: ['Bob'] } });
    expect(resolveLink('bob', notes)).toBe('People/Robert.md');
    expect(resolveLink('BOB', notes)).toBe('People/Robert.md');
  });

  it('alias is the lowest tier: basename and path-no-ext beat it', () => {
    const notes = notesWithFm({
      'Bob.md': null,
      'People/Robert.md': { aliases: ['Bob'] },
    });
    expect(resolveLink('Bob', notes)).toBe('Bob.md');

    const pathVariant = notesWithFm({
      'People/Bob.md': null,
      'Robert.md': { aliases: ['people/bob'] },
    });
    expect(resolveLink('people/bob', pathVariant)).toBe('People/Bob.md');
  });

  it('ambiguous alias resolves deterministically regardless of insertion order', () => {
    const entries: [string, Record<string, unknown>][] = [
      ['a/One.md', { aliases: ['Bob'] }],
      ['z/Two.md', { aliases: ['Bob'] }],
    ];
    const forward = new Map(entries.map(([p, fm]) => [p, { fm }]));
    const reverse = new Map([...entries].reverse().map(([p, fm]) => [p, { fm }]));
    expect(resolveLink('Bob', forward)).toBe('a/One.md');
    expect(resolveLink('Bob', reverse)).toBe('a/One.md');
  });
});

describe('resolveCandidates', () => {
  it('returns all candidates in tier-then-lex order with provenance', () => {
    const notes = new Map<string, unknown>([
      ['Core.md', {}],
      ['a/Core.md', {}],
      ['People/Robert.md', { fm: { aliases: ['Core'] } }],
    ]);
    expect(resolveCandidates('Core', notes)).toEqual([
      { path: 'Core.md', via: 'path' },
      { path: 'a/Core.md', via: 'basename' },
      { path: 'People/Robert.md', via: 'alias', alias: 'Core' },
    ]);
  });

  it('reports the matched alias verbatim even when the reference differs in case', () => {
    const notes = notesWithFm({ 'People/Robert.md': { aliases: ['Robert Smith'] } });
    expect(resolveCandidates('robert smith', notes)).toEqual([
      { path: 'People/Robert.md', via: 'alias', alias: 'Robert Smith' },
    ]);
  });

  it('dedupes by path, keeping the highest tier', () => {
    // Core.md matches exact (+.md), basename, and path-no-ext — one candidate, via path.
    const notes = notesWithFm({ 'Core.md': { aliases: ['core'] } });
    expect(resolveCandidates('Core', notes)).toEqual([{ path: 'Core.md', via: 'path' }]);
  });

  it('lists both notes sharing a basename', () => {
    const notes = notesOf('a/Note.md', 'z/Note.md');
    expect(resolveCandidates('Note', notes)).toEqual([
      { path: 'a/Note.md', via: 'basename' },
      { path: 'z/Note.md', via: 'basename' },
    ]);
  });

  it('returns [] when nothing matches', () => {
    expect(resolveCandidates('Missing', notesOf('Home.md'))).toEqual([]);
    expect(resolveCandidates('Missing', new Map())).toEqual([]);
  });

  it('first candidate always equals resolveLink (winner invariant)', () => {
    const notes = new Map<string, unknown>([
      ['Projects/Core.md', { fm: { aliases: ['The Core', 'main project'] } }],
      ['a/Core.md', {}],
      ['Core.md', {}],
      ['B/Note.md', {}],
      ['x/note.md', {}],
      ['People/Robert.md', { fm: { aliases: ['Bob', 'note'] } }],
    ]);
    const maps = buildResolveMaps(notes);
    for (const target of [
      'Projects/Core.md',
      'Projects/Core',
      'Core',
      'core',
      'projects/core',
      'The Core',
      'the core',
      'Bob',
      'note',
      'b/note',
      'Missing',
    ]) {
      expect(resolveCandidates(target, notes, maps)[0]?.path).toBe(
        resolveLink(target, notes, maps),
      );
      expect(resolveCandidates(target, notes)[0]?.path).toBe(resolveLink(target, notes));
    }
  });

  it('prebuilt maps produce identical candidates to mapless calls', () => {
    const notes = new Map<string, unknown>([
      ['Projects/Core.md', { fm: { aliases: ['The Core'] } }],
      ['a/Core.md', {}],
    ]);
    const maps = buildResolveMaps(notes);
    for (const target of ['Core', 'The Core', 'projects/core', 'Missing']) {
      expect(resolveCandidates(target, notes, maps)).toEqual(resolveCandidates(target, notes));
    }
  });
});
