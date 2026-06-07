import { describe, expect, it } from 'vitest';
import { buildOutline } from './outline.js';

const NOTE_NO_FM = `# Top Heading

Some prose here.

## Sub-section

More text. ^block1

^block2

### Deep

End.
`;

const NOTE_WITH_FM = `---
title: My Note
tags: [foo, bar]
---
# First

Body.

## Second

Content. ^ref-a
`;

const NOTE_NO_HEADINGS = `---
title: Flat
---
Just a flat body with no headings.
`;

describe('buildOutline', () => {
  describe('headings', () => {
    it('returns headings in document order with correct level and text', () => {
      const out = buildOutline(NOTE_NO_FM);
      expect(out.headings).toEqual([
        expect.objectContaining({ text: 'Top Heading', level: 1, line: 1 }),
        expect.objectContaining({ text: 'Sub-section', level: 2, line: 5 }),
        expect.objectContaining({ text: 'Deep', level: 3, line: 11 }),
      ]);
    });

    it('byteOffset lands on the # of the heading', () => {
      const out = buildOutline(NOTE_NO_FM);
      for (const h of out.headings) {
        expect(NOTE_NO_FM[h.byteOffset]).toBe('#');
      }
    });

    it('excludes frontmatter delimiter lines from headings', () => {
      const out = buildOutline(NOTE_WITH_FM);
      expect(out.headings.map((h) => h.text)).toEqual(['First', 'Second']);
    });

    it('returns empty headings array for note with no headings (not an error)', () => {
      const out = buildOutline(NOTE_NO_HEADINGS);
      expect(out.headings).toEqual([]);
    });

    it('does not match #tag-style inline tags as headings', () => {
      const raw = `This has a #tag inline and ## not a heading mid-line.\n`;
      const out = buildOutline(raw);
      expect(out.headings).toEqual([]);
    });

    it('handles all six heading levels', () => {
      const raw = `# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6\n`;
      const out = buildOutline(raw);
      expect(out.headings.map((h) => h.level)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('does not match headings without a space after #', () => {
      const raw = `#notaheading\n# real heading\n`;
      const out = buildOutline(raw);
      expect(out.headings).toHaveLength(1);
      expect(out.headings[0]?.text).toBe('real heading');
    });
  });

  describe('blocks', () => {
    it('detects block refs at end of a content line', () => {
      const out = buildOutline(NOTE_NO_FM);
      expect(out.blocks).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'block1' })]),
      );
    });

    it('detects standalone block ref lines', () => {
      const out = buildOutline(NOTE_NO_FM);
      expect(out.blocks).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'block2' })]),
      );
    });

    it('byteOffset lands on ^ of the block ref', () => {
      const out = buildOutline(NOTE_NO_FM);
      for (const b of out.blocks) {
        expect(NOTE_NO_FM[b.byteOffset]).toBe('^');
      }
    });

    it('detects block refs after frontmatter only', () => {
      const rawWithFmBlock = `---\ntags: [foo]\n---\nBody. ^after-fm\n`;
      const out = buildOutline(rawWithFmBlock);
      expect(out.blocks).toHaveLength(1);
      expect(out.blocks[0]?.id).toBe('after-fm');
    });

    it('returns empty blocks when includeBlocks is false', () => {
      const out = buildOutline(NOTE_NO_FM, { includeBlocks: false });
      expect(out.blocks).toEqual([]);
    });
  });

  describe('frontmatterKeys', () => {
    it('returns top-level FM keys in original order', () => {
      const out = buildOutline(NOTE_WITH_FM);
      expect(out.frontmatterKeys).toEqual(['title', 'tags']);
    });

    it('returns empty array when no frontmatter', () => {
      const out = buildOutline(NOTE_NO_FM);
      expect(out.frontmatterKeys).toEqual([]);
    });
  });

  describe('totalBytes', () => {
    it('matches Buffer.byteLength of the raw content', () => {
      const out = buildOutline(NOTE_WITH_FM);
      expect(out.totalBytes).toBe(Buffer.byteLength(NOTE_WITH_FM, 'utf8'));
    });
  });

  describe('includeSizes', () => {
    it('adds byteLength to each heading when includeSizes is true', () => {
      const out = buildOutline(NOTE_NO_FM, { includeSizes: true });
      for (const h of out.headings) {
        expect(typeof h.byteLength).toBe('number');
      }
    });

    it('last heading byteLength extends to end of raw string', () => {
      const out = buildOutline(NOTE_NO_FM, { includeSizes: true });
      let checked = false;
      for (const [i, h] of out.headings.entries()) {
        if (i === out.headings.length - 1) {
          expect(h.byteLength).toBe(NOTE_NO_FM.length - h.byteOffset);
          checked = true;
        }
      }
      expect(checked).toBe(true);
    });

    it('heading byteLength spans to the next heading start', () => {
      const out = buildOutline(NOTE_NO_FM, { includeSizes: true });
      let checked = false;
      for (const [i, h] of out.headings.entries()) {
        const next = out.headings[i + 1];
        if (next !== undefined) {
          expect(h.byteLength).toBe(next.byteOffset - h.byteOffset);
          checked = true;
          break;
        }
      }
      expect(checked).toBe(true);
    });

    it('byteLength is absent when includeSizes is false', () => {
      const out = buildOutline(NOTE_NO_FM, { includeSizes: false });
      for (const h of out.headings) {
        expect(h.byteLength).toBeUndefined();
      }
    });
  });

  describe('payload size', () => {
    it('outline is a small fraction of full note bytes', () => {
      const body = `${'word '.repeat(500)}\n`.repeat(20);
      const raw = `---\ntitle: Big Note\n---\n# Section\n\n${body}`;
      const out = buildOutline(raw);
      const outlineBytes = Buffer.byteLength(JSON.stringify(out), 'utf8');
      expect(outlineBytes).toBeLessThan(out.totalBytes * 0.1);
    });
  });
});
