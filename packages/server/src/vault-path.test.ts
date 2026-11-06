import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PERMISSIVE_POLICY } from './policy.js';
import { containVaultPath, notFoundError, resolveVaultPath } from './vault-path.js';

// resolve() gives the root a drive letter on Windows, so comparisons inside
// resolveVaultPath (which resolves its inputs) stay consistent cross-platform.
const ROOT = resolve(sep, 'home', 'u', 'vault');

describe('containVaultPath', () => {
  it('resolves a plain relative path inside the vault', () => {
    expect(containVaultPath(ROOT, 'notes/a.md')).toBe([ROOT, 'notes', 'a.md'].join(sep));
  });

  it('allows the vault root itself', () => {
    expect(containVaultPath(ROOT, '.')).toBe(ROOT);
  });

  it('normalizes internal ../ that stays inside the vault', () => {
    expect(containVaultPath(ROOT, 'notes/../a.md')).toBe([ROOT, 'a.md'].join(sep));
  });

  it('rejects a plain parent escape', () => {
    expect(() => containVaultPath(ROOT, '../escape.md')).toThrow('Path outside vault');
  });

  it('rejects the sibling-directory prefix escape (the startsWith gap)', () => {
    // /home/u/vault + ../vault-backup/secret.md → /home/u/vault-backup/secret.md,
    // which passes a bare startsWith('/home/u/vault') check.
    expect(() => containVaultPath(ROOT, '../vault-backup/secret.md')).toThrow('Path outside vault');
  });

  it('rejects a deep traversal that lands in a prefix-sibling', () => {
    expect(() => containVaultPath(ROOT, 'a/b/../../../vault2/x.md')).toThrow('Path outside vault');
  });

  it('rejects an absolute path outside the vault', () => {
    expect(() => containVaultPath(ROOT, resolve(sep, 'etc', 'passwd'))).toThrow(
      'Path outside vault',
    );
  });

  it('accepts an absolute path inside the vault', () => {
    const inside = [ROOT, 'notes', 'a.md'].join(sep);
    expect(containVaultPath(ROOT, inside)).toBe(inside);
  });
});

describe('resolveVaultPath (read scope, SHA-291)', () => {
  const scoped = { vaultRoot: ROOT, policy: { readOnly: false, readGlobs: ['notes/**'] } };

  it('is plain containment when SEEKSTONE_READ_PATHS is unset', () => {
    const ctx = { vaultRoot: ROOT, policy: PERMISSIVE_POLICY };
    expect(resolveVaultPath(ctx, 'journal/a.md')).toBe([ROOT, 'journal', 'a.md'].join(sep));
  });

  it('allows paths inside the read scope', () => {
    expect(resolveVaultPath(scoped, 'notes/a.md')).toBe([ROOT, 'notes', 'a.md'].join(sep));
  });

  it('refuses an out-of-scope path with an ENOENT-shaped error', () => {
    let caught: NodeJS.ErrnoException | undefined;
    try {
      resolveVaultPath(scoped, 'journal/a.md');
    } catch (err) {
      caught = err as NodeJS.ErrnoException;
    }
    const abs = [ROOT, 'journal', 'a.md'].join(sep);
    expect(caught?.code).toBe('ENOENT');
    expect(caught?.path).toBe(abs);
    expect(caught?.message).toBe(`ENOENT: no such file or directory, open '${abs}'`);
  });

  it('still reports containment escapes as outside the vault, not as missing', () => {
    expect(() => resolveVaultPath(scoped, '../vault-backup/x.md')).toThrow('Path outside vault');
  });
});

describe('notFoundError', () => {
  it('matches the message and code fs.readFile gives for a missing file on this OS', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ss-enoent-'));
    try {
      const missing = join(dir, 'nope.md');
      const real = await readFile(missing, 'utf8').catch((e: NodeJS.ErrnoException) => e);
      const ours = notFoundError(missing);
      expect(ours.message).toBe((real as NodeJS.ErrnoException).message);
      expect(ours.code).toBe((real as NodeJS.ErrnoException).code);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
