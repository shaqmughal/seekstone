import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ServerContext } from '../context.js';
import { buildIndex } from '../index/build.js';
import { buildResolveMaps, resolveLink } from '../index/resolve.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import { getLinks } from './get_links.js';

// Spy on the real resolver so a test can count resolve-map builds.
vi.mock('../index/resolve.js', { spy: true });

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

const NOTE_ROBERT = `---
aliases: [Bob]
---
# Robert
`;

const NOTE_DAILY = `# Daily

Met [[Bob]] today.
`;

beforeAll(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-get-links-'));
  await writeFile(join(vaultRoot, 'a.md'), NOTE_A, 'utf8');
  await writeFile(join(vaultRoot, 'b.md'), NOTE_B, 'utf8');
  await writeFile(join(vaultRoot, 'c.md'), NOTE_C, 'utf8');
  await writeFile(join(vaultRoot, 'orphan.md'), NOTE_UNRESOLVED, 'utf8');
  await writeFile(join(vaultRoot, 'robert.md'), NOTE_ROBERT, 'utf8');
  await writeFile(join(vaultRoot, 'daily.md'), NOTE_DAILY, 'utf8');
  const result = await buildIndex(vaultRoot);
  ctx = { ...result, vaultRoot, policy: PERMISSIVE_POLICY };
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

  it('resolves links through frontmatter aliases (SHA-22)', () => {
    const result = getLinks(ctx, { path: 'daily.md' });
    const bobLink = result.links.find((l) => l.raw.includes('[[Bob]]'));
    expect(bobLink?.resolved).toBe(true);
    expect(bobLink?.target).toBe('robert.md');
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

describe('getLinks: attachment embeds (SHA-553)', () => {
  let vault: string;

  beforeAll(async () => {
    vault = await mkdtemp(join(tmpdir(), 'seekstone-get-links-att-'));
    await mkdir(join(vault, 'img'));
    await writeFile(join(vault, 'img', 'x.png'), 'png', 'utf8');
    await writeFile(join(vault, 'other.md'), '# Other\n', 'utf8');
    await writeFile(
      join(vault, 'n.md'),
      '# N\n\n![[x.png]]\n![[missing.png]]\n[[other]]\n[[nowhere]]\n',
      'utf8',
    );
  });

  afterAll(async () => {
    await rm(vault, { recursive: true, force: true });
  });

  it('resolves an embed of an existing attachment and leaves a missing one unresolved', async () => {
    const built = await buildIndex(vault);
    const actx: ServerContext = { ...built, vaultRoot: vault, policy: PERMISSIVE_POLICY };
    const { links } = getLinks(actx, { path: 'n.md' });
    expect(links.map(({ raw, resolved, target }) => ({ raw, resolved, target }))).toEqual([
      { raw: '![[x.png]]', resolved: true, target: 'img/x.png' },
      { raw: '![[missing.png]]', resolved: false, target: undefined },
      { raw: '[[other]]', resolved: true, target: 'other.md' },
      { raw: '[[nowhere]]', resolved: false, target: undefined },
    ]);
  });

  it('builds the resolve maps once per call, not once per link', async () => {
    const built = await buildIndex(vault);
    const actx: ServerContext = { ...built, vaultRoot: vault, policy: PERMISSIVE_POLICY };
    vi.mocked(buildResolveMaps).mockClear();
    vi.mocked(resolveLink).mockClear();
    getLinks(actx, { path: 'n.md' });
    expect(buildResolveMaps).toHaveBeenCalledTimes(1);
    // resolveLink rebuilds the maps internally (invisible to the spy) unless
    // it is handed them, so every call must get the one prebuilt set.
    const maps = vi.mocked(buildResolveMaps).mock.results[0]?.value;
    expect(maps).toBeDefined();
    expect(vi.mocked(resolveLink).mock.calls).toHaveLength(4);
    for (const call of vi.mocked(resolveLink).mock.calls) expect(call[2]).toBe(maps);
  });

  it('reuses the resolve maps on repeat calls until the index changes (SHA-461)', async () => {
    const built = await buildIndex(vault);
    const actx: ServerContext = { ...built, vaultRoot: vault, policy: PERMISSIVE_POLICY };
    vi.mocked(buildResolveMaps).mockClear();
    const first = getLinks(actx, { path: 'n.md' });
    expect(getLinks(actx, { path: 'n.md' })).toEqual(first);
    expect(buildResolveMaps).toHaveBeenCalledTimes(1);
    actx.generation++;
    getLinks(actx, { path: 'n.md' });
    expect(buildResolveMaps).toHaveBeenCalledTimes(2);
  });

  it('skips building the resolve maps for a note with no links', async () => {
    const built = await buildIndex(vault);
    const actx: ServerContext = { ...built, vaultRoot: vault, policy: PERMISSIVE_POLICY };
    vi.mocked(buildResolveMaps).mockClear();
    expect(getLinks(actx, { path: 'other.md' })).toEqual({ path: 'other.md', links: [] });
    expect(buildResolveMaps).not.toHaveBeenCalled();
  });
});
