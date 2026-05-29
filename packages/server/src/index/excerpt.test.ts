import { describe, expect, it } from 'vitest';
import { extractExcerpt } from './excerpt.js';

describe('extractExcerpt', () => {
  it('term found near start of text: no leading ellipsis', () => {
    const text = 'hello world, this is a test string that is long enough to matter';
    const result = extractExcerpt(text, ['hello']);
    expect(result.startsWith('…')).toBe(false);
  });

  it('term found in middle: leading ellipsis, window centred on match', () => {
    const padding = 'a'.repeat(150);
    const text = `${padding}TARGET${padding}`;
    const result = extractExcerpt(text, ['TARGET'], 50);
    expect(result.startsWith('…')).toBe(true);
    expect(result).toContain('TARGET');
  });

  it('term found at end: trailing may not have ellipsis if we reach end', () => {
    const text = 'short text with TARGET';
    const result = extractExcerpt(text, ['TARGET'], 200);
    expect(result).toContain('TARGET');
    expect(result.endsWith('…')).toBe(false);
  });

  it('no terms found (empty array): returns start of text truncated if needed', () => {
    const text = 'the quick brown fox jumps over the lazy dog';
    const result = extractExcerpt(text, [], 20);
    expect(result).toBe('the quick brown fox…');
  });

  it('terms not in text: falls back to start of text', () => {
    const text = 'the quick brown fox jumps over the lazy dog';
    const result = extractExcerpt(text, ['zzz'], 20);
    expect(result).toBe('the quick brown fox…');
  });

  it('text shorter than maxLen: returns full text with no ellipsis', () => {
    const text = 'short text';
    const result = extractExcerpt(text, ['short'], 200);
    expect(result).toBe('short text');
    expect(result).not.toContain('…');
  });

  it('text longer than maxLen with no match: truncated with ellipsis', () => {
    const text = 'a'.repeat(300);
    const result = extractExcerpt(text, ['zzz'], 200);
    expect(result.endsWith('…')).toBe(true);
    // trimEnd of 200 'a's doesn't reduce length, so result is 200 a's + ellipsis
    expect(result.replace('…', '')).toHaveLength(200);
  });

  it('multiple terms: picks earliest occurrence', () => {
    const text = 'apple banana cherry';
    const result = extractExcerpt(text, ['cherry', 'apple'], 200);
    // 'apple' is earlier, so the result should contain it from the start
    expect(result).toContain('apple');
    expect(result.startsWith('…')).toBe(false);
  });

  it('case insensitive: term "hello" matches "HELLO" in text', () => {
    const text = 'Say HELLO to everyone';
    const result = extractExcerpt(text, ['hello'], 200);
    expect(result).toContain('HELLO');
    expect(result.startsWith('…')).toBe(false);
  });
});
