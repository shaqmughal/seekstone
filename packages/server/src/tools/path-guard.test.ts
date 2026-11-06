import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WRITE_TOOLS } from '../dispatch.js';

/**
 * Static guards for the read scope (SHA-291). Index-backed tools are scoped
 * at build time, but anything that touches disk by path must go through
 * `resolveVaultPath`, and a write must be policy-checked before that, so a
 * refused write never reveals whether a hidden file exists.
 */
const dir = import.meta.dirname;
const sources = readdirSync(dir)
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  .map((f) => ({ file: f, src: readFileSync(join(dir, f), 'utf8') }));

describe('path guard', () => {
  it('every tool that reads files by path imports resolveVaultPath', () => {
    const offenders = sources
      .filter(({ src }) => /\breadFile\b|\baccess\b\(/.test(src))
      .filter(({ src }) => !/\bresolveVaultPath\b/.test(src))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('every write tool checks the write policy before resolving its path', () => {
    // append_periodic_note lives in periodic_note.ts; every other write tool in <name>.ts.
    const fileOf = (tool: string) =>
      tool === 'append_periodic_note' ? 'periodic_note.ts' : `${tool}.ts`;
    const wanted = new Set([...WRITE_TOOLS].map(fileOf));
    const writeFiles = sources.filter(({ file }) => wanted.has(file));
    expect(writeFiles.map((s) => s.file).sort()).toEqual([...wanted].sort());
    const offenders = writeFiles
      .filter(({ src }) => {
        const firstResolve = src.indexOf('resolveVaultPath(ctx');
        const firstAssert = src.indexOf('assertWritable(');
        return firstResolve !== -1 && (firstAssert === -1 || firstAssert > firstResolve);
      })
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
