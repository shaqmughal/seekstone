import { describe, expect, it } from 'vitest';
import { assertWritable, isWritable, PERMISSIVE_POLICY, parseWritePolicy } from './policy.js';

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
