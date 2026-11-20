#!/usr/bin/env node
// Factory follow-up (SHA-536). Runs each time a CI workflow finishes on a
// `factory/` branch and decides what the factory PR needs next:
//
//   wait   a required check is still running or hasn't reported
//   ready  every required check passed: mark the draft PR ready for review
//   fix    a required check failed: start the factory again in fix mode
//   block  out of fix attempts: comment, label `factory-blocked`, and move
//          the ticket to Blocked
//   none   nothing to do (not a draft, already handled, or blocked)
//
//   node scripts/factory/followup.mjs <branch>
//
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_OUTPUT. The workflow carries
// out the action this script writes as outputs.

import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gh, requiredChecks } from './github.mjs';

/** Fix attempts after the first run; Sonnet tickets get one more, on Opus. */
export const MAX_FIXES = 2;
export const BLOCKED_LABEL = 'factory-blocked';
export const MARKER_RE = /<!-- factory-fix sha=([0-9a-f]{7,40}) attempt=(\d+) -->/;

export const MODEL_SONNET = /<!-- factory-model sonnet -->/;
const PASS = new Set(['success', 'skipped', 'neutral']);

/**
 * State of each required check on the head commit, using the newest check
 * run per name. A missing check counts as pending.
 * @returns {{ pending: string[], failed: string[] }}
 */
export function requiredState(required, checkRuns) {
  const latest = new Map();
  for (const r of checkRuns) {
    const prev = latest.get(r.name);
    if (!prev || r.id > prev.id) latest.set(r.name, r);
  }
  const pending = [];
  const failed = [];
  for (const name of required) {
    const r = latest.get(name);
    if (r?.status !== 'completed') pending.push(name);
    else if (!PASS.has(r.conclusion)) failed.push(name);
  }
  return { pending, failed };
}

/**
 * Fix attempts already started, from the marker comments, and whether one
 * targets `sha`. Only comments by `bot` (the factory app) count; anyone who
 * can comment on the PR could otherwise post a marker.
 */
export function fixHistory(comments, sha, bot) {
  let attempts = 0;
  let forSha = false;
  for (const c of comments) {
    if (c.user?.login !== bot) continue;
    const m = c.body?.match(MARKER_RE);
    if (!m) continue;
    attempts = Math.max(attempts, Number(m[2]));
    if (sha.startsWith(m[1]) || m[1].startsWith(sha)) forSha = true;
  }
  return { attempts, forSha };
}

export function markerFor(sha, attempt) {
  return `<!-- factory-fix sha=${sha} attempt=${attempt} -->`;
}

/** The ticket ID a factory branch carries, or null. */
export function ticketFromBranch(branch) {
  return branch.match(/^factory\/([A-Z][A-Z0-9]*-\d+)(?:-|$)/)?.[1] ?? null;
}

/**
 * What to do next. `sonnet` is whether the ticket's first runs used Sonnet,
 * which earns one final Opus attempt.
 */
export function decide({ pr, required, checkRuns, comments, sonnet, bot }) {
  if (pr.labels.includes(BLOCKED_LABEL)) return { action: 'none', reason: 'blocked' };
  if (!pr.draft) return { action: 'none', reason: 'already ready for review' };
  const { pending, failed } = requiredState(required, checkRuns);
  if (failed.length === 0) {
    return pending.length === 0
      ? { action: 'ready' }
      : { action: 'wait', reason: `waiting on ${pending.join(', ')}` };
  }
  const { attempts, forSha } = fixHistory(comments, pr.headSha, bot);
  if (forSha) return { action: 'none', reason: 'a fix for this commit is already running' };
  const max = MAX_FIXES + (sonnet ? 1 : 0);
  if (attempts >= max) {
    return {
      action: 'block',
      failed,
      reason: `Required checks still fail after ${attempts} fix attempt(s): ${failed.join(', ')}.`,
    };
  }
  const attempt = attempts + 1;
  return {
    action: 'fix',
    failed,
    attempt,
    model: sonnet && attempt === max ? 'opus' : undefined,
  };
}

async function main() {
  const branch = process.argv[2] ?? '';
  const repo = process.env.GITHUB_REPOSITORY;
  const ticket = ticketFromBranch(branch);
  const out = (pairs) => {
    const lines = Object.entries(pairs).map(([k, v]) => `${k}=${v}`);
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
    }
    for (const l of lines) console.log(l);
  };
  if (!ticket) return out({ action: 'none' });

  const owner = repo.split('/')[0];
  const prs = await gh(
    `repos/${repo}/pulls?state=open&head=${owner}:${encodeURIComponent(branch)}`,
  );
  if (prs.length === 0) return out({ action: 'none' });
  const p = prs[0];
  const pr = {
    number: p.number,
    draft: p.draft,
    headSha: p.head.sha,
    labels: p.labels.map((l) => l.name),
  };
  const required = await requiredChecks(repo);
  const checkRuns = (await gh(`repos/${repo}/commits/${pr.headSha}/check-runs?per_page=100`))
    .check_runs;
  const bot = process.env.FACTORY_BOT_LOGIN;
  if (!bot) throw new Error('FACTORY_BOT_LOGIN is not set');
  const comments = await gh(`repos/${repo}/issues/${pr.number}/comments?per_page=100`);
  // deliver writes the model into the PR body when it opens the PR.
  const sonnet = MODEL_SONNET.test(p.body ?? '');

  const d = decide({ pr, required, checkRuns, comments, sonnet, bot });
  console.log(`PR #${pr.number} (${pr.headSha.slice(0, 7)}): ${d.action} ${d.reason ?? ''}`);
  out({
    action: d.action,
    pr: pr.number,
    ticket,
    sha: pr.headSha,
    attempt: d.attempt ?? '',
    model: d.model ?? '',
    failed: JSON.stringify(d.failed ?? []),
    reason: JSON.stringify(d.reason ?? ''),
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`::error::${e.message}`);
    process.exit(1);
  });
}
