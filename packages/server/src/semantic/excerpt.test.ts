import { describe, expect, it } from 'vitest';
import { chunkExcerpt } from './excerpt.js';

describe('chunkExcerpt', () => {
  const body = 'First paragraph about mills.\n\nSecond paragraph about cheese and dairy.';

  it('slices the winning chunk span and excerpts within it', () => {
    const span = { start: body.indexOf('Second'), end: body.length };
    expect(chunkExcerpt(body, span, ['cheese'], 120)).toContain('cheese and dairy');
    expect(chunkExcerpt(body, span, ['cheese'], 120)).not.toContain('mills');
  });

  it('falls back to the start of the chunk when no term matches', () => {
    const span = { start: body.indexOf('Second'), end: body.length };
    expect(chunkExcerpt(body, span, ['unrelated'], 120)).toMatch(/^Second paragraph/);
  });

  it('normalizes CRLF bodies so spans line up', () => {
    const crlf = 'First line.\r\n\r\nSecond target line.';
    const normalized = crlf.replace(/\r\n/g, '\n');
    const span = { start: normalized.indexOf('Second'), end: normalized.length };
    expect(chunkExcerpt(crlf, span, ['target'], 120)).toContain('Second target line.');
  });

  it('clamps a stale span that outruns the current body', () => {
    expect(chunkExcerpt('short', { start: 100, end: 200 }, [], 50)).toBe('short');
    expect(chunkExcerpt('short body here', { start: 6, end: 999 }, ['body'], 50)).toContain(
      'body here',
    );
  });
});
