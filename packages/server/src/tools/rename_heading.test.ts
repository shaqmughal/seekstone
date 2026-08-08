import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contentHash } from '../content-hash.js';
import type { ServerContext } from '../context.js';
import { buildIndex } from '../index/build.js';
import { PERMISSIVE_POLICY, parseWritePolicy } from '../policy.js';
import { renameHeading } from './rename_heading.js';

const SUBJECT = `---
title: Subject
tags: [demo]
---
# Subject

Intro. See [[#Old Section]] and [[subject#Old Section|self alias]].

## Old Section

Section content.

## Other Section

More content.
`;

const LINKER = `# Linker

Points at [[subject#Old Section]] and aliased [[subject#Old Section|nice name]].

Embed: ![[subject#Old Section]]

Block ref stays: [[subject#^blockid]]

Other heading stays: [[subject#Other Section]]

\`\`\`
fenced [[subject#Old Section]] stays
\`\`\`
`;

const CASED = `# Cased

Uppercase fragment: [[subject#OLD SECTION]]
`;

const DECOY = `## Old Section

A different note with the same heading text; [[decoy#Old Section]] self-style links elsewhere must not be touched by renames in subject.md.
`;

let vaultRoot: string;
let ctx: ServerContext;

async function setup(policy = PERMISSIVE_POLICY): Promise<void> {
  vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-rename-heading-'));
  await writeFile(join(vaultRoot, 'subject.md'), SUBJECT, 'utf8');
  await writeFile(join(vaultRoot, 'linker.md'), LINKER, 'utf8');
  await writeFile(join(vaultRoot, 'cased.md'), CASED, 'utf8');
  await writeFile(join(vaultRoot, 'decoy.md'), DECOY, 'utf8');
  const result = await buildIndex(vaultRoot);
  ctx = { ...result, vaultRoot, policy };
}

beforeEach(async () => {
  await setup();
});

