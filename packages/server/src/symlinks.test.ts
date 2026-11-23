import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  crossesLink,
  dropLinkedEntries,
  findLink,
  hasDotSegment,
  historyCrossesLink,
  isSymlinkRefusal,
} from './symlinks.js';
import { linkEventAction } from './watcher.js';

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
});

describe('findLink and the watcher decision', () => {
  it('reports a real link as a link, and the watcher purges under it', () => {
    expect(findLink(vault, join(vault, 'ext', 'x.md'))).toEqual({ at: 'ext', error: false });
    expect(linkEventAction(vault, join(vault, 'ext', 'x.md'))).toEqual({
      kind: 'purge',
      at: 'ext',
    });
    expect(linkEventAction(vault, join(vault, 'notes', 'a.md'))).toEqual({ kind: 'process' });
  });

  it.runIf(process.platform !== 'win32' && process.getuid?.() !== 0)(
    'reports a failed lstat as an error: reads and writes fail closed, the watcher ignores it',
    () => {
      chmodSync(join(vault, 'notes'), 0o000);
      try {
        const abs = join(vault, 'notes', 'sub', 'x.md');
        expect(findLink(vault, abs)).toEqual({ at: 'notes/sub', error: true });
        expect(crossesLink(vault, abs)).toBe('notes/sub');
        expect(linkEventAction(vault, abs)).toEqual({ kind: 'ignore' });
      } finally {
        chmodSync(join(vault, 'notes'), 0o755);
      }
    },
  );
});

describe('isSymlinkRefusal', () => {
  it('matches only the exact refusal shapes', () => {
    const e = "goes through a symlink, and Seekstone doesn't follow symlinks.";
    expect(isSymlinkRefusal(`"a/b.md" ${e}`)).toBe(true);
    expect(isSymlinkRefusal(`Write not permitted: "a/b.md" ${e}`)).toBe(true);
    expect(isSymlinkRefusal(`Note not found: x ${e}`)).toBe(false);
    expect(isSymlinkRefusal(`Note not found: x" ${e}`)).toBe(false);
    expect(isSymlinkRefusal(`Path outside vault: x" ${e}`)).toBe(false);
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

  it.each(['manifest.jsonl', 'manifest.lock'])('is true when %s is a link', (name) => {
    mkdirSync(join(vault, '.seekstone', 'history'), { recursive: true });
    writeFileSync(join(base, 'out', 'm'), '');
    symlinkSync(join(base, 'out', 'm'), join(vault, '.seekstone', 'history', name), 'file');
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
