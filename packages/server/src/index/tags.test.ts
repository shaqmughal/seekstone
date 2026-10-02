import { describe, expect, it } from 'vitest';
import { assertTagExists, editDistance, normalizeTag, noteHasTag, suggestTags } from './tags.js';
import type { IndexedNote } from './types.js';

function notes(...tagStrings: string[]): Map<string, IndexedNote> {
  const map = new Map<string, IndexedNote>();
  tagStrings.forEach((tags, i) => {
    const id = `n${i}.md`;
    map.set(id, {
      id,
      title: id,
      body: '',
      tags,
      fmKeys: '',
      fm: null,
      raw: '',
      sizeBytes: 0,
      mtimeMs: 0,
    });
  });
  return map;
}

function unknownTagError(fn: () => void): Record<string, unknown> {
  try {
    fn();
  } catch (err) {
    return JSON.parse((err as Error).message) as Record<string, unknown>;
  }
  throw new Error('expected unknown_tag to be thrown');
}

describe('tag matching (Obsidian semantics, SHA-264)', () => {
  it('normalizes a filter: strips the leading # and lowercases', () => {
    expect(normalizeTag('#Project')).toBe('project');
    expect(normalizeTag('area/Work')).toBe('area/work');
  });

  it('matches regardless of case', () => {
    expect(noteHasTag('Project daily', 'project')).toBe(true);
    expect(noteHasTag('project', normalizeTag('PROJECT'))).toBe(true);
  });

  it('a parent tag matches its nested children', () => {
    expect(noteHasTag('project/alpha', 'project')).toBe(true);
    expect(noteHasTag('Project/Alpha/Q3', 'project/alpha')).toBe(true);
  });

  it('does not match a child filter against its parent, or a name prefix', () => {
    expect(noteHasTag('project', 'project/alpha')).toBe(false);
    expect(noteHasTag('projects', 'project')).toBe(false);
    expect(noteHasTag('proj', 'project')).toBe(false);
  });
});

describe('editDistance', () => {
  it('counts single edits, and a swap of two letters as two', () => {
    expect(editDistance('project', 'project')).toBe(0);
    expect(editDistance('projet', 'project')).toBe(1);
    expect(editDistance('projcet', 'project')).toBe(2);
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('abc', '')).toBe(3);
    expect(editDistance('kitten', 'sitting')).toBe(3);
  });
});

describe('suggestTags', () => {
  it('suggests the closest existing tags, most-used first on ties', () => {
    const vault = notes('project', 'project', 'projects', 'work');
    expect(suggestTags(vault.values(), 'projcet')).toEqual(['project', 'projects']);
  });

  it('breaks equal-distance ties by usage, then alphabetically', () => {
    expect(suggestTags(notes('car', 'cat', 'cat').values(), 'cab')).toEqual(['cat', 'car']);
    expect(suggestTags(notes('cat', 'car').values(), 'cab')).toEqual(['car', 'cat']);
  });

  it('suggests a nested tag whose last segment is close', () => {
    expect(suggestTags(notes('project/alpha').values(), 'alpha')).toEqual(['project/alpha']);
  });

  it('suggests a parent tag that exists only through its children', () => {
    expect(suggestTags(notes('Project/Alpha', 'work').values(), 'projcet')).toEqual(['project']);
  });

  it('suggests nothing when no tag is close', () => {
    expect(suggestTags(notes('work').values(), 'kubernetes')).toEqual([]);
  });
});

describe('assertTagExists', () => {
  it('passes when any note has the tag, a case variant, or a child of it', () => {
    expect(() => assertTagExists(notes('Project/alpha'), '#project')).not.toThrow();
  });

  it('throws unknown_tag with suggestions for a misspelled tag', () => {
    const err = unknownTagError(() => assertTagExists(notes('project', 'work'), 'projcet'));
    expect(err).toMatchObject({ error: 'unknown_tag', tag: 'projcet', didYouMean: ['project'] });
    expect(err.hint).toMatch(/list_tags/);
  });

  it('omits didYouMean when nothing is close', () => {
    const err = unknownTagError(() => assertTagExists(notes('work'), 'kubernetes'));
    expect(err.error).toBe('unknown_tag');
    expect(err).not.toHaveProperty('didYouMean');
  });
});
