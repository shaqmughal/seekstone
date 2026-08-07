import { resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveVaultPath } from './vault-path.js';

// resolve() gives the root a drive letter on Windows, so comparisons inside
// resolveVaultPath (which resolves its inputs) stay consistent cross-platform.
const ROOT = resolve(sep, 'home', 'u', 'vault');

describe('resolveVaultPath', () => {
  it('resolves a plain relative path inside the vault', () => {
    expect(resolveVaultPath(ROOT, 'notes/a.md')).toBe([ROOT, 'notes', 'a.md'].join(sep));
  });

  it('allows the vault root itself', () => {
    expect(resolveVaultPath(ROOT, '.')).toBe(ROOT);
  });

  it('normalizes internal ../ that stays inside the vault', () => {
    expect(resolveVaultPath(ROOT, 'notes/../a.md')).toBe([ROOT, 'a.md'].join(sep));
  });

  it('rejects a plain parent escape', () => {
    expect(() => resolveVaultPath(ROOT, '../escape.md')).toThrow('Path outside vault');
  });

  it('rejects the sibling-directory prefix escape (the startsWith gap)', () => {
    // /home/u/vault + ../vault-backup/secret.md → /home/u/vault-backup/secret.md,
    // which passes a bare startsWith('/home/u/vault') check.
    expect(() => resolveVaultPath(ROOT, '../vault-backup/secret.md')).toThrow('Path outside vault');
  });

  it('rejects a deep traversal that lands in a prefix-sibling', () => {
    expect(() => resolveVaultPath(ROOT, 'a/b/../../../vault2/x.md')).toThrow('Path outside vault');
  });

  it('rejects an absolute path outside the vault', () => {
    expect(() => resolveVaultPath(ROOT, resolve(sep, 'etc', 'passwd'))).toThrow(
      'Path outside vault',
    );
  });

  it('accepts an absolute path inside the vault', () => {
    const inside = [ROOT, 'notes', 'a.md'].join(sep);
    expect(resolveVaultPath(ROOT, inside)).toBe(inside);
  });
});
