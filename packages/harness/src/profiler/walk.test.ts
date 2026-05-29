import { describe, expect, it } from 'vitest';
import { classify } from './walk.js';

describe('classify', () => {
  it('classifies markdown as note', () => {
    expect(classify('Foo/bar.md')).toBe('note');
  });
  it('treats `.excalidraw.md` as note (FM + links live there)', () => {
    expect(classify('Excalidraw/Drawing.excalidraw.md')).toBe('note');
  });
  it('treats `.excalidraw` (no .md) as excalidraw', () => {
    expect(classify('Excalidraw/raw.excalidraw')).toBe('excalidraw');
  });
  it('classifies images / pdfs / canvases', () => {
    expect(classify('a.png')).toBe('image');
    expect(classify('a.PDF')).toBe('pdf');
    expect(classify('graph.canvas')).toBe('canvas');
  });
  it('falls back to other', () => {
    expect(classify('foo.xyz')).toBe('other');
  });
});
