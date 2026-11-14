#!/usr/bin/env node
// Weekly wall-clock benchmark on a real machine (SHA-519). It's the backstop
// for what CodSpeed's CPU simulation leaves out: disk I/O and system calls.
//
// Each run:
//   1. Keeps a dedicated clone in the state dir (never your working copy),
//      fetches, and checks out origin/main.
//   2. Benchmarks the committed 10k-note fixture vault through the shipped
//      server code (harness `bench --backend seekstone`).
//   3. Compares with the previous run. If anything regressed, re-runs once
//      and keeps only regressions the re-run reproduces, so a busy laptop
//      doesn't raise a false alarm.
//   4. Files a Linear issue in Triage for confirmed regressions.
//
// Usage: node scripts/weekly-bench.mjs [--state-dir DIR] [--dry-run]
// Env:
//   SEEKSTONE_BENCH_LINEAR_TEAM   Linear team key to file issues in (required to file)
//   SEEKSTONE_BENCH_KEYCHAIN      macOS Keychain service holding a Linear API key
//                                 (default "seekstone-weekly-bench")
//   SEEKSTONE_BENCH_PCT / _MIN_MS regression thresholds (default 0.10 / 0.2)
//
// Never touches a personal vault: the vault is the committed fixture inside
// the dedicated clone.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { compareBench, confirmed, renderRegressions } from './bench-compare.mjs';

const REPO_URL = 'https://github.com/shaqmughal/seekstone.git';
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};

const stateDir = opt('--state-dir', join(homedir(), '.local/share/seekstone-weekly-bench'));
const dryRun = flag('--dry-run');
const pct = Number(process.env.SEEKSTONE_BENCH_PCT ?? 0.1);
const minMs = Number(process.env.SEEKSTONE_BENCH_MIN_MS ?? 0.2);
const repo = join(stateDir, 'repo');
const runsDir = join(stateDir, 'runs');

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);
const sh = (cmd, cmdArgs, cwd = repo) =>
  execFileSync(cmd, cmdArgs, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

function checkoutMain() {
  mkdirSync(stateDir, { recursive: true });
  if (!existsSync(join(repo, '.git'))) {
    log(`cloning ${REPO_URL}`);
    sh('git', ['clone', '--quiet', REPO_URL, repo], stateDir);
  }
  sh('git', ['fetch', '--quiet', 'origin', 'main']);
  sh('git', ['checkout', '--quiet', '--detach', 'origin/main']);
  sh('npm', ['ci', '--silent', '--no-audit', '--no-fund']);
  return sh('git', ['rev-parse', '--short', 'HEAD']).trim();
}

function bench(outDir) {
  sh('npm', [
    'run',
    '--silent',
    'harness',
    '--',
    'bench',
    '--backend',
    'seekstone',
    '--vault',
    join(repo, 'packages/harness/fixtures/vault'),
    '--out',
    outDir,
  ]);
  return JSON.parse(readFileSync(join(outDir, 'benchmark-seekstone.json'), 'utf8'));
}

function previousRun(exclude) {
  if (!existsSync(runsDir)) return undefined;
  const dirs = readdirSync(runsDir)
    .filter(
      (d) =>
        d !== exclude &&
        !d.endsWith('-confirm') &&
        existsSync(join(runsDir, d, 'benchmark-seekstone.json')),
    )
    .sort();
  const last = dirs.at(-1);
  if (!last) return undefined;
  return {
    name: last,
    report: JSON.parse(readFileSync(join(runsDir, last, 'benchmark-seekstone.json'), 'utf8')),
  };
}

async function linear(query, variables, apiKey) {
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (!res.ok || body.errors) throw new Error(`Linear API: ${JSON.stringify(body.errors ?? body)}`);
  return body.data;
}

async function fileIssue(title, description) {
  const teamKey = process.env.SEEKSTONE_BENCH_LINEAR_TEAM;
  if (!teamKey) throw new Error('SEEKSTONE_BENCH_LINEAR_TEAM is not set; cannot file the issue.');
  const service = process.env.SEEKSTONE_BENCH_KEYCHAIN ?? 'seekstone-weekly-bench';
  const apiKey = sh('security', ['find-generic-password', '-s', service, '-w'], stateDir).trim();
  const { teams } = await linear(
    'query($key: String!) { teams(filter: { key: { eq: $key } }) { nodes { id states { nodes { id type } } } } }',
    { key: teamKey },
    apiKey,
  );
  const team = teams.nodes[0];
  if (!team) throw new Error(`No Linear team with key ${teamKey}.`);
  const triage = team.states.nodes.find((s) => s.type === 'triage');
  const { issueCreate } = await linear(
    'mutation($input: IssueCreateInput!) { issueCreate(input: $input) { issue { identifier url } } }',
    { input: { teamId: team.id, stateId: triage?.id, title, description } },
    apiKey,
  );
  return issueCreate.issue;
}

const sha = checkoutMain();
const stamp = new Date().toISOString().slice(0, 10);
const name = `${stamp}-${sha}`;
log(`benchmarking main @ ${sha}`);
const current = bench(join(runsDir, name));
const prev = previousRun(name);

if (!prev) {
  log(`first run stored as ${name}; nothing to compare yet.`);
  process.exit(0);
}

const first = compareBench(prev.report, current, { pct, minMs });
if (first.length === 0) {
  log(`no regressions vs ${prev.name}.`);
  process.exit(0);
}

log(`${first.length} possible regression(s) vs ${prev.name}; re-running to confirm`);
const rerun = bench(join(runsDir, `${name}-confirm`));
const real = confirmed(first, compareBench(prev.report, rerun, { pct, minMs }));
if (real.length === 0) {
  log('re-run did not reproduce them; treating as noise.');
  process.exit(0);
}

const table = renderRegressions(real);
log(`confirmed regression(s):\n${table}`);
const title = `Weekly wall-clock bench: ${real.length} regression(s) on main @ ${sha}`;
const description = [
  `The weekly wall-clock benchmark (SHA-519) found regressions on the committed 10k-note fixture vault, confirmed by a re-run.`,
  '',
  `- This run: \`${name}\` (main @ ${sha})`,
  `- Compared with: \`${prev.name}\``,
  `- Thresholds: +${(pct * 100).toFixed(0)}% and +${minMs} ms on warm median or p95`,
  `- Commits in range: \`git log ${prev.name.split('-').at(-1)}..${sha}\``,
  '',
  table,
  '',
  `Raw reports: \`${runsDir}\` on the machine that ran it.`,
].join('\n');

if (dryRun) {
  log(`--dry-run: would file "${title}"`);
} else {
  const issue = await fileIssue(title, description);
  log(`filed ${issue.identifier}: ${issue.url}`);
}
