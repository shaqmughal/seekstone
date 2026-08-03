import { describe, expect, it } from 'vitest';
import { assertHashMatch, contentHash } from './content-hash.js';

describe('contentHash', () => {
  it('is the sha-256 hex of the content', () => {
    // Known vector: sha256("hello") — stable across platforms.
    expect(contentHash('hello')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });
  it('is byte-sensitive (newline matters)', () => {
    expect(contentHash('a')).not.toBe(contentHash('a\n'));
  });
  it('accepts Buffers identically to strings', () => {
    expect(contentHash(Buffer.from('café', 'utf8'))).toBe(contentHash('café'));
  });
});

describe('assertHashMatch', () => {
  it('passes silently on a match', () => {
    expect(() => assertHashMatch('x', contentHash('x'), 'n.md')).not.toThrow();
  });
  it('throws structured hash_conflict with the current hash on mismatch', () => {
    let thrown: Error | undefined;
    try {
      assertHashMatch('current content', contentHash('stale content'), 'n.md');
    } catch (err) {
      thrown = err as Error;
    }
    expect(thrown).toBeDefined();
    const parsed = JSON.parse(thrown?.message ?? '{}');
    expect(parsed.error).toBe('hash_conflict');
    expect(parsed.path).toBe('n.md');
    expect(parsed.expected).toBe(contentHash('stale content'));
    expect(parsed.actual).toBe(contentHash('current content'));
    expect(parsed.hint).toContain('Re-read');
  });
});
