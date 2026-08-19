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
    expect(chunkNote('Asolo', '')).toEqual([{ text: 'Asolo', words: 0 }]);
    expect(chunkNote('Asolo', '\n\n  \n')).toEqual([{ text: 'Asolo', words: 0 }]);
  });

  it('normalizes CRLF line endings before splitting', () => {
    const body = `${para(10)}\r\n\r\n${para(260)}`;
    const chunks = chunkNote('T', body);
    expect(chunks.map((c) => c.words)).toEqual([270]);
  });
});
