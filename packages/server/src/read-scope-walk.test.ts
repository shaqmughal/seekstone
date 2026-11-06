import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { walkVault } from '@seekstone/core/walk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isReadable, parseWritePolicy, readScopeWalk } from './policy.js';

/**
 * The index build walks with fast-glob; tools check paths with picomatch.
 * Both must select exactly the same files for any read scope, or a file
 * could be indexed but unreadable (or the reverse). SHA-291.
 */
const FILES = [
  'root.md',
  'notes/a.md',
  'notes/sub/b.md',
  'notes/.drafts/c.md',
  'notes/private/d.md',
  'inbox/e.md',
  'inbox/deep/f.md',
  'Journal/2026/g.md',
  'Daily Notes/2026-01-01.md',
  'assets/img.png',
];

const SCOPES = [
  'notes/**',
  'notes/**,!notes/private/**',
  '!Journal/**',
  '!Journal/**,!assets/**',
  'inbox/*.md',
  'Daily Notes/**,inbox/**',
  '*.md',
  '**/*.md',
  '**',
  '!{Journal,assets}/**',
  'notes/{sub,private}/**,inbox/*.md',
];

let vault: string;

beforeAll(async () => {
  vault = await mkdtemp(join(tmpdir(), 'seekstone-scopewalk-'));
  for (const f of FILES) {
    await mkdir(join(vault, f, '..'), { recursive: true });
    await writeFile(join(vault, f), 'x', 'utf8');
  }
  // Built-in ignores still apply under any scope.
  await mkdir(join(vault, '.obsidian'), { recursive: true });
  await writeFile(join(vault, '.obsidian', 'app.json'), '{}', 'utf8');
});

afterAll(async () => {
  await rm(vault, { recursive: true, force: true });
});

describe('walker and policy agree on the read scope', () => {
  it.each(SCOPES)('%s', async (globs) => {
    const policy = parseWritePolicy({ SEEKSTONE_READ_PATHS: globs });
    const walked = (await walkVault(vault, readScopeWalk(policy))).map((e) => e.relPath).sort();
    const expected = FILES.filter((f) => isReadable(policy, f)).sort();
    expect(walked).toEqual(expected);
    expect(walked.some((p) => p.startsWith('.obsidian/'))).toBe(false);
  });

  it('an unscoped walk is unchanged', async () => {
    const walked = (await walkVault(vault)).map((e) => e.relPath).sort();
    expect(walked).toEqual([...FILES].sort());
  });
});
