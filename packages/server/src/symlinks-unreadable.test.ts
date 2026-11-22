import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { realVaultTarget, symlinkTarget } from './symlinks.js';

/**
 * SHA-575: a link whose target can't be resolved for a reason other than a
 * missing file or a loop (here EACCES, as on a folder without search
 * permission) gets its own error instead of "dangling or loops". The fs mock
 * makes realpath fail that way on every OS, as user permissions can't.
 */

const denied = vi.hoisted(() => ({ path: '' }));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const native = ((p: unknown, ...rest: unknown[]) => {
    if (denied.path !== '' && String(p).startsWith(denied.path)) {
      throw Object.assign(new Error(`EACCES: permission denied, realpath '${String(p)}'`), {
        code: 'EACCES',
      });
    }
    return (actual.realpathSync.native as (...a: unknown[]) => unknown)(p, ...rest);
  }) as typeof actual.realpathSync.native;
  const realpathSync = Object.assign(
    (...a: Parameters<typeof actual.realpathSync>) => actual.realpathSync(...a),
    { native },
  ) as typeof actual.realpathSync;
  return { ...actual, realpathSync };
});

let base: string;
let vault: string;

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'seekstone-symlink-eacces-'));
  vault = join(base, 'vault');
  await mkdir(vault);
  await mkdir(join(base, 'locked'));
  await symlink(
    join(base, 'locked'),
    join(vault, 'l'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  denied.path = join(vault, 'l');
});

afterEach(async () => {
  denied.path = '';
  await rm(base, { recursive: true, force: true });
});

it('reports a link that fails to resolve with its error code, not as dangling', () => {
  const abs = join(vault, 'l', 'x.md');
  expect(symlinkTarget(vault, abs)).toEqual({ kind: 'unreadable', code: 'EACCES' });
  expect(() => realVaultTarget(vault, abs, 'l/x.md', true)).toThrow(
    "Path not resolved: l/x.md goes through a symlink that can't be resolved (EACCES).",
  );
});
