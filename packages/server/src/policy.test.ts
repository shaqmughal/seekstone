import { describe, expect, it } from 'vitest';
import {
  assertWritable,
  isReadable,
  isWritable,
  PERMISSIVE_POLICY,
  parseWritePolicy,
  splitGlobs,
} from './policy.js';

describe('parseWritePolicy', () => {
  it('defaults to writable everywhere', () => {
    expect(parseWritePolicy({})).toEqual({ readOnly: false });
  });
  it('parses SEEKSTONE_READ_ONLY=1 and =true (case-insensitive)', () => {
    expect(parseWritePolicy({ SEEKSTONE_READ_ONLY: '1' }).readOnly).toBe(true);
    expect(parseWritePolicy({ SEEKSTONE_READ_ONLY: 'true' }).readOnly).toBe(true);
    expect(parseWritePolicy({ SEEKSTONE_READ_ONLY: 'TRUE' }).readOnly).toBe(true);
    expect(parseWritePolicy({ SEEKSTONE_READ_ONLY: '0' }).readOnly).toBe(false);
    expect(parseWritePolicy({ SEEKSTONE_READ_ONLY: 'no' }).readOnly).toBe(false);
  });
  it('splits SEEKSTONE_WRITE_PATHS on commas, trimming and dropping empties', () => {
    expect(
      parseWritePolicy({ SEEKSTONE_WRITE_PATHS: 'journal/**, inbox/*.md ,' }).writeGlobs,
    ).toEqual(['journal/**', 'inbox/*.md']);
  });
  it('treats an empty/whitespace SEEKSTONE_WRITE_PATHS as unset', () => {
    expect(parseWritePolicy({ SEEKSTONE_WRITE_PATHS: '  ' }).writeGlobs).toBeUndefined();
  });
});

describe('isWritable', () => {
  it('read-only forbids everything', () => {
    expect(isWritable({ readOnly: true }, 'a.md')).toBe(false);
    expect(isWritable({ readOnly: true, writeGlobs: ['**'] }, 'a.md')).toBe(false);
  });
  it('no globs → everything writable', () => {
    expect(isWritable(PERMISSIVE_POLICY, 'anywhere/deep/note.md')).toBe(true);
  });
  it('globs allow matching paths only', () => {
    const p = { readOnly: false, writeGlobs: ['journal/**', 'inbox/*.md'] };
    expect(isWritable(p, 'journal/2026/aug.md')).toBe(true);
    expect(isWritable(p, 'inbox/todo.md')).toBe(true);
    expect(isWritable(p, 'inbox/sub/todo.md')).toBe(false); // * is not **
    expect(isWritable(p, 'projects/x.md')).toBe(false);
  });
  it('matches dot-folders under **', () => {
    expect(
      isWritable({ readOnly: false, writeGlobs: ['journal/**'] }, 'journal/.drafts/x.md'),
    ).toBe(true);
  });
  it('normalizes Windows separators and leading ./', () => {
    const p = { readOnly: false, writeGlobs: ['journal/**'] };
    expect(isWritable(p, 'journal\\aug.md')).toBe(true);
    expect(isWritable(p, './journal/aug.md')).toBe(true);
  });
});

describe('assertWritable', () => {
  it('passes silently when allowed', () => {
    expect(() => assertWritable(PERMISSIVE_POLICY, 'a.md')).not.toThrow();
  });
  it('throws the read-only message in read-only mode', () => {
    expect(() => assertWritable({ readOnly: true }, 'a.md')).toThrow(/read-only/);
  });
  it('throws with the offending path and the globs when out of scope', () => {
    expect(() =>
      assertWritable({ readOnly: false, writeGlobs: ['journal/**'] }, 'projects/x.md'),
    ).toThrow(/projects\/x\.md.*journal\/\*\*/);
  });
});

