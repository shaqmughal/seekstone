import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { selectFrontmatterHeavyNotes } from './select.js';

const HEAVY1 = `---
title: Heavy Note One
tags: [work, project]
date: 2026-01-01
status: active
---
This is the body of heavy note one.
`;

const HEAVY2 = `---
title: Heavy Note Two
tags: [personal]
date: 2026-02-01
---
Body of note two.
`;

const LIGHT = `---
title: Light Note
---
Only one frontmatter key.
`;

const NOBODY = `# Plain Heading

No frontmatter here at all.
`;

describe('selectFrontmatterHeavyNotes', () => {
  let vaultDir: string;

  beforeAll(async () => {
    vaultDir = await mkdtemp(join(tmpdir(), 'seekstone-select-test-'));
    await writeFile(join(vaultDir, 'heavy1.md'), HEAVY1, 'utf8');
    await writeFile(join(vaultDir, 'heavy2.md'), HEAVY2, 'utf8');
    await writeFile(join(vaultDir, 'light.md'), LIGHT, 'utf8');
    await writeFile(join(vaultDir, 'nobody.md'), NOBODY, 'utf8');
  });

  afterAll(async () => {
    await rm(vaultDir, { recursive: true, force: true });
  });

  it('returns notes with >= minKeys frontmatter keys (default 3)', async () => {
    const results = await selectFrontmatterHeavyNotes(vaultDir, { sample: 25 });
    const relPaths = results.map((c) => c.relPath);
    expect(relPaths).toContain('heavy1.md');
    expect(relPaths).toContain('heavy2.md');
  });

  it('excludes notes with fewer than minKeys frontmatter keys', async () => {
    const results = await selectFrontmatterHeavyNotes(vaultDir, { sample: 25 });
    const relPaths = results.map((c) => c.relPath);
    expect(relPaths).not.toContain('light.md');
  });

  it('excludes notes without frontmatter', async () => {
    const results = await selectFrontmatterHeavyNotes(vaultDir, { sample: 25 });
    const relPaths = results.map((c) => c.relPath);
    expect(relPaths).not.toContain('nobody.md');
  });

  it('returns at most opts.sample notes when there are more candidates', async () => {
    const results = await selectFrontmatterHeavyNotes(vaultDir, { sample: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('is deterministic: same vault same call returns same relPaths in same order', async () => {
    const first = await selectFrontmatterHeavyNotes(vaultDir, { sample: 25 });
    const second = await selectFrontmatterHeavyNotes(vaultDir, { sample: 25 });
    expect(first.map((c) => c.relPath)).toEqual(second.map((c) => c.relPath));
  });

  it('returns [] when no notes have enough frontmatter keys', async () => {
    const emptyVault = await mkdtemp(join(tmpdir(), 'seekstone-select-empty-'));
    try {
      await writeFile(join(emptyVault, 'plain.md'), NOBODY, 'utf8');
      const results = await selectFrontmatterHeavyNotes(emptyVault, { sample: 25 });
      expect(results).toHaveLength(0);
    } finally {
      await rm(emptyVault, { recursive: true, force: true });
    }
  });

  it('each candidate has relPath, absPath, and fmKeys fields', async () => {
    const results = await selectFrontmatterHeavyNotes(vaultDir, { sample: 25 });
    for (const c of results) {
      expect(typeof c.relPath).toBe('string');
      expect(typeof c.absPath).toBe('string');
      expect(Array.isArray(c.fmKeys)).toBe(true);
      expect(c.fmKeys.length).toBeGreaterThanOrEqual(3);
    }
  });
});
