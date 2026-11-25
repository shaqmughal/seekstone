import { readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './repo-root.mjs';

// Built from parts so this file doesn't match the pattern it guards against.
const BAD_PATTERN = ['import.meta.url', ').pathname'].join('');

function mjsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return mjsFiles(p);
    return e.name.endsWith('.mjs') ? [p] : [];
  });
}

describe('repoRoot', () => {
  it('is an absolute path to the folder holding the root package.json', () => {
    expect(isAbsolute(repoRoot)).toBe(true);
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('seekstone-monorepo');
  });

  it('has no leading slash before a drive letter', () => {
    expect(repoRoot).not.toMatch(/^[/\\][A-Za-z]:/);
  });
});

describe('scripts guard', () => {
  it('no script under scripts/ resolves paths from a URL pathname', () => {
    const scriptsDir = join(repoRoot, 'scripts');
    const files = mjsFiles(scriptsDir);
    expect(files.length).toBeGreaterThan(10);
    const offenders = files
      .filter((f) => readFileSync(f, 'utf8').includes(BAD_PATTERN))
      .map((f) => relative(repoRoot, f));
    expect(offenders).toEqual([]);
  });
});
