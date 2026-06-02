#!/usr/bin/env node
// Release gate: pack seekstone + obsidian-mcp-seekstone, install both into
// a throwaway project with no repo, and confirm each bin boots — indexes a
// vault, prints readiness to stderr, keeps stdout clean. Exits non-zero on
// any failure so CI blocks the publish.

import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repoRoot = new URL('..', import.meta.url).pathname;
const cleanup = [];
const tmp = (p) => {
  const d = mkdtempSync(join(tmpdir(), p));
  cleanup.push(d);
  return d;
};

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

let ok = false;
try {
  // 1. Build, then pack seekstone. Build separately (tsup output would otherwise
  //    pollute `npm pack --json`'s stdout); pack with --ignore-scripts so the
  //    JSON is clean and the already-built dist/ is used.
  const packDir = tmp('seekstone-smoke-pack-');
  console.log('• building seekstone…');
  execFileSync('npm', ['run', 'build', '-w', 'seekstone'], { cwd: repoRoot, stdio: 'inherit' });
  console.log('• packing seekstone…');
  const packedSeekstone = JSON.parse(
    run(
      'npm',
      ['pack', '-w', 'seekstone', '--ignore-scripts', '--json', '--pack-destination', packDir],
      repoRoot,
    ),
  );
  const tgz = join(packDir, packedSeekstone[0].filename);

  // 1b. Pack the shim (no build step needed — it's plain JS).
  console.log('• packing obsidian-mcp-seekstone shim…');
  const packedShim = JSON.parse(
    run(
      'npm',
      [
        'pack',
        '-w',
        'obsidian-mcp-seekstone',
        '--ignore-scripts',
        '--json',
        '--pack-destination',
        packDir,
      ],
      repoRoot,
    ),
  );
  const shimTgz = join(packDir, packedShim[0].filename);

  // 2. Clean-install both tarballs into a fresh project (no repo, no tsx/typescript).
  //    Install seekstone first so the shim's dep is satisfied by the local tarball.
  const proj = tmp('seekstone-smoke-proj-');
  console.log('• installing seekstone + shim tarballs into a clean project…');
  run('npm', ['init', '-y'], proj);
  run('npm', ['install', tgz, shimTgz], proj);

  // 3. A throwaway vault.
  const vault = join(tmp('seekstone-smoke-vault-'), 'vault');
  mkdirSync(join(vault, '.obsidian'), { recursive: true });
  mkdirSync(join(vault, 'Notes'), { recursive: true });
  writeFileSync(join(vault, 'Notes', 'Hello.md'), '---\ntitle: Hi\n---\n# Hi\nbody\n');

  // 4. Boot each bin and verify: ready on stderr, clean stdout.
  async function bootAndVerify(binPath, label) {
    console.log(`• booting ${label}…`);
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [binPath], {
        env: { ...process.env, SEEKSTONE_VAULT: vault },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      let stdout = '';
      child.stdout.on('data', (d) => {
        stdout += d;
      });
      child.stderr.on('data', (d) => {
        stderr += d;
      });
      child.on('error', reject);
      const timer = setTimeout(() => {
        child.kill();
        if (!/ready/.test(stderr)) {
          reject(new Error(`${label}: server did not report ready.\nstderr:\n${stderr}`));
        } else if (stdout.length > 0) {
          reject(new Error(`${label}: stdout must stay clean (MCP transport); got:\n${stdout}`));
        } else {
          resolve();
        }
      }, 4000);
      timer.unref?.();
    });
  }

  const seekstoneEntry = join(proj, 'node_modules', 'seekstone', 'dist', 'index.js');
  await bootAndVerify(seekstoneEntry, 'seekstone');

  const shimEntry = join(proj, 'node_modules', 'obsidian-mcp-seekstone', 'bin', 'seekstone.js');
  await bootAndVerify(shimEntry, 'obsidian-mcp-seekstone (shim)');

  ok = true;
  console.log(
    '✓ smoke test passed — seekstone and obsidian-mcp-seekstone both install and boot cleanly.',
  );
} catch (err) {
  console.error(`✗ smoke test failed: ${err.message}`);
} finally {
  for (const d of cleanup) rmSync(d, { recursive: true, force: true });
}

process.exit(ok ? 0 : 1);
