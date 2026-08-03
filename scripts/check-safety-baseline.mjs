#!/usr/bin/env node
/**
 * CI gate for the write-safety contract (docs/WRITE-SAFETY.md): runs the
 * harness safety suite with the fs backend against the committed fixture
 * vault and diffs the result against the committed baseline
 * (fixtures/baseline-reports/safety-fs.json), ignoring volatile fields
 * (snapshotDate, machine-local copy path — already scrubbed by the CLI).
 *
 * Any semantic drift — an op regressing, a note failing, a count changing —
 * fails CI. Run via `node scripts/check-safety-baseline.mjs` (see ci.yml).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const vault = join(repoRoot, 'packages/harness/fixtures/vault');
const baselinePath = join(repoRoot, 'packages/harness/fixtures/baseline-reports/safety-fs.json');
const outDir = mkdtempSync(join(tmpdir(), 'seekstone-safety-ci-'));

try {
  execFileSync(
    'npm',
    [
      'run',
      'harness',
      '--',
      'safety',
      '--backend',
      'fs',
      '--vault',
      vault,
      '--sample',
      '25',
      '--out',
      outDir,
    ],
    { cwd: repoRoot, stdio: 'inherit' },
  );

  const normalize = (raw) => {
    const s = JSON.parse(raw);
    delete s.snapshotDate;
    delete s.vaultCopyRoot; // scrubbed already, but the tmp hash may differ
    return JSON.stringify(s, null, 2);
  };

  const fresh = normalize(readFileSync(join(outDir, 'safety-fs.json'), 'utf8'));
  const golden = normalize(readFileSync(baselinePath, 'utf8'));

  if (fresh !== golden) {
    console.error('✗ write-safety baseline drift: safety-fs output differs from the committed');
    console.error(`  golden at ${baselinePath}.`);
    console.error('  If the change is intentional, regenerate the baseline:');
    console.error(
      '  npm run harness -- safety --backend fs --vault packages/harness/fixtures/vault --sample 25 --out packages/harness/fixtures/baseline-reports',
    );
    process.exit(1);
  }
  console.log('✓ write-safety baseline matches (safety-fs vs committed golden).');
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
