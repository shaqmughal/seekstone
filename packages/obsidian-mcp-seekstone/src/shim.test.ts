/**
 * Tests for the obsidian-mcp-seekstone shim.
 *
 * The shim's job: proxy all invocations to the real seekstone binary.
 * NODE_PATH is set to the monorepo root node_modules in every spawned
 * process so seekstone resolves correctly in both local dev and CI.
 */
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const shimBin = new URL('../bin/seekstone.js', import.meta.url).pathname;
// Resolve monorepo root via dirname chain — more reliable than URL math.
// this file: packages/obsidian-mcp-seekstone/src/shim.test.ts
// root: 3 dirnames up from this file's dir
import { dirname } from 'node:path';
const thisDir = dirname(new URL(import.meta.url).pathname); // .../src
const shimPkgDir = dirname(thisDir); // .../obsidian-mcp-seekstone
const packagesDir = dirname(shimPkgDir); // .../packages
const monorepoRoot = dirname(packagesDir); // .../seekstone

// Read versions directly from package.json files — no require.resolve needed.
const shimVersion: string = JSON.parse(
  readFileSync(join(monorepoRoot, 'packages/obsidian-mcp-seekstone/package.json'), 'utf8'),
).version;
const shimDeps: Record<string, string> = JSON.parse(
  readFileSync(join(monorepoRoot, 'packages/obsidian-mcp-seekstone/package.json'), 'utf8'),
).dependencies;
const seekstoneVersion: string = JSON.parse(
  readFileSync(join(monorepoRoot, 'packages/server/package.json'), 'utf8'),
).version;

// Provide NODE_PATH so the shim bin can resolve 'seekstone' at the monorepo
// root node_modules in both local dev (workspace link) and CI.
const testEnv = {
  ...process.env,
  NODE_PATH: join(monorepoRoot, 'node_modules'),
};

describe('obsidian-mcp-seekstone shim', () => {
  it('shim version matches seekstone version (linked versioning)', () => {
    expect(shimVersion).toBe(seekstoneVersion);
  });

  it('shim dependency is pinned to the exact same seekstone version', () => {
    expect(shimDeps.seekstone).toBe(seekstoneVersion);
  });

  it('--version passes through to seekstone and prints a semver string', async () => {
    const { stdout } = await execFileAsync(process.execPath, [shimBin, '--version'], {
      env: testEnv,
    });
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('--help passes through and mentions SEEKSTONE_VAULT', async () => {
    const { stdout } = await execFileAsync(process.execPath, [shimBin, '--help'], {
      env: testEnv,
    });
    expect(stdout).toContain('SEEKSTONE_VAULT');
  });
});

describe('obsidian-mcp-seekstone smoke: full boot via shim', () => {
  let vaultRoot: string;

  beforeAll(async () => {
    vaultRoot = await mkdtemp(join(tmpdir(), 'shim-smoke-'));
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
        env: { ...testEnv, SEEKSTONE_VAULT: vaultRoot },
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
