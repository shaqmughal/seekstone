import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { profileVault } from './index.js';

const NOTE_A = `---
title: Note A
tags: [work]
date: 2026-01-01
---
See [[Note B]] and https://example.com.
#inline-tag
`;

const NOTE_B = `---
title: Note B
---
See [[Note A]].
`;

const NOTE_C = `# Plain note
No frontmatter.
`;

describe('profileVault', () => {
  let vaultDir: string;

  beforeAll(async () => {
    vaultDir = await mkdtemp(join(tmpdir(), 'seekstone-profiler-test-'));
    await writeFile(join(vaultDir, 'note_a.md'), NOTE_A, 'utf8');
    await writeFile(join(vaultDir, 'note_b.md'), NOTE_B, 'utf8');
    await writeFile(join(vaultDir, 'note_c.md'), NOTE_C, 'utf8');
  });

  afterAll(async () => {
    await rm(vaultDir, { recursive: true, force: true });
  });

  it('counts.notes = 3', async () => {
    const stats = await profileVault({ vaultRoot: vaultDir });
    expect(stats.counts.notes).toBe(3);
  });

  it('counts.totalFiles = 3 (only .md files in this vault)', async () => {
    const stats = await profileVault({ vaultRoot: vaultDir });
    expect(stats.counts.totalFiles).toBe(3);
  });

  it('size.notesBytes > 0', async () => {
    const stats = await profileVault({ vaultRoot: vaultDir });
    expect(stats.size.notesBytes).toBeGreaterThan(0);
  });

  it('size.largestNotes.length > 0', async () => {
    const stats = await profileVault({ vaultRoot: vaultDir });
    expect(stats.size.largestNotes.length).toBeGreaterThan(0);
  });

  it('size.medianNote is not null', async () => {
    const stats = await profileVault({ vaultRoot: vaultDir });
    expect(stats.size.medianNote).not.toBeNull();
  });

  it('links.totalWikilinks = 2 (one in note_a, one in note_b)', async () => {
    const stats = await profileVault({ vaultRoot: vaultDir });
    expect(stats.links.totalWikilinks).toBe(2);
  });

  it('frontmatter.notesWithFrontmatter = 2 (note_a and note_b have FM)', async () => {
    const stats = await profileVault({ vaultRoot: vaultDir });
    expect(stats.frontmatter.notesWithFrontmatter).toBe(2);
  });

  it('frontmatter.malformedNotes is empty', async () => {
    const stats = await profileVault({ vaultRoot: vaultDir });
    expect(stats.frontmatter.malformedNotes).toHaveLength(0);
  });

  it('frontmatter.keyFrequency has "title" with count 2', async () => {
    const stats = await profileVault({ vaultRoot: vaultDir });
    const titleEntry = stats.frontmatter.keyFrequency.find((kf) => kf.key === 'title');
    expect(titleEntry).toBeDefined();
    expect(titleEntry?.count).toBe(2);
  });

  it('tags.distinctTags >= 2 (work and inline-tag)', async () => {
    const stats = await profileVault({ vaultRoot: vaultDir });
    expect(stats.tags.distinctTags).toBeGreaterThanOrEqual(2);
  });

  it('tags.inlineTagOccurrences >= 1 (the #inline-tag in note_a)', async () => {
    const stats = await profileVault({ vaultRoot: vaultDir });
    expect(stats.tags.inlineTagOccurrences).toBeGreaterThanOrEqual(1);
  });

  it('freshness.modifiedLast7Days = 3 (all files just created)', async () => {
    const stats = await profileVault({ vaultRoot: vaultDir });
    expect(stats.freshness.modifiedLast7Days).toBe(3);
  });

  describe('empty vault', () => {
    it('counts.notes = 0 and size.notesBytes = 0 when vault has no .md files', async () => {
      const emptyVault = await mkdtemp(join(tmpdir(), 'seekstone-profiler-empty-'));
      try {
        const stats = await profileVault({ vaultRoot: emptyVault });
        expect(stats.counts.notes).toBe(0);
        expect(stats.size.notesBytes).toBe(0);
      } finally {
        await rm(emptyVault, { recursive: true, force: true });
      }
    });
  });
});
