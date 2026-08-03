import { describe, expect, it } from 'vitest';
import { hasMarkdownLinkTo, rewriteNoteLinks } from './rewrite_links.js';

/** Build pre/post note maps for a move of oldPath → newPath among `others`. */
function maps(oldPath: string, newPath: string, others: string[] = []) {
  const pre = new Map<string, unknown>([[oldPath, {}], ...others.map((p) => [p, {}] as const)]);
  const post = new Map<string, unknown>([[newPath, {}], ...others.map((p) => [p, {}] as const)]);
  return { pre, post };
}

describe('rewriteNoteLinks — wikilinks', () => {
  it('rewrites a basename wikilink when the basename changes', () => {
    const { pre, post } = maps('Old Name.md', 'New Name.md');
    const r = rewriteNoteLinks(
      'See [[Old Name]].',
      'ref.md',
      'Old Name.md',
      'New Name.md',
      pre,
      post,
    );
    expect(r.content).toBe('See [[New Name]].');
    expect(r.count).toBe(1);
  });

  it('leaves a basename wikilink byte-identical on a folder move (still resolves)', () => {
    const { pre, post } = maps('Italy.md', 'Archive/Italy.md');
    const r = rewriteNoteLinks(
      'See [[Italy]].',
      'ref.md',
      'Italy.md',
      'Archive/Italy.md',
      pre,
      post,
    );
    expect(r.content).toBe('See [[Italy]].');
    expect(r.count).toBe(0);
  });

  it('preserves alias, fragment, and embed prefix', () => {
    const { pre, post } = maps('a.md', 'b.md');
    const r = rewriteNoteLinks(
      'X ![[a#Section|shown]] and [[a#^blk]] end.',
      'ref.md',
      'a.md',
      'b.md',
      pre,
      post,
    );
    expect(r.content).toBe('X ![[b#Section|shown]] and [[b#^blk]] end.');
    expect(r.count).toBe(2);
  });

  it('uses the full path when the new basename is ambiguous', () => {
    const { pre, post } = maps('x.md', 'moved/note.md', ['other/note.md']);
    const r = rewriteNoteLinks('[[x]]', 'ref.md', 'x.md', 'moved/note.md', pre, post);
    expect(r.content).toBe('[[moved/note]]');
  });

  it('does not touch wikilinks that pointed elsewhere', () => {
    const { pre, post } = maps('a.md', 'b.md', ['c.md']);
    const r = rewriteNoteLinks('[[c]] and [[missing]]', 'ref.md', 'a.md', 'b.md', pre, post);
    expect(r.content).toBe('[[c]] and [[missing]]');
    expect(r.count).toBe(0);
  });

  it('skips links inside fenced code blocks', () => {
    const { pre, post } = maps('a.md', 'b.md');
    const raw = '[[a]]\n```\n[[a]]\n```\n[[a]]';
    const r = rewriteNoteLinks(raw, 'ref.md', 'a.md', 'b.md', pre, post);
    expect(r.content).toBe('[[b]]\n```\n[[a]]\n```\n[[b]]');
    expect(r.count).toBe(2);
  });

  it('rewrites path-style wikilinks that no longer resolve', () => {
    const { pre, post } = maps('notes/a.md', 'archive/a2.md');
    const r = rewriteNoteLinks('[[notes/a|A]]', 'ref.md', 'notes/a.md', 'archive/a2.md', pre, post);
    expect(r.content).toBe('[[a2|A]]');
  });
});

describe('rewriteNoteLinks — markdown links', () => {
  it('rewrites a relative markdown link, preserving %20 encoding', () => {
    const { pre, post } = maps('notes/My Note.md', 'archive/My Note.md');
    const r = rewriteNoteLinks(
      'See [it](My%20Note.md).',
      'notes/ref.md',
      'notes/My Note.md',
      'archive/My Note.md',
      pre,
      post,
    );
    expect(r.content).toBe('See [it](../archive/My%20Note.md).');
    expect(r.count).toBe(1);
  });

  it('rewrites a ../-style relative link from a sibling folder', () => {
    const { pre, post } = maps('a/target.md', 'b/target.md');
    const r = rewriteNoteLinks(
      '[t](../a/target.md)',
      'c/ref.md',
      'a/target.md',
      'b/target.md',
      pre,
      post,
    );
    expect(r.content).toBe('[t](../b/target.md)');
  });

  it('rewrites a vault-absolute markdown link in vault-absolute style', () => {
    const { pre, post } = maps('notes/a.md', 'archive/a.md');
    const r = rewriteNoteLinks(
      '[t](notes/a.md)',
      'ref.md',
      'notes/a.md',
      'archive/a.md',
      pre,
      post,
    );
    expect(r.content).toBe('[t](archive/a.md)');
  });

  it('preserves <...> wrapping and fragments', () => {
    const { pre, post } = maps('a note.md', 'b note.md');
    const r = rewriteNoteLinks(
      '[t](<a note.md#sec>)',
      'ref.md',
      'a note.md',
      'b note.md',
      pre,
      post,
    );
    expect(r.content).toBe('[t](<b note.md#sec>)');
  });

  it('leaves external URLs and unrelated links alone', () => {
    const { pre, post } = maps('a.md', 'b.md');
    const raw = '[x](https://example.com/a.md) [y](other.md) [z](#anchor)';
    const r = rewriteNoteLinks(raw, 'ref.md', 'a.md', 'b.md', pre, post);
    expect(r.content).toBe(raw);
    expect(r.count).toBe(0);
  });

  it('rewrites markdown embeds', () => {
    const { pre, post } = maps('a.md', 'b.md');
    const r = rewriteNoteLinks('![t](a.md)', 'ref.md', 'a.md', 'b.md', pre, post);
    expect(r.content).toBe('![t](b.md)');
  });
});

describe('hasMarkdownLinkTo', () => {
  it('detects relative, encoded, and vault-absolute forms', () => {
    expect(hasMarkdownLinkTo('[t](target.md)', 'ref.md', 'target.md')).toBe(true);
    expect(hasMarkdownLinkTo('[t](My%20Note.md)', 'ref.md', 'My Note.md')).toBe(true);
    expect(hasMarkdownLinkTo('[t](../a/t.md)', 'b/ref.md', 'a/t.md')).toBe(true);
    expect(hasMarkdownLinkTo('[t](a/t.md)', 'ref.md', 'a/t.md')).toBe(true);
  });
  it('ignores wikilinks, URLs, and non-matching targets', () => {
    expect(hasMarkdownLinkTo('[[target]]', 'ref.md', 'target.md')).toBe(false);
    expect(hasMarkdownLinkTo('[t](https://x.com/target.md)', 'ref.md', 'target.md')).toBe(false);
    expect(hasMarkdownLinkTo('[t](other.md)', 'ref.md', 'target.md')).toBe(false);
  });
});
