import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveInstructions } from './instructions.js';

interface Call {
  msg: string;
  fields?: Record<string, unknown>;
}

type StubLogMethod = (msg: string, fields?: Record<string, unknown>) => void;

function stubLog(): {
  warn: Call[];
  info: Call[];
  log: { warn: StubLogMethod; info: StubLogMethod };
} {
  const warn: Call[] = [];
  const info: Call[] = [];
  const log = {
    warn: (msg: string, fields?: Record<string, unknown>) => void warn.push({ msg, fields }),
    info: (msg: string, fields?: Record<string, unknown>) => void info.push({ msg, fields }),
  };
  return { warn, info, log };
}

let vault: string;

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'seekstone-instructions-'));
});

afterEach(async () => {
  await rm(vault, { recursive: true, force: true });
});

describe('resolveInstructions', () => {
  it('is undefined when SEEKSTONE_INSTRUCTIONS is unset (behaviour unchanged)', () => {
    const { log, warn, info } = stubLog();
    expect(resolveInstructions({}, vault, log)).toBeUndefined();
    expect(warn).toEqual([]);
    expect(info).toEqual([]);
  });

  it('is undefined for a blank SEEKSTONE_INSTRUCTIONS', () => {
    const { log } = stubLog();
    expect(resolveInstructions({ SEEKSTONE_INSTRUCTIONS: '   ' }, vault, log)).toBeUndefined();
  });

  it('reads an absolute path directly', async () => {
    const file = join(vault, 'instr.md');
    await writeFile(file, '  Use `search` before reading full notes.  \n', 'utf8');
    const { log, info } = stubLog();
    expect(resolveInstructions({ SEEKSTONE_INSTRUCTIONS: file }, vault, log)).toBe(
      'Use `search` before reading full notes.',
    );
    expect(info).toEqual([{ msg: 'instructions attached', fields: { bytes: 39 } }]);
  });

  it('resolves a relative path against the vault root', async () => {
    await writeFile(join(vault, 'preflight.md'), 'Read this first.', 'utf8');
    const { log } = stubLog();
    expect(resolveInstructions({ SEEKSTONE_INSTRUCTIONS: 'preflight.md' }, vault, log)).toBe(
      'Read this first.',
    );
  });

  it('warns once and returns undefined for a missing file, without failing', () => {
    const missing = join(vault, 'nope.md');
    const { log, warn } = stubLog();
    expect(resolveInstructions({ SEEKSTONE_INSTRUCTIONS: missing }, vault, log)).toBeUndefined();
    expect(warn).toHaveLength(1);
    expect(warn[0]?.msg).toMatch(/cannot read SEEKSTONE_INSTRUCTIONS file/);
    expect(warn[0]?.fields?.path).toBe(missing);
  });

  it('is undefined for a file that is empty after trim, with no warning', async () => {
    const file = join(vault, 'blank.md');
    await writeFile(file, '   \n\n  ', 'utf8');
    const { log, warn, info } = stubLog();
    expect(resolveInstructions({ SEEKSTONE_INSTRUCTIONS: file }, vault, log)).toBeUndefined();
    expect(warn).toEqual([]);
    expect(info).toEqual([]);
  });

  it('truncates content over 16 KB and warns, without splitting a multi-byte codepoint', async () => {
    const file = join(vault, 'big.md');
    const content = 'é'.repeat(9000);
    await writeFile(file, content, 'utf8');
    const { log, warn, info } = stubLog();
    const result = resolveInstructions({ SEEKSTONE_INSTRUCTIONS: file }, vault, log);
    expect(result).toBeDefined();
    expect(Buffer.byteLength(result ?? '', 'utf8')).toBeLessThanOrEqual(16 * 1024);
    expect(result).not.toContain('�');
    expect(result?.split('').every((c) => c === 'é')).toBe(true);
    expect(warn.some((w) => w.msg.includes('exceeds 16 KB'))).toBe(true);
    expect(info).toHaveLength(1);
    expect(info[0]?.fields?.bytes).toBe(Buffer.byteLength(result ?? '', 'utf8'));
  });
});
