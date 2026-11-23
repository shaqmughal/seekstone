import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseWritePolicy, readScopeWalk } from '../policy.js';
import { scopeWarnings } from '../scope-warnings.js';
import { buildIndex } from './build.js';

/**
 * SHA-575: fast-glob reads from the fixed base of each include glob even
 * when that folder is a symlink, so a scoped boot walk (SEEKSTONE_READ_PATHS)
 * used to index files behind a linked starting folder.
 */

let base: string;
let vault: string;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'seekstone-build-links-'));
  vault = join(base, 'vault');
  mkdirSync(join(vault, 'Real'), { recursive: true });
  mkdirSync(join(base, 'out', 'sub'), { recursive: true });
  writeFileSync(join(vault, 'Real', 'r.md'), '# R\n');
  writeFileSync(join(base, 'out', 'secret.md'), '# Secret\n');
  writeFileSync(join(base, 'out', 'sub', 'deep.md'), '# Deep\n');
  writeFileSync(join(base, 'out', 'pic.png'), 'png');
  symlinkSync(
    join(base, 'out'),
    join(vault, 'Notes'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('scoped boot walk through a linked starting folder', () => {
  it.each([['Notes/**'], ['{Notes,Real}/**'], ['Notes/*.md'], ['Notes/**,Real/**']])(
    'indexes nothing behind the link for %s',
    async (globs) => {
      const built = await buildIndex(
        vault,
        readScopeWalk(parseWritePolicy({ SEEKSTONE_READ_PATHS: globs })),
      );
      for (const key of built.notes.keys()) expect(key.startsWith('Notes/'), key).toBe(false);
      expect([...built.attachments.byPath.keys()].some((k) => k.startsWith('notes/'))).toBe(false);
    },
  );

  it('still indexes the real folder in the same scope', async () => {
    const built = await buildIndex(
      vault,
      readScopeWalk(parseWritePolicy({ SEEKSTONE_READ_PATHS: '{Notes,Real}/**' })),
    );
    expect([...built.notes.keys()]).toEqual(['Real/r.md']);
  });

  it('keeps linked files out of the write-scope warning', async () => {
    const warnings = await scopeWarnings(
      vault,
      parseWritePolicy({ SEEKSTONE_READ_PATHS: 'Real/**', SEEKSTONE_WRITE_PATHS: 'Notes/**' }),
    );
    expect(warnings.join('\n')).not.toContain('secret.md');
  });
});