afterEach(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

describe('renameHeading', () => {
  it('renames the heading line, preserving markers and the frontmatter bytes', async () => {
    const result = await renameHeading(ctx, {
      path: 'subject.md',
      oldHeading: 'Old Section',
      newHeading: 'New Section',
    });
    const raw = await readFile(join(vaultRoot, 'subject.md'), 'utf8');
    expect(raw).toContain('## New Section');
    expect(raw).not.toContain('## Old Section');
    expect(raw.startsWith('---\ntitle: Subject\ntags: [demo]\n---\n')).toBe(true);
    expect(result.line).toBe(9);
    expect(result.contentHash).toBe(contentHash(raw));
  });

  it('rewrites its own anchors: [[#Old Section]] and [[subject#Old Section|alias]]', async () => {
    await renameHeading(ctx, {
      path: 'subject.md',
      oldHeading: 'Old Section',
      newHeading: 'New Section',
    });
    const raw = await readFile(join(vaultRoot, 'subject.md'), 'utf8');
    expect(raw).toContain('[[#New Section]]');
    expect(raw).toContain('[[subject#New Section|self alias]]');
  });

  it('rewrites wikilinks, aliased links, and embeds in referencing notes', async () => {
    const result = await renameHeading(ctx, {
      path: 'subject.md',
      oldHeading: 'Old Section',
      newHeading: 'New Section',
    });
    const linker = await readFile(join(vaultRoot, 'linker.md'), 'utf8');
    expect(linker).toContain('[[subject#New Section]]');
    expect(linker).toContain('[[subject#New Section|nice name]]');
    expect(linker).toContain('![[subject#New Section]]');
    // subject.md self-links (2) + linker.md (3) + cased.md (1)
    expect(result.linksRewritten).toBe(6);
    expect(result.notesRewritten).toBe(3);
  });

  it('matches fragments case-insensitively, like Obsidian', async () => {
    await renameHeading(ctx, {
      path: 'subject.md',
      oldHeading: 'old section',
      newHeading: 'New Section',
    });
    const cased = await readFile(join(vaultRoot, 'cased.md'), 'utf8');
    expect(cased).toContain('[[subject#New Section]]');
  });

  it('leaves block refs, other headings, fenced links, and same-heading decoys alone', async () => {
    await renameHeading(ctx, {
      path: 'subject.md',
      oldHeading: 'Old Section',
      newHeading: 'New Section',
    });
    const linker = await readFile(join(vaultRoot, 'linker.md'), 'utf8');
    expect(linker).toContain('[[subject#^blockid]]');
    expect(linker).toContain('[[subject#Other Section]]');
    expect(linker).toContain('fenced [[subject#Old Section]] stays');
    const decoy = await readFile(join(vaultRoot, 'decoy.md'), 'utf8');
    expect(decoy).toContain('## Old Section');
    expect(decoy).toContain('[[decoy#Old Section]]');
  });

  it('renames only the first of duplicate headings', async () => {
    const dup = '# Dup\n\n## Repeat\n\nfirst\n\n## Repeat\n\nsecond\n';
    await writeFile(join(vaultRoot, 'dup.md'), dup, 'utf8');
    const rebuilt = await buildIndex(vaultRoot);
    ctx = { ...rebuilt, vaultRoot, policy: PERMISSIVE_POLICY };

    const result = await renameHeading(ctx, {
      path: 'dup.md',
      oldHeading: 'Repeat',
      newHeading: 'Renamed',
    });
    const raw = await readFile(join(vaultRoot, 'dup.md'), 'utf8');
    expect(raw.indexOf('## Renamed')).toBeLessThan(raw.indexOf('## Repeat'));
    expect(result.line).toBe(3);
  });

  it('updates the in-memory index entry for the renamed note', async () => {
    await renameHeading(ctx, {
      path: 'subject.md',
      oldHeading: 'Old Section',
      newHeading: 'New Section',
    });
    expect(ctx.notes.get('subject.md')?.raw).toContain('## New Section');
    expect(ctx.notes.get('linker.md')?.raw).toContain('[[subject#New Section]]');
  });

  it('throws heading_not_found with the available headings', async () => {
    await expect(
      renameHeading(ctx, { path: 'subject.md', oldHeading: 'Missing', newHeading: 'X' }),
    ).rejects.toThrow('heading_not_found');
    try {
      await renameHeading(ctx, { path: 'subject.md', oldHeading: 'Missing', newHeading: 'X' });
    } catch (err) {
      const parsed = JSON.parse((err as Error).message);
      expect(parsed.available).toContain('Old Section');
      expect(parsed.available).toContain('Other Section');
    }
  });

  it('rejects newHeading containing link-breaking characters', async () => {
    for (const bad of ['a|b', 'a[b', 'a]b', 'a#b', 'a\nb']) {
      await expect(
        renameHeading(ctx, { path: 'subject.md', oldHeading: 'Old Section', newHeading: bad }),
      ).rejects.toThrow();
    }
  });

  it('enforces prevHash compare-and-swap', async () => {
    await expect(
      renameHeading(ctx, {
        path: 'subject.md',
        oldHeading: 'Old Section',
        newHeading: 'New Section',
        prevHash: 'not-the-hash',
      }),
    ).rejects.toThrow('hash_conflict');
    // Correct hash succeeds.
    const raw = await readFile(join(vaultRoot, 'subject.md'), 'utf8');
    await renameHeading(ctx, {
      path: 'subject.md',
      oldHeading: 'Old Section',
      newHeading: 'New Section',
      prevHash: contentHash(raw),
    });
  });

  it('reports referencing notes outside SEEKSTONE_WRITE_PATHS as skipped', async () => {
    await rm(vaultRoot, { recursive: true, force: true });
    await setup(parseWritePolicy({ SEEKSTONE_WRITE_PATHS: 'subject.md,cased.md,decoy.md,dup.md' }));
    const result = await renameHeading(ctx, {
      path: 'subject.md',
      oldHeading: 'Old Section',
      newHeading: 'New Section',
    });
    expect(result.skipped).toEqual(['linker.md']);
    const linker = await readFile(join(vaultRoot, 'linker.md'), 'utf8');
    expect(linker).toContain('[[subject#Old Section]]');
    // cased.md was writable and rewritten; subject self-links too.
    expect(result.linksRewritten).toBe(3);
  });

  it('rejects the rename itself when the note is outside write scope', async () => {
    await rm(vaultRoot, { recursive: true, force: true });
    await setup(parseWritePolicy({ SEEKSTONE_WRITE_PATHS: 'somewhere-else/**' }));
    await expect(
      renameHeading(ctx, {
        path: 'subject.md',
        oldHeading: 'Old Section',
        newHeading: 'New Section',
      }),
    ).rejects.toThrow();
  });

  it('throws "Note not found" for a missing note and rejects traversal', async () => {
    await expect(
      renameHeading(ctx, { path: 'nope.md', oldHeading: 'A', newHeading: 'B' }),
    ).rejects.toThrow('Note not found');
    await expect(
      renameHeading(ctx, { path: '../outside.md', oldHeading: 'A', newHeading: 'B' }),
    ).rejects.toThrow('Path outside vault');
  });
});
