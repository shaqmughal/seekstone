import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import { buildIndex } from '../index/build.js';
import { getLinks } from './get_links.js';

const NOTE_A = `---
title: Note A
---
# Note A

Links to [[b]] and [[c|alias]].

Also links to [[b]] again (duplicate).

Embeds: ![[embed.png]]
`;

const NOTE_B = `# Note B

Content of Note B. No outgoing links.
`;

const NOTE_C = `# Note C

Links back to [[a]].
`;

const NOTE_UNRESOLVED = `# Orphan

Points to [[Does Not Exist]] and [[Also Missing]].
`;

let vaultRoot: string;
let ctx: ServerContext;

beforeAll(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-get-links-'));
  await writeFile(join(vaultRoot, 'a.md'), NOTE_A, 'utf8');
  await writeFile(join(vaultRoot, 'b.md'), NOTE_B, 'utf8');
  await writeFile(join(vaultRoot, 'c.md'), NOTE_C, 'utf8');
  await writeFile(join(vaultRoot, 'orphan.md'), NOTE_UNRESOLVED, 'utf8');
  const result = await buildIndex(vaultRoot);
  ctx = { ...result, vaultRoot };
});

afterAll(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

describe('getLinks', () => {
  it('returns resolved links with target paths', () => {
    const result = getLinks(ctx, { path: 'a.md' });
    expect(result.path).toBe('a.md');
    const bLink = result.links.find((l) => l.target === 'b.md');
    expect(bLink).toBeDefined();
    expect(bLink?.resolved).toBe(true);
    expect(bLink?.linkType).toBe('wikilink');
  });

  it('de-duplicates the same target appearing multiple times', () => {
    const result = getLinks(ctx, { path: 'a.md' });
    const bLinks = result.links.filter((l) => l.target === 'b.md');
    expect(bLinks).toHaveLength(1);
  });

  it('resolves aliased links to their target path', () => {
    const result = getLinks(ctx, { path: 'a.md' });
    const cLink = result.links.find((l) => l.target === 'c.md');
    expect(cLink).toBeDefined();
    expect(cLink?.resolved).toBe(true);
    expect(cLink?.raw).toContain('[[c|alias]]');
  });

  it('marks unresolved links with resolved: false and no target', () => {
    const result = getLinks(ctx, { path: 'orphan.md' });
    expect(result.links.every((l) => l.resolved === false)).toBe(true);
    expect(result.links.every((l) => l.target === undefined)).toBe(true);
  });

  it('detects embeds as linkType "embed"', () => {
    const result = getLinks(ctx, { path: 'a.md' });
    const embed = result.links.find((l) => l.linkType === 'embed');
    expect(embed).toBeDefined();
    expect(embed?.raw).toContain('embed.png');
  });

  it('returns empty links for a note with no outgoing links', () => {
    const result = getLinks(ctx, { path: 'b.md' });
    expect(result.links).toHaveLength(0);
  });

  it('results are sorted by line number', () => {
    const result = getLinks(ctx, { path: 'a.md' });
    for (let i = 1; i < result.links.length; i++) {
      const prev = result.links[i - 1];
      const curr = result.links[i];
      if (prev !== undefined && curr !== undefined) {
        expect(curr.line).toBeGreaterThanOrEqual(prev.line);
      }
    }
  });

  it('throws "Path outside vault" for traversal attempts', () => {
    expect(() => getLinks(ctx, { path: '../etc/passwd' })).toThrow('Path outside vault');
  });

  it('throws "Note not found" for a path not in the index', () => {
    expect(() => getLinks(ctx, { path: 'no-such-note.md' })).toThrow('Note not found');
  });
});
