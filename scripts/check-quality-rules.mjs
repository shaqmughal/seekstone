#!/usr/bin/env node
// CI wrapper for the quality rules (SHA-520). Fetches the PR's changed files,
// applies scripts/quality-rules.mjs, labels weakened tests, and writes job
// outputs for the flaky and failing-test-first jobs.
//
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, PR_LABELS (JSON array of
// names), GITHUB_OUTPUT (set by Actions).

import { appendFileSync } from 'node:fs';
import { evaluate, sourceToRevert } from './quality-rules.mjs';

const { GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, GITHUB_OUTPUT } = process.env;
const labels = JSON.parse(process.env.PR_LABELS || '[]');
const api = `https://api.github.com/repos/${GITHUB_REPOSITORY}`;
const headers = {
  accept: 'application/vnd.github+json',
  authorization: `Bearer ${GITHUB_TOKEN}`,
  'x-github-api-version': '2022-11-28',
};

async function prFiles() {
  const files = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`${api}/pulls/${PR_NUMBER}/files?per_page=100&page=${page}`, {
      headers,
    });
    if (!res.ok) throw new Error(`list PR files: HTTP ${res.status} ${await res.text()}`);
    const batch = await res.json();
    files.push(...batch);
    if (batch.length < 100) return files;
  }
}

const files = await prFiles();
const result = evaluate(files, labels);

if (result.weakened.length > 0 && !labels.includes('tests-weakened')) {
  // Read-only tokens (forks, Dependabot) can't label; the failing check still says why.
  const res = await fetch(`${api}/issues/${PR_NUMBER}/labels`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ labels: ['tests-weakened'] }),
  });
  if (!res.ok) console.log(`::notice::could not add the tests-weakened label (HTTP ${res.status})`);
}

const { changed: sourceFiles, added: addedSource, renamed } = sourceToRevert(files);

if (GITHUB_OUTPUT) {
  appendFileSync(
    GITHUB_OUTPUT,
    [
      `test-files=${JSON.stringify(result.testFiles)}`,
      `has-tests=${result.testFiles.length > 0}`,
      `source-files=${JSON.stringify(sourceFiles)}`,
      `added-source-files=${JSON.stringify(addedSource)}`,
      `renamed-source-files=${JSON.stringify(renamed)}`,
      '',
    ].join('\n'),
  );
}

console.log(
  `${files.length} changed file(s); ${result.testFiles.length} test file(s); labels: ${labels.join(', ') || '(none)'}`,
);
if (result.approved && result.weakened.length > 0) {
  console.log('Weakened tests accepted by the tests-weakened:approved label:');
  for (const r of result.weakened) console.log(`  - ${r}`);
}
if (!result.ok) {
  for (const line of result.failures) console.log(line);
  console.log('::error::quality rules failed (see above)');
  process.exit(1);
}
console.log('quality rules: OK');
