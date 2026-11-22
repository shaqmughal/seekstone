import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _resetRealRoots, OUTSIDE_VAULT, realVaultTarget, symlinkTarget } from './symlinks.js';

/** SHA-575 unit cases for the symlink resolver; tools/symlinks.test.ts drives the tools. */

const dirType = process.platform === 'win32' ? 'junction' : 'dir';
let base: string;
let vault: string;

beforeEach(async () => {
  _resetRealRoots();
  base = await mkdtemp(join(tmpdir(), 'seekstone-symlink-unit-'));
  vault = join(base, 'vault');
  await mkdir(join(vault, 'notes'), { recursive: true });
  await writeFile(join(vault, 'notes', 'a.md'), '# A\n');
  await mkdir(join(base, 'outside'));
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

describe('symlinkTarget', () => {
  it('is undefined when no component is a link, or the path is missing', () => {
    expect(symlinkTarget(vault, join(vault, 'notes', 'a.md'))).toBeUndefined();
    expect(symlinkTarget(vault, join(vault, 'notes', 'new', 'b.md'))).toBeUndefined();
    expect(symlinkTarget(vault, vault)).toBeUndefined();
  });

  it('is undefined when a file sits where a folder is expected', () => {
    expect(symlinkTarget(vault, join(vault, 'notes', 'a.md', 'x.md'))).toBeUndefined();
  });

  it('classifies links inside, outside and to the vault root itself', async () => {
    await symlink(join(vault, 'notes'), join(vault, 'alias'), dirType);
    await symlink(join(base, 'outside'), join(vault, 'ext'), dirType);
    await symlink(vault, join(vault, 'notes', 'top'), dirType);
    expect(symlinkTarget(vault, join(vault, 'alias', 'a.md'))).toEqual({
      kind: 'inside',
      rel: 'notes/a.md',
    });
    expect(symlinkTarget(vault, join(vault, 'alias', 'new', 'b.md'))).toEqual({
      kind: 'inside',
      rel: 'notes/new/b.md',
    });
    expect(symlinkTarget(vault, join(vault, 'ext', 'x.md'))).toEqual({ kind: 'outside' });
    expect(symlinkTarget(vault, join(vault, 'notes', 'top'))).toEqual({ kind: 'inside', rel: '' });
  });

  it('works when the vault itself is reached through a link', async () => {
    const viaLink = join(base, 'vault-link');
    await symlink(vault, viaLink, dirType);
    await symlink(join(vault, 'notes'), join(vault, 'alias'), dirType);
    await symlink(join(base, 'outside'), join(vault, 'ext'), dirType);
    expect(symlinkTarget(viaLink, join(viaLink, 'notes', 'a.md'))).toBeUndefined();
    expect(symlinkTarget(viaLink, join(viaLink, 'alias', 'a.md'))).toEqual({
      kind: 'inside',
      rel: 'notes/a.md',
    });
    expect(symlinkTarget(viaLink, join(viaLink, 'ext', 'x.md'))).toEqual({ kind: 'outside' });
  });

  it('reports a dangling link as broken', async () => {
    await symlink(join(base, 'missing'), join(vault, 'dead'), dirType);
    expect(symlinkTarget(vault, join(vault, 'dead', 'x.md'))).toEqual({ kind: 'broken' });
  });
});

describe('realVaultTarget', () => {
  it('returns the real vault-relative path for a link inside the vault', async () => {
    await symlink(join(vault, 'notes'), join(vault, 'alias'), dirType);
    expect(realVaultTarget(vault, join(vault, 'alias', 'a.md'), 'alias/a.md', false)).toBe(
      'notes/a.md',
    );
  });

  it('refuses a link outside the vault unless follow is on', async () => {
    await symlink(join(base, 'outside'), join(vault, 'ext'), dirType);
    const abs = join(vault, 'ext', 'x.md');
    expect(() => realVaultTarget(vault, abs, 'ext/x.md', false)).toThrow(
      'Path outside vault: ext/x.md goes through a symlink to a location outside the vault. Set SEEKSTONE_FOLLOW_SYMLINKS=1 to allow it.',
    );
    expect(realVaultTarget(vault, abs, 'ext/x.md', true)).toBe(OUTSIDE_VAULT);
  });

  it('refuses a dangling link even with follow on', async () => {
    await symlink(join(base, 'missing'), join(vault, 'dead'), dirType);
    expect(() => realVaultTarget(vault, join(vault, 'dead', 'x.md'), 'dead/x.md', true)).toThrow(
      /dangling or loops/,
    );
  });
});
