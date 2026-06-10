import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { copyVault, scratchPath } from './copy.js';

describe('scratchPath', () => {
  it('returns a string containing tmpdir() and the label', () => {
    const label = 'my-test-label';
    const result = scratchPath(label);
    expect(result).toContain(tmpdir());
    expect(result).toContain(label);
  });

  it('two calls with different labels return different paths', () => {
    const a = scratchPath('label-a');
    const b = scratchPath('label-b');
    expect(a).not.toBe(b);
  });
});

describe('copyVault', () => {
  let srcDir: string;

  beforeAll(async () => {
    srcDir = await mkdtemp(join(tmpdir(), 'seekstone-copy-test-src-'));
    await writeFile(join(srcDir, 'note.md'), '# Test Note\nHello world.\n', 'utf8');
  });

  afterAll(async () => {
    await rm(srcDir, { recursive: true, force: true });
  });

  it('creates a copy of a temp dir that contains the markdown file', async () => {
    const { readFile } = await import('node:fs/promises');
    const { copyRoot } = await copyVault(srcDir);
    try {
      const content = await readFile(join(copyRoot, 'note.md'), 'utf8');
      expect(content).toContain('Hello world.');
    } finally {
      await rm(copyRoot, { recursive: true, force: true });
    }
  });

  it('copyRoot !== originalRoot (not the same path)', async () => {
    const { copyRoot, originalRoot } = await copyVault(srcDir);
    try {
      expect(copyRoot).not.toBe(originalRoot);
    } finally {
      await rm(copyRoot, { recursive: true, force: true });
    }
  });

  it('copyRoot is under os.tmpdir()', async () => {
    const { copyRoot } = await copyVault(srcDir);
    try {
      // On macOS, tmpdir() returns a symlink path (/var/...) while copyRoot
      // uses realpath (/private/var/...). Compare using realpath of tmpdir().
      const tmpdirReal = await realpath(tmpdir());
      expect(copyRoot.startsWith(tmpdirReal)).toBe(true);
    } finally {
      await rm(copyRoot, { recursive: true, force: true });
    }
  });

  it('originalRoot is the absolute realpath of the source', async () => {
    const { copyRoot, originalRoot } = await copyVault(srcDir);
    try {
      const expected = await realpath(srcDir);
      expect(originalRoot).toBe(expected);
    } finally {
      await rm(copyRoot, { recursive: true, force: true });
    }
  });

  it('throws when dest path equals src path', async () => {
    // copyVault compares resolve(tmpdir(), label) to realpath(srcRoot).
    // On macOS, tmpdir() is a symlink (/var → /private/var) so the guard
    // `destAbs === srcAbs` is unreachable; the OS raises EINVAL from cp first.
    // Either way — identical src and dest must result in a thrown error.
    const label = `seekstone-test-guard-${Date.now()}`;
    const srcEqualsDest = join(tmpdir(), label);
    await mkdir(srcEqualsDest, { recursive: true });
    try {
      await expect(copyVault(srcEqualsDest, { label })).rejects.toThrow();
    } finally {
      await rm(srcEqualsDest, { recursive: true, force: true });
    }
  });

  it('throws when destination is inside source', async () => {
    // Exercise the `destAbs.startsWith(srcAbs + '/')` guard in copyVault.
    // On macOS, tmpdir() returns a symlink path (/var/...) while realpath
    // resolves it to /private/var/..., so the guard string-comparison may
    // not fire before the OS raises EINVAL from cp. Either way, copying a
    // directory into itself must reject.
    const outerLabel = `seekstone-test-outer-${Date.now()}`;
    const innerLabel = `${outerLabel}/inner`;
    const srcDir = join(tmpdir(), outerLabel);
    await mkdir(srcDir, { recursive: true });
    try {
      await expect(copyVault(srcDir, { label: innerLabel })).rejects.toThrow();
    } finally {
      await rm(srcDir, { recursive: true, force: true });
    }
  });
});
