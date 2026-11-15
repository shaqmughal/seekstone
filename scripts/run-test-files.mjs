#!/usr/bin/env node
// Run specific test files with the right Vitest root (SHA-520).
//
//   node scripts/run-test-files.mjs --times 10 '<JSON array of repo paths>'
//       Flaky check: every run must pass. Exits 1 on the first failure.
//   node scripts/run-test-files.mjs --expect-fail '<JSON array>'
//       Failing-test-first: exits 0 only if the tests FAIL (run against the
//       base commit's source by the CI job).
//
// Paths under packages/<pkg>/ run with --root packages/<pkg>; anything else
// (e.g. scripts/) runs from the repo root.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { byRoot } from './quality-rules.mjs';

// Run Vitest's own entry with this Node, never through a shell: the file
// names come from the PR, and a shell would let a crafted name inject a
// command (on Windows, `npx` would need shell: true).
const VITEST = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));

const args = process.argv.slice(2);
const times = args.includes('--times') ? Number(args[args.indexOf('--times') + 1]) : 1;
const expectFail = args.includes('--expect-fail');
const files = JSON.parse(args.at(-1) ?? '[]');

function runOnce() {
  for (const [root, rels] of byRoot(files)) {
    const r = spawnSync(process.execPath, [VITEST, 'run', '--root', root, ...rels], {
      stdio: 'inherit',
    });
    if (r.status !== 0) return false;
  }
  return true;
}

if (files.length === 0) {
  console.log('no test files to run');
  process.exit(0);
}

if (expectFail) {
  const passed = runOnce();
  if (passed) {
    console.log(
      '::error::The new or changed tests pass without the fix. A bug fix needs a test that fails first.',
    );
    process.exit(1);
  }
  console.log('failing-test-first: OK (the tests fail on the base commit)');
  process.exit(0);
}

for (let i = 1; i <= times; i++) {
  console.log(`::group::run ${i}/${times}`);
  const ok = runOnce();
  console.log('::endgroup::');
  if (!ok) {
    console.log(`::error::run ${i}/${times} failed; the test is flaky or broken`);
    process.exit(1);
  }
}
console.log(`flaky check: ${files.length} file(s) passed ${times}/${times} runs`);
