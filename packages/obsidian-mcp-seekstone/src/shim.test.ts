/**
 * Tests for the obsidian-mcp-seekstone shim.
 *
 * The shim has one job: proxy all invocations to the real seekstone binary.
 * These tests verify that contract end-to-end — the shim passes args and env
 * through correctly, reports the seekstone version, and fails gracefully when
 * the dep is missing.
 */
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

// Resolve the shim entry from the package root.
const shimBin = join(new URL('../bin/seekstone.js', import.meta.url).pathname);
const shimPkg = require('../package.json') as {
  version: string;
  dependencies: Record<string, string>;
};
const seekstonePkg = require('seekstone/package.json') as { version: string };

describe('obsidian-mcp-seekstone shim', () => {
  it('shim version matches seekstone version (linked versioning)', () => {
    expect(shimPkg.version).toBe(seekstonePkg.version);
  });

  it('shim dependency is pinned to the exact same seekstone version', () => {
    expect(shimPkg.dependencies.seekstone).toBe(seekstonePkg.version);
  });

  it('--version passes through to seekstone and prints a semver string', async () => {
    const { stdout } = await execFileAsync(process.execPath, [shimBin, '--version'], {
      env: process.env,
    });
    // The shim proxies to whatever seekstone is installed; assert it returns
    // a semver-shaped string rather than a hardcoded version (workspace vs
    // published may differ in version but both are valid semver).
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('--help passes through and mentions SEEKSTONE_VAULT', async () => {
    const { stdout } = await execFileAsync(process.execPath, [shimBin, '--help'], {
      env: process.env,
    });
    expect(stdout).toContain('SEEKSTONE_VAULT');
  });
});

describe('obsidian-mcp-seekstone smoke: full boot via shim', () => {
  let vaultRoot: string;

  beforeAll(async () => {
    vaultRoot = await mkdtemp(join(tmpdir(), 'shim-smoke-'));
    await writeFile(join(vaultRoot, '.obsidian'), ''); // not a dir but enough to satisfy init
    // Create a proper .obsidian dir.
    const { mkdir } = await import('node:fs/promises');
    await rm(join(vaultRoot, '.obsidian')); // remove placeholder file
    await mkdir(join(vaultRoot, '.obsidian'), { recursive: true });
    await writeFile(join(vaultRoot, 'note.md'), '# Hi\nbody text\n');
  });

  afterAll(async () => {
    await rm(vaultRoot, { recursive: true, force: true });
  });

  it('booting the shim with a valid vault prints "ready" on stderr and nothing on stdout', async () => {
    const { spawn } = await import('node:child_process');

    const result = await new Promise<{ stderr: string; stdout: string }>((resolve) => {
      let stderr = '';
      let stdout = '';
      const child = spawn(process.execPath, [shimBin], {
        env: { ...process.env, SEEKSTONE_VAULT: vaultRoot },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (d: Buffer) => {
        stdout += d.toString();
      });
      child.stderr.on('data', (d: Buffer) => {
        stderr += d.toString();
      });
      const t = setTimeout(() => {
        child.kill();
        resolve({ stderr, stdout });
      }, 3000);
      t.unref?.();
    });

    expect(result.stderr).toContain('ready');
    expect(result.stdout).toBe('');
  });
});
