import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from './frontmatter.js';

describe('parseFrontmatter', () => {
  it('returns absent when no `---` opener', () => {
    const r = parseFrontmatter('# Just a note\n\nNo frontmatter here.\n');
    expect(r.present).toBe(false);
    expect(r.data).toBeNull();
    expect(r.bodyStart).toBe(0);
    expect(r.body).toBe('# Just a note\n\nNo frontmatter here.\n');
  });

  it('parses a typical frontmatter block', () => {
    const text = '---\ntitle: Hello\ntags: [a, b]\n---\n# Body\n';
    const r = parseFrontmatter(text);
    expect(r.present).toBe(true);
    expect(r.malformed).toBe(false);
    expect(r.keys).toEqual(['title', 'tags']);
    expect(r.body).toBe('# Body\n');
    expect(r.bodyStart).toBe(text.indexOf('# Body'));
  });

  it('flags malformed YAML', () => {
    const text = '---\ntitle: : :\n  - bad\n---\nbody\n';
    const r = parseFrontmatter(text);
    expect(r.present).toBe(true);
    expect(r.malformed).toBe(true);
    expect(r.data).toBeNull();
  });

  it('handles CRLF line endings', () => {
    const text = '---\r\ntitle: Hello\r\n---\r\nbody\r\n';
    const r = parseFrontmatter(text);
    expect(r.present).toBe(true);
    expect(r.malformed).toBe(false);
    expect(r.keys).toEqual(['title']);
    expect(r.body).toBe('body\r\n');
  });

  it('flags unterminated frontmatter as malformed', () => {
    const text = '---\ntitle: Hello\n# Body without closing fence\n';
    const r = parseFrontmatter(text);
    expect(r.present).toBe(true);
    expect(r.malformed).toBe(true);
  });

  it('tolerates a leading UTF-8 BOM', () => {
    const text = '﻿---\ntitle: Hello\n---\nbody\n';
    const r = parseFrontmatter(text);
    expect(r.present).toBe(true);
    expect(r.keys).toEqual(['title']);
  });
});
