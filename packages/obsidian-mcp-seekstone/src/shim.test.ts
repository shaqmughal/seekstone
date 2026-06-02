import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const shimPkgDir = join(import.meta.dirname, '..');
const shimBin = join(shimPkgDir, 'bin', 'seekstone.js');

describe('obsidian-mcp-seekstone shim', () => {
  it('--version passes through and returns a semver string', async () => {
    const { stdout } = await execFileAsync(process.execPath, [shimBin, '--version'], {
      env: process.env,
    });
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
    await mkdir(join(vaultRoot, '.obsidian'), { recursive: true });
    await writeFile(join(vaultRoot, 'note.md'), '# Hi\nbody text\n');
  });

  afterAll(async () => {
    await rm(vaultRoot, { recursive: true, force: true });
  });

  it('boots the server via the shim: ready on stderr, clean stdout', async () => {
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
