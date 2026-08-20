import { describe, expect, it } from 'vitest';
import { chunkNote } from './chunk.js';

const para = (words: number, word = 'lorem') => Array.from({ length: words }, () => word).join(' ');

describe('chunkNote', () => {
  it('merges adjacent paragraphs until the window reaches 250 words', () => {
    const body = [para(100), para(100), para(100), para(100)].join('\n\n');
    const chunks = chunkNote('Title', body);
    expect(chunks.map((c) => c.words)).toEqual([300, 100]);
  });

  it('flushes before a paragraph that would push the window past 400 words', () => {
    const body = [para(100), para(350)].join('\n\n');
    const chunks = chunkNote('Title', body);
    expect(chunks.map((c) => c.words)).toEqual([100, 350]);
  });

  it('keeps hard-wrapped lines (single newlines) inside one paragraph', () => {
    const body = 'a mineral consisting of\nlead sulphate, found in\nthe upper workings';
    const chunks = chunkNote('Anglesite', body);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toContain('lead sulphate, found in\nthe upper workings');
  });

  it('splits on blank lines that contain spaces or tabs', () => {
    const body = `${para(260)}\n \t \n${para(260)}`;
    expect(chunkNote('T', body)).toHaveLength(2);
  });

  it('hard-splits a single paragraph longer than 400 words', () => {
    const chunks = chunkNote('Japan', para(900));
    expect(chunks.map((c) => c.words)).toEqual([400, 400, 100]);
  });

  it('prefixes every chunk with the title and a blank line', () => {
    const chunks = chunkNote('Enigma', [para(300), para(300)].join('\n\n'));
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.text.startsWith('Enigma\n\n')).toBe(true);
  });

  it('returns a title-only chunk for an empty body', () => {
    expect(chunkNote('Asolo', '')).toEqual([{ text: 'Asolo', words: 0, start: 0, end: 0 }]);
    expect(chunkNote('Asolo', '\n\n  \n')).toEqual([{ text: 'Asolo', words: 0, start: 0, end: 0 }]);
  });

  it('reports exact body spans so consumers can slice the matching window', () => {
    const body = `  ${para(10, 'alpha')}  \n\n${para(260, 'beta')}\n\n${para(10, 'gamma')}`;
    const chunks = chunkNote('T', body);
    for (const c of chunks) {
      const sliced = body.slice(c.start, c.end);
      // The span covers exactly the trimmed window region.
      expect(sliced.startsWith(c.text.includes('alpha') ? 'alpha' : sliced.slice(0, 5))).toBe(true);
      expect(sliced.trim()).toBe(sliced); // trimmed bounds
    }
    const first = chunks[0];
    expect(first?.start).toBe(2); // skips the leading spaces
    expect(body.slice(first?.start, first?.end)).toContain('alpha');
  });

  it('gives oversized-paragraph pieces exact word-boundary spans', () => {
    const body = para(900, 'word');
    const chunks = chunkNote('T', body);
    expect(chunks.map((c) => c.words)).toEqual([400, 400, 100]);
    for (const c of chunks) {
      const sliced = body.slice(c.start, c.end);
      expect(sliced.startsWith('word')).toBe(true);
      expect(sliced.endsWith('word')).toBe(true);
    }
    expect(chunks[0]?.start).toBe(0);
    expect(chunks[2]?.end).toBe(body.length);
  });

  it('normalizes CRLF line endings before splitting', () => {
    const body = `${para(10)}\r\n\r\n${para(260)}`;
    const chunks = chunkNote('T', body);
    expect(chunks.map((c) => c.words)).toEqual([270]);
  });
});
