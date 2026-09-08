import { describe, expect, it } from 'vitest';
import { buildResolveMaps, resolveLink } from './resolve.js';

const notesOf = (...paths: string[]): Map<string, unknown> => new Map(paths.map((p) => [p, {}]));

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
});
