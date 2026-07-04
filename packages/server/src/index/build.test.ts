import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildIndex } from './build.js';

let vaultRoot: string;

const NOTE_WITH_FM = `---
title: Frontmatter Note
tags: [alpha, beta]
author: Bob
---
# Hello World

This is the note body.
`;

const NOTE_WITHOUT_FM = `# Plain Note

No frontmatter here — just body text.
`;

beforeAll(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-build-index-'));
  await writeFile(join(vaultRoot, 'with-fm.md'), NOTE_WITH_FM, 'utf8');
  await writeFile(join(vaultRoot, 'plain.md'), NOTE_WITHOUT_FM, 'utf8');
});

afterAll(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

describe('buildIndex', () => {
  it('index contains all .md files in vault', async () => {
    const { notes } = await buildIndex(vaultRoot);
    expect(notes.size).toBe(2);
  });

  it('notes Map has the same keys as vault relative paths', async () => {
    const { notes } = await buildIndex(vaultRoot);
    const keys = Array.from(notes.keys()).sort();
    expect(keys).toEqual(['plain.md', 'with-fm.md']);
  });

  it('buildMs is a non-negative number', async () => {
    const { buildMs } = await buildIndex(vaultRoot);
    expect(typeof buildMs).toBe('number');
    expect(buildMs).toBeGreaterThanOrEqual(0);
  });

  it('note with frontmatter: title populated from FM, fmKeys populated', async () => {
    const { notes } = await buildIndex(vaultRoot);
    const note = notes.get('with-fm.md');
    expect(note).toBeDefined();
    expect(note?.title).toBe('Frontmatter Note');
    expect(note?.fmKeys).toContain('title');
    expect(note?.fmKeys).toContain('tags');
    expect(note?.fmKeys).toContain('author');
  });

  it('note with frontmatter: parsed values stored on fm', async () => {
    const { notes } = await buildIndex(vaultRoot);
    const note = notes.get('with-fm.md');
    expect(note?.fm).toEqual({
      title: 'Frontmatter Note',
      tags: ['alpha', 'beta'],
      author: 'Bob',
    });
  });

  it('note without frontmatter: fm is null', async () => {
    const { notes } = await buildIndex(vaultRoot);
    expect(notes.get('plain.md')?.fm).toBeNull();
  });

  it('note without frontmatter: title falls back to filename without .md', async () => {
    const { notes } = await buildIndex(vaultRoot);
    const note = notes.get('plain.md');
    expect(note).toBeDefined();
    expect(note?.title).toBe('plain');
  });

  // chmod 0o000 does not restrict reads on Windows, so this Unix-permission
  // behavior can only be exercised on POSIX platforms.
  it.skipIf(process.platform === 'win32')(
    'unreadable file is skipped gracefully — index still contains other notes',
    async () => {
      const unreadableVault = await mkdtemp(join(tmpdir(), 'seekstone-unreadable-'));
      try {
        await writeFile(join(unreadableVault, 'readable.md'), '# Readable\n\nContent.\n', 'utf8');
        await writeFile(join(unreadableVault, 'unreadable.md'), '# Secret\n\nHidden.\n', 'utf8');
        await chmod(join(unreadableVault, 'unreadable.md'), 0o000);

        const { notes } = await buildIndex(unreadableVault);

        // The readable note must be indexed; the unreadable one silently skipped.
        expect(notes.has('readable.md')).toBe(true);
        expect(notes.has('unreadable.md')).toBe(false);
      } finally {
        // Restore permissions so rm can clean up.
        await chmod(join(unreadableVault, 'unreadable.md'), 0o644).catch(() => {});
        await rm(unreadableVault, { recursive: true, force: true });
      }
    },
  );

  it('empty vault returns empty index and empty notes map', async () => {
    const emptyVault = await mkdtemp(join(tmpdir(), 'seekstone-empty-vault-'));
    try {
      const { notes, index } = await buildIndex(emptyVault);
      expect(notes.size).toBe(0);
      // Confirm index is empty by searching something — should return nothing.
      const hits = index.search('anything');
      expect(hits).toEqual([]);
    } finally {
      await rm(emptyVault, { recursive: true, force: true });
    }
  });

  it('index is searchable for content in notes', async () => {
    const { index } = await buildIndex(vaultRoot);
    const hits = index.search('frontmatter', { boost: { title: 3 }, fuzzy: 0.2, prefix: true });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.id).toBe('with-fm.md');
  });

  it('tags from frontmatter are indexed', async () => {
    const { notes } = await buildIndex(vaultRoot);
    const note = notes.get('with-fm.md');
    expect(note?.tags).toContain('alpha');
    expect(note?.tags).toContain('beta');
  });
});
