import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crossesLink, dropLinkedEntries, hasDotSegment, historyCrossesLink } from './symlinks.js';

let base: string;
let vault: string;

function linkDir(target: string, path: string): void {
  symlinkSync(target, path, process.platform === 'win32' ? 'junction' : 'dir');
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'seekstone-crosseslink-'));
  vault = join(base, 'vault');
  mkdirSync(join(vault, 'notes', 'sub'), { recursive: true });
  writeFileSync(join(vault, 'notes', 'a.md'), 'a');
  mkdirSync(join(base, 'out'));
  linkDir(join(base, 'out'), join(vault, 'ext'));
  linkDir(join(vault, 'notes'), join(vault, 'notes', 'sub', 'back'));
  symlinkSync(join(vault, 'notes', 'a.md'), join(vault, 'notes', 'file.md'), 'file');
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('crossesLink (SHA-575)', () => {
  it('returns undefined for a path with no link, existing or not', () => {
    expect(crossesLink(vault, join(vault, 'notes', 'a.md'))).toBeUndefined();
    expect(crossesLink(vault, join(vault, 'notes', 'new', 'deep', 'x.md'))).toBeUndefined();
    expect(crossesLink(vault, vault)).toBeUndefined();
  });

  it('returns the first linked component, as a forward-slash vault path', () => {
    expect(crossesLink(vault, join(vault, 'ext', 'x', 'y.md'))).toBe('ext');
    expect(crossesLink(vault, join(vault, 'notes', 'sub', 'back', 'a.md'))).toBe('notes/sub/back');
  });

  it('checks the last component too', () => {
    expect(crossesLink(vault, join(vault, 'notes', 'file.md'))).toBe('notes/file.md');
    expect(crossesLink(vault, join(vault, 'ext'))).toBe('ext');
  });

  it('stops at a file used as a folder (ENOTDIR)', () => {
    expect(crossesLink(vault, join(vault, 'notes', 'a.md', 'x'))).toBeUndefined();
  });

  it('ignores paths outside the vault and a sibling folder sharing the prefix', () => {
    mkdirSync(`${vault}-backup`);
    linkDir(join(base, 'out'), join(`${vault}-backup`, 'l'));
    expect(crossesLink(vault, join(`${vault}-backup`, 'l', 'x'))).toBeUndefined();
    expect(crossesLink(vault, join(base, 'out'))).toBeUndefined();
  });

  it('does not check the vault root or its ancestors', () => {
    const alias = join(base, 'alias');
    linkDir(vault, alias);
    expect(crossesLink(alias, join(alias, 'notes', 'a.md'))).toBeUndefined();
    expect(crossesLink(alias, join(alias, 'ext', 'x'))).toBe('ext');
  });

  it('fails closed when a folder cannot be read', () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) {
      // Windows has no POSIX mode bits and root ignores them; the branch is the
      // same catch as ENOENT, so assert the open case instead.
      expect(crossesLink(vault, join(vault, 'notes', 'a.md'))).toBeUndefined();
      return;
    }
    chmodSync(join(vault, 'notes'), 0o000);
    try {
      expect(crossesLink(vault, join(vault, 'notes', 'sub', 'x.md'))).toBe('notes/sub');
    } finally {
      chmodSync(join(vault, 'notes'), 0o755);
    }
  });
});

describe('historyCrossesLink', () => {
  it('is false with no history yet, and for a real history folder', () => {
    expect(historyCrossesLink(vault)).toBe(false);
    mkdirSync(join(vault, '.seekstone', 'history', 'blobs'), { recursive: true });
    writeFileSync(join(vault, '.seekstone', 'history', 'manifest.jsonl'), '');
    expect(historyCrossesLink(vault)).toBe(false);
  });

  it.each([
    ['.seekstone', ['.seekstone']],
    ['history', ['.seekstone', 'history']],
    ['blobs', ['.seekstone', 'history', 'blobs']],
  ])('is true when %s is a link', (_name, parts) => {
    const at = join(vault, ...parts);
    mkdirSync(join(at, '..'), { recursive: true });
    linkDir(join(base, 'out'), at);
    expect(historyCrossesLink(vault)).toBe(true);
  });

  it('is true when manifest.jsonl is a link', () => {
    mkdirSync(join(vault, '.seekstone', 'history'), { recursive: true });
    writeFileSync(join(base, 'out', 'm'), '');
    symlinkSync(
      join(base, 'out', 'm'),
      join(vault, '.seekstone', 'history', 'manifest.jsonl'),
      'file',
    );
    expect(historyCrossesLink(vault)).toBe(true);
  });
});

describe('dropLinkedEntries', () => {
  it('drops entries under a linked folder and keeps the rest', () => {
    const kept = dropLinkedEntries(vault, [
      { relPath: 'notes/a.md' },
      { relPath: 'ext/o.md' },
      { relPath: 'ext/sub/deep.md' },
      { relPath: 'notes/sub/back/a.md' },
      { relPath: 'top.md' },
    ]);
    expect(kept.map((e) => e.relPath)).toEqual(['notes/a.md', 'top.md']);
  });
});

describe('hasDotSegment', () => {
  it.each([
    ['.drafts/a.md', true],
    ['notes/.old/a.md', true],
    ['notes/a.md', false],
    ['notes/a.b.md', false],
  ])('%s → %s', (p, want) => {
    expect(hasDotSegment(p)).toBe(want);
  });
});