describe('read scope (SEEKSTONE_READ_PATHS, SHA-291)', () => {
  it('parses SEEKSTONE_READ_PATHS like write paths and leaves it unset when empty', () => {
    expect(parseWritePolicy({ SEEKSTONE_READ_PATHS: 'notes/**, projects/** ,' }).readGlobs).toEqual(
      ['notes/**', 'projects/**'],
    );
    expect(parseWritePolicy({ SEEKSTONE_READ_PATHS: ' ' })).toEqual({ readOnly: false });
  });

  it('unset read scope makes everything readable', () => {
    expect(isReadable(PERMISSIVE_POLICY, 'journal/secret.md')).toBe(true);
  });

  it('matches only the read globs, with dot-folders and Windows separators', () => {
    const p = parseWritePolicy({ SEEKSTONE_READ_PATHS: 'notes/**' });
    expect(isReadable(p, 'notes/a.md')).toBe(true);
    expect(isReadable(p, 'notes/.drafts/a.md')).toBe(true);
    expect(isReadable(p, 'notes\\sub\\a.md')).toBe(true);
    expect(isReadable(p, './notes/a.md')).toBe(true);
    expect(isReadable(p, 'journal/a.md')).toBe(false);
    expect(isReadable(p, '../notes/a.md')).toBe(false);
  });

  it('write scope is the intersection of read and write globs (D1)', () => {
    const readOnlyScope = parseWritePolicy({ SEEKSTONE_READ_PATHS: 'notes/**' });
    expect(isWritable(readOnlyScope, 'notes/a.md')).toBe(true);
    expect(isWritable(readOnlyScope, 'journal/a.md')).toBe(false);

    const both = parseWritePolicy({
      SEEKSTONE_READ_PATHS: 'notes/**',
      SEEKSTONE_WRITE_PATHS: 'notes/inbox/**,journal/**',
    });
    expect(isWritable(both, 'notes/inbox/a.md')).toBe(true);
    expect(isWritable(both, 'notes/a.md')).toBe(false);
    expect(isWritable(both, 'journal/a.md')).toBe(false); // write glob, but unreadable
  });

  it('read-only still wins over a read scope', () => {
    const p = parseWritePolicy({ SEEKSTONE_READ_ONLY: '1', SEEKSTONE_READ_PATHS: 'notes/**' });
    expect(isWritable(p, 'notes/a.md')).toBe(false);
    expect(() => assertWritable(p, 'notes/a.md')).toThrow(/read-only/);
  });

  it('assertWritable names SEEKSTONE_READ_PATHS when the read scope refuses', () => {
    const p = parseWritePolicy({
      SEEKSTONE_READ_PATHS: 'notes/**',
      SEEKSTONE_WRITE_PATHS: 'journal/**',
    });
    expect(() => assertWritable(p, 'journal/a.md')).toThrow(
      'Write not permitted: "journal/a.md" is outside SEEKSTONE_READ_PATHS (notes/**).',
    );
    expect(() => assertWritable(p, 'notes/a.md')).toThrow(/outside SEEKSTONE_WRITE_PATHS/);
  });

  it('compiles each glob set once and reuses it', () => {
    const p = parseWritePolicy({ SEEKSTONE_READ_PATHS: 'notes/**' });
    // Warm, then time many checks: a per-call picomatch compile costs ~10 µs,
    // a cached matcher well under 1 µs.
    isReadable(p, 'notes/a.md');
    const n = 20_000;
    const t0 = performance.now();
    for (let i = 0; i < n; i++) isReadable(p, `notes/${i}.md`);
    const perCallUs = ((performance.now() - t0) * 1000) / n;
    expect(perCallUs).toBeLessThan(5);
  });
});

describe('negated globs', () => {
  it('a leading ! excludes, and exclusions alone mean "everything else"', () => {
    const p = parseWritePolicy({ SEEKSTONE_READ_PATHS: '!Journal/**,!Finance/**' });
    expect(isReadable(p, 'Projects/a.md')).toBe(true);
    expect(isReadable(p, 'Journal/a.md')).toBe(false);
    expect(isReadable(p, 'Finance/2026/tax.md')).toBe(false);
  });

  it('an exclusion carves out of an inclusion instead of being ORed with it', () => {
    const p = parseWritePolicy({ SEEKSTONE_READ_PATHS: 'notes/**,!notes/private/**' });
    expect(isReadable(p, 'notes/a.md')).toBe(true);
    expect(isReadable(p, 'notes/private/a.md')).toBe(false);
    expect(isReadable(p, 'other/a.md')).toBe(false);
  });

  it('applies the same rule to write paths', () => {
    const p = parseWritePolicy({ SEEKSTONE_WRITE_PATHS: 'journal/**,!journal/locked/**' });
    expect(isWritable(p, 'journal/a.md')).toBe(true);
    expect(isWritable(p, 'journal/locked/a.md')).toBe(false);
  });
});

describe('splitGlobs', () => {
  it('keeps commas inside brace sets', () => {
    expect(splitGlobs('Encyclopedia/{A,B}/**, inbox/*.md')).toEqual([
      'Encyclopedia/{A,B}/**',
      'inbox/*.md',
    ]);
    expect(splitGlobs('!a/{x,{y,z}}/**,b/**')).toEqual(['!a/{x,{y,z}}/**', 'b/**']);
  });

  it('brace globs work end to end for both scopes', () => {
    const p = parseWritePolicy({
      SEEKSTONE_READ_PATHS: '!Encyclopedia/{A,B}/**',
      SEEKSTONE_WRITE_PATHS: 'Notes/{inbox,drafts}/**',
    });
    expect(isReadable(p, 'Encyclopedia/A/x.md')).toBe(false);
    expect(isReadable(p, 'Encyclopedia/C/x.md')).toBe(true);
    expect(isWritable(p, 'Notes/drafts/x.md')).toBe(true);
    expect(isWritable(p, 'Notes/other/x.md')).toBe(false);
  });
});
