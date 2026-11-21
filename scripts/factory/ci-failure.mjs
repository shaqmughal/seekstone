#!/usr/bin/env node
// Inputs for a factory CI-fix run (SHA-536).
//
//   node scripts/factory/ci-failure.mjs <pr-number> <out-dir>
//
// Writes <out-dir>/pr.md (the PR's current title and body, which the agent
// updates) and <out-dir>/ci-failure.md (each failing required check with the
// end of its log), and outputs the PR's branch and head commit.
//
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_OUTPUT.

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gh, requiredChecks, requiredState } from './github.mjs';

export const LOG_LINES = 150;
const MODEL_MARKER = /\n*<!-- factory-model \w+ -->\s*$/;

/** The last `n` lines of an Actions log, without the timestamp prefix. */
export function tailLog(text, n = LOG_LINES) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z /, ''))
    .slice(-n)
    .join('\n')
    .trim();
}

/** ci-failure.md from `{ name, url, log?, summary? }` items. */
export function formatFailures(items) {
  const parts = [
    '# Failing required checks',
    '',
    'These checks failed on the branch. Fix the cause on this branch; changing or skipping the check is not a fix.',
  ];
  for (const it of items) {
    parts.push('', `## ${it.name}`, '', `Details: ${it.url}`, '');
    if (it.log) parts.push('Last lines of the log:', '', '```', it.log, '```');
    else parts.push(it.summary?.trim() || '(no log or summary available)');
  }
  return `${parts.join('\n')}\n`;
}

/** pr.md as the agent writes it: title on the first line, then the body. */
export function prMarkdown(title, body) {
  return `${title}\n${(body ?? '').replace(MODEL_MARKER, '').trimEnd()}\n`;
}

async function main() {
  const [prNumber, outDir] = process.argv.slice(2);
  if (!/^\d+$/.test(prNumber ?? '') || !outDir) {
    console.error('usage: ci-failure.mjs <pr-number> <out-dir>');
    process.exit(2);
  }
  const repo = process.env.GITHUB_REPOSITORY;
  const pr = await gh(`repos/${repo}/pulls/${prNumber}`);
  const required = await requiredChecks(repo);
  const runs = (await gh(`repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=100`))
    .check_runs;
  const { failed } = requiredState(required, runs);

  const items = [];
  for (const name of failed) {
    const run = runs.filter((r) => r.name === name).sort((a, b) => b.id - a.id)[0];
    const item = { name, url: run.html_url, summary: run.output?.summary ?? run.output?.title };
    if (run.app?.slug === 'github-actions') {
      try {
        item.log = tailLog(await gh(`repos/${repo}/actions/jobs/${run.id}/logs`, { raw: true }));
      } catch (e) {
        item.summary = `${item.summary ?? ''}\n(log unavailable: ${e.message})`;
      }
    }
    items.push(item);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'pr.md'), prMarkdown(pr.title, pr.body));
  writeFileSync(join(outDir, 'ci-failure.md'), formatFailures(items));
  const lines = [`branch=${pr.head.ref}`, `base=${pr.head.sha}`];
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  console.log(`${failed.length} failing required check(s): ${failed.join(', ') || '(none)'}`);
  for (const l of lines) console.log(l);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`::error::${e.message}`);
    process.exit(1);
  });
}
