import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  READ_SCOPE_SENTINEL,
  readScopeProbes,
  renderReadScopeMarkdown,
  runReadScopeCheck,
} from './read-scope.js';

// Boot the server from source over real stdio MCP, the same path the CLI
// takes against the built bundle.
const SERVER_SRC = resolve(import.meta.dirname, '../../../server/src/index.ts');
const CMD = [process.execPath, '--import', 'tsx', SERVER_SRC];

let vault: string;

beforeAll(async () => {
  vault = await mkdtemp(join(tmpdir(), 'seekstone-readscope-src-'));
  await mkdir(join(vault, '.obsidian'), { recursive: true });
  await mkdir(join(vault, 'Notes'), { recursive: true });
  await writeFile(join(vault, 'Notes', 'Alpha.md'), '# Alpha\nSome visible text.\n', 'utf8');
  await writeFile(join(vault, 'Notes', 'Beta.md'), '# Beta\nSee [[Alpha]].\n', 'utf8');
});

afterAll(async () => {
  await rm(vault, { recursive: true, force: true });
});

describe('read-scope no-leak check', () => {
  it('passes against the real server: every served tool probed, nothing leaks', async () => {
    const report = await runReadScopeCheck(CMD, vault);
    expect(report.unprobed).toEqual([]);
    expect(report.leaks).toEqual([]);
    expect(report.servedTools.length).toBeGreaterThan(20);
    expect(report.calls.length).toBeGreaterThan(report.servedTools.length);
    expect(report.hiddenIntact).toBe(true);
    expect(report.pass).toBe(true);
    expect(renderReadScopeMarkdown(report)).toContain('**PASS**');
    // The source vault is untouched.
    expect(await readFile(join(vault, 'Notes', 'Alpha.md'), 'utf8')).toBe(
      '# Alpha\nSome visible text.\n',
    );
  }, 120_000);

  it('fails when the server does not scope reads (control: same probes, no SEEKSTONE_READ_PATHS)', async () => {
    // A server that ignores SEEKSTONE_READ_PATHS: strip it in a wrapper.
    const wrapper = join(vault, '..', `unscoped-${Date.now()}.mjs`);
    await writeFile(
      wrapper,
      `delete process.env.SEEKSTONE_READ_PATHS; await import(${JSON.stringify(
        `file://${SERVER_SRC}`,
      )});\n`,
      'utf8',
    );
    try {
      const report = await runReadScopeCheck([process.execPath, '--import', 'tsx', wrapper], vault);
      expect(report.pass).toBe(false);
      expect(report.leaks.some((l) => l.tool === 'search')).toBe(true);
      expect(report.leaks.some((l) => l.tool === 'read_note')).toBe(true);
      expect(report.hiddenIntact).toBe(false); // unscoped writes reach it
      expect(renderReadScopeMarkdown(report)).toContain('## Leaks');
    } finally {
      await rm(wrapper, { force: true });
    }
  }, 120_000);

  it('the sentinel is not something any probe argument contains verbatim in a path', () => {
    const probes = readScopeProbes('Notes/Alpha.md');
    for (const [tool, list] of Object.entries(probes)) {
      for (const a of list) {
        for (const key of ['path', 'from', 'to']) {
          expect(String(a[key] ?? '').includes(READ_SCOPE_SENTINEL), `${tool}.${key}`).toBe(false);
        }
      }
    }
  });
});
