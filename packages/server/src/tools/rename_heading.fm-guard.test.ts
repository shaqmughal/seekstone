import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ServerContext } from '../context.js';
import { buildIndex } from '../index/build.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import { renameHeading } from './rename_heading.js';

// Corrupt the frontmatter region on write to prove the post-write guard
// actually fires — the same failure class patch_note's verifyFrontmatter
// defends against.
vi.mock('../atomic-write.js', () => ({
  atomicWrite: async (absPath: string, content: string) => {
    const { writeFile: wf } = await import('node:fs/promises');
    await wf(absPath, content.replace('title: Subject', 'title: CORRUPTED'), 'utf8');
  },
}));

let vaultRoot: string;
let ctx: ServerContext;

beforeAll(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-rename-fm-guard-'));
  await writeFile(
    join(vaultRoot, 'subject.md'),
    '---\ntitle: Subject\n---\n# Subject\n\n## Old\n\nbody\n',
    'utf8',
  );
  const built = await buildIndex(vaultRoot);
  ctx = { ...built, vaultRoot, policy: PERMISSIVE_POLICY };
});

afterAll(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

describe('renameHeading frontmatter guard', () => {
  it('throws when the written frontmatter region is not byte-identical', async () => {
    await expect(
      renameHeading(ctx, { path: 'subject.md', oldHeading: 'Old', newHeading: 'New' }),
    ).rejects.toThrow('Write-safety violation: frontmatter region changed unexpectedly');
  });
});
