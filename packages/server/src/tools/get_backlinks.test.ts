import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import { buildIndex } from '../index/build.js';
import { getBacklinks } from './get_backlinks.js';

// target.md is linked by source_a.md and source_b.md; source_c.md links elsewhere
const TARGET = `# Target Note\n\nThis is the target.\n`;

const SOURCE_A = `# Source A\n\nLinks to [[target]].\n`;

const SOURCE_B = `# Source B\n\nAlso links to [[target]] with an alias: [[target|T]].\n`;

const SOURCE_C = `# Source C\n\nLinks to [[source_a]] but not the target.\n`;

const NO_LINKS = `# Isolated\n\nNo links here.\n`;

let vaultRoot: string;
let ctx: ServerContext;

beforeAll(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-get-backlinks-'));
  await writeFile(join(vaultRoot, 'target.md'), TARGET, 'utf8');
  await writeFile(join(vaultRoot, 'source_a.md'), SOURCE_A, 'utf8');
  await writeFile(join(vaultRoot, 'source_b.md'), SOURCE_B, 'utf8');
  await writeFile(join(vaultRoot, 'source_c.md'), SOURCE_C, 'utf8');
  await writeFile(join(vaultRoot, 'isolated.md'), NO_LINKS, 'utf8');
  const result = await buildIndex(vaultRoot);
  ctx = { ...result, vaultRoot };
});

afterAll(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

describe('getBacklinks', () => {
  it('returns all notes that link to the target', () => {
    const result = getBacklinks(ctx, { path: 'target.md' });
    expect(result.target).toBe('target.md');
    const paths = result.backlinks.map((b) => b.path);
    expect(paths).toContain('source_a.md');
    expect(paths).toContain('source_b.md');
    expect(paths).not.toContain('source_c.md');
    expect(paths).not.toContain('isolated.md');
  });

  it('total reflects the full count before limit', () => {
    const result = getBacklinks(ctx, { path: 'target.md' });
    expect(result.total).toBeGreaterThanOrEqual(2);
    expect(result.total).toBe(result.backlinks.length);
  });

  it('includes line number for each backlink', () => {
    const result = getBacklinks(ctx, { path: 'target.md' });
    for (const bl of result.backlinks) {
      expect(bl.line).toBeGreaterThan(0);
    }
  });

  it('includes excerpt by default (includeContext defaults to true)', () => {
    const result = getBacklinks(ctx, { path: 'target.md' });
    for (const bl of result.backlinks) {
      expect(bl.excerpt).toBeDefined();
      expect(bl.excerpt).toContain('[[target');
    }
  });

  it('omits excerpt when includeContext is false', () => {
    const result = getBacklinks(ctx, { path: 'target.md', includeContext: false });
    for (const bl of result.backlinks) {
      expect(bl.excerpt).toBeUndefined();
    }
  });

  it('de-duplicates multiple links from the same source note', () => {
    // source_b.md links [[target]] twice; should produce one entry
    const result = getBacklinks(ctx, { path: 'target.md' });
    const fromB = result.backlinks.filter((b) => b.path === 'source_b.md');
    expect(fromB).toHaveLength(1);
  });

  it('respects limit', () => {
    const result = getBacklinks(ctx, { path: 'target.md', limit: 1 });
    expect(result.backlinks).toHaveLength(1);
    expect(result.total).toBeGreaterThanOrEqual(2);
  });

  it('results sorted by source path ascending', () => {
    const result = getBacklinks(ctx, { path: 'target.md' });
    const paths = result.backlinks.map((b) => b.path);
    expect(paths).toEqual([...paths].sort());
  });

  it('returns empty backlinks for a note nobody links to', () => {
    const result = getBacklinks(ctx, { path: 'isolated.md' });
    expect(result.backlinks).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('throws "Path outside vault" for traversal attempts', () => {
    expect(() => getBacklinks(ctx, { path: '../etc/passwd' })).toThrow('Path outside vault');
  });
});
