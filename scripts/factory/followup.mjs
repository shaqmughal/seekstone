#!/usr/bin/env node
// Factory follow-up (SHA-536, SHA-570). Runs each time a CI workflow or a
// check app finishes on a `factory/` branch and decides what the factory PR
// needs next:
//
//   wait    a required check is still running, or CodeRabbit hasn't
//           reviewed the head commit yet
//   fix     a required check failed: start the factory again in fix mode
//   review  CI is green and CodeRabbit has open findings: start the one
//           review round (a fix run that gets review-findings.md)
//   ready   CI is green and CodeRabbit reviewed the head: mark the draft
//           ready, labelled `factory-review-open` if findings are still
//           open after the review round
//   block   out of fix attempts: comment, label `factory-blocked`, and move
//           the ticket to Blocked
//   none    nothing to do (not a draft, a run is already going, or blocked)
//
// CI failures come first: they show up minutes before CodeRabbit finishes,
// and the review round should start from a green branch. The review round
// runs at most once per PR, whatever the CI-fix attempts do around it.
//
//   node scripts/factory/followup.mjs <branch>
//
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_OUTPUT. The workflow carries
// out the action this script writes as outputs.

import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gh, ghAll, requiredChecks, requiredState } from './github.mjs';
import { fetchReview, reviewStatus } from './review.mjs';

export { requiredState };

/** Fix attempts after the first run; Sonnet tickets get one more, on Opus. */
export const MAX_FIXES = 2;
export const BLOCKED_LABEL = 'factory-blocked';
export const REVIEW_OPEN_LABEL = 'factory-review-open';
export const MARKER_RE = /<!-- factory-fix sha=([0-9a-f]{7,40}) attempt=(\d+) -->/;
/** Posted when the review round starts, and by deliver when it ends. */
export const REVIEW_START_RE = /<!-- factory-review sha=([0-9a-f]{7,40}) -->/;
export const REVIEW_DONE = '<!-- factory-review-done -->';

export const MODEL_SONNET = /<!-- factory-model sonnet -->/;

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

/**
 * Whether the review round started and ended, from the factory app's
 * markers, and the commit it started on.
 */
export function reviewRound(comments, bot) {
  const mine = comments.filter((c) => c.user?.login === bot);
  const sha = mine.map((c) => c.body?.match(REVIEW_START_RE)?.[1]).find(Boolean) ?? null;
  return { started: sha !== null, sha, done: mine.some((c) => c.body?.includes(REVIEW_DONE)) };
}

const sameCommit = (a, b) => a.startsWith(b) || b.startsWith(a);

export function markerFor(sha, attempt) {
  return `<!-- factory-fix sha=${sha} attempt=${attempt} -->`;
}

/** The ticket ID a factory branch carries, or null. */
export function ticketFromBranch(branch) {
  return branch.match(/^factory\/([A-Z][A-Z0-9]*-\d+)(?:-|$)/)?.[1] ?? null;
}

/** Once CI is green: wait for CodeRabbit, run the review round once, or mark ready. */
function afterCi(review, round) {
  if (!review.reviewed) {
    return { action: 'wait', reason: 'waiting on the CodeRabbit review of this commit' };
  }
  if (!review.changesRequested && review.open === 0) return { action: 'ready' };
  const findings = `${review.open} open finding(s)${review.changesRequested ? ', changes requested' : ''}`;
  if (!round.started) return { action: 'review', reason: `CodeRabbit: ${findings}` };
  return {
    action: 'ready',
    label: REVIEW_OPEN_LABEL,
    reason: `CodeRabbit still has ${findings} after the factory's review round.`,
  };
}

/**
 * What to do next. `sonnet` is whether the ticket's first runs used Sonnet,
 * which earns one final Opus attempt. `review` is reviewStatus() for the head.
 */
export function decide({ pr, required, checkRuns, comments, sonnet, bot, review }) {
  if (pr.labels.includes(BLOCKED_LABEL)) return { action: 'none', reason: 'blocked' };
  if (!pr.draft) return { action: 'none', reason: 'already ready for review' };
  // The review run pushes and then posts its done marker; until then its
  // branch is in motion, so nothing else starts. Only on the commit the
  // round started from: a round that died without its done marker (and got
  // factory-blocked) mustn't hold the PR once someone pushes a fix.
  const round = reviewRound(comments, bot);
  if (round.started && !round.done && sameCommit(pr.headSha, round.sha)) {
    return { action: 'none', reason: 'the review round is still running' };
  }
  const { pending, failed } = requiredState(required, checkRuns);
  if (failed.length === 0) {
    return pending.length === 0
      ? afterCi(review, round)
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
  const comments = await ghAll(`repos/${repo}/issues/${pr.number}/comments?per_page=100`);
  // deliver writes the model into the PR body when it opens the PR.
  const sonnet = MODEL_SONNET.test(p.body ?? '');
  const review = reviewStatus({
    ...(await fetchReview(repo, pr.number)),
    comments,
    checkRuns,
    headSha: pr.headSha,
  });

  const d = decide({ pr, required, checkRuns, comments, sonnet, bot, review });
  console.log(`PR #${pr.number} (${pr.headSha.slice(0, 7)}): ${d.action} ${d.reason ?? ''}`);
  out({
    action: d.action,
    pr: pr.number,
    ticket,
    sha: pr.headSha,
    attempt: d.attempt ?? '',
    model: d.model ?? '',
    label: d.label ?? '',
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
