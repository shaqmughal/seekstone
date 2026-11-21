#!/usr/bin/env node
// Review gate (SHA-569). Passes a PR only when CodeRabbit has approved the
// code that would merge. CodeRabbit's own check run reports success whenever
// a review finishes, findings or not, so on its own it guards nothing.
//
//   pass  CodeRabbit's latest review is APPROVED and covers the head commit
//   pass  the approval is on an older commit, and every commit since is a
//         clean merge of the base branch (what pr-autoupdate.yml does to an
//         approved PR), checked with git: same tree as `git merge-tree`
//         gives, so nothing was edited during the merge
//   pass  a maintainer added the `review:override` label
//   pass  the changesets release PR, which has no code to review
//   pass  a draft; the gate runs again when the PR is marked ready
//   fail  anything else
//
//   node scripts/review-gate.mjs
//
// Env: GITHUB_TOKEN (read-only is enough, so fork PRs work), GITHUB_REPOSITORY,
// PR_NUMBER, HEAD_SHA (the commit the check is attached to), BASE_REF (a
// local ref for the base branch tip, default origin/main), GITHUB_STEP_SUMMARY
// (optional). Runs in a clone that has the PR head and the base branch with
// full history; the workflow fetches both.

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gh, ghAll } from './factory/github.mjs';

export const REVIEWER = 'coderabbitai[bot]';
export const OVERRIDE_LABEL = 'review:override';
export const RELEASE_BRANCH = 'changeset-release/main';
export const RELEASE_AUTHOR = 'seekstone-release-bot[bot]';

// COMMENTED reviews don't change a reviewer's approval state on GitHub, so
// they don't change it here either.
const DECISIVE = new Set(['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED']);

const short = (sha) => (sha ?? '').slice(0, 7);

/** The changesets "Version Packages" PR: the release app's branch in this repo. */
export function isReleasePr(pr) {
  return (
    pr.head?.ref === RELEASE_BRANCH &&
    pr.head?.repo?.full_name != null &&
    pr.head.repo.full_name === pr.base?.repo?.full_name &&
    pr.user?.login === RELEASE_AUTHOR
  );
}

/** CodeRabbit's newest approve, request-changes or dismissed review, or null. */
export function latestReview(reviews) {
  const mine = reviews.filter((r) => r.user?.login === REVIEWER && DECISIVE.has(r.state));
  mine.sort((a, b) => Date.parse(a.submitted_at) - Date.parse(b.submitted_at));
  return mine.at(-1) ?? null;
}

/** Runs git in the current directory and returns its trimmed stdout. Throws on a non-zero exit. */
export function runGit(args, cwd = process.cwd()) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function isAncestor(git, a, b) {
  try {
    git(['merge-base', '--is-ancestor', a, b]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether every commit from `approved` to `head` is a clean merge of the base
 * branch. Walks the first-parent chain from `head` back to `approved`; each
 * commit on it must have two parents, the second already on the base branch,
 * and a tree equal to what `git merge-tree` produces for those parents. A
 * merge that resolved a conflict or slipped in an edit has a different tree.
 * Any git error (a missing commit, a conflict) counts as "no".
 * @returns {{ ok: boolean, why: string }}
 */
export function onlyBaseMerges({ approved, head, baseRef, git = runGit }) {
  try {
    const lines = git(['rev-list', '--first-parent', '--parents', `${approved}..${head}`])
      .split('\n')
      .filter(Boolean)
      .map((l) => l.split(' '));
    if (lines.length === 0) return { ok: false, why: 'the approved commit is not behind the head' };
    for (const [i, [commit, first, second, ...more]] of lines.entries()) {
      const expectedFirst = i + 1 < lines.length ? lines[i + 1][0] : approved;
      if (!second || more.length > 0) return { ok: false, why: `${short(commit)} is not a merge` };
      if (first !== expectedFirst) {
        return { ok: false, why: `the approved commit is not on the head's first-parent line` };
      }
      if (!isAncestor(git, second, baseRef)) {
        return { ok: false, why: `${short(commit)} merges a commit that is not on ${baseRef}` };
      }
      const clean = git(['merge-tree', '--write-tree', first, second]).split('\n')[0];
      if (clean !== git(['rev-parse', `${commit}^{tree}`])) {
        return { ok: false, why: `${short(commit)} differs from a clean merge` };
      }
    }
    return { ok: true, why: `${lines.length} clean merge(s) of ${baseRef}` };
  } catch (e) {
    return { ok: false, why: `git could not check it (${e.message.split('\n')[0]})` };
  }
}

/**
 * The verdict for one PR.
 * @param {object} input
 * @param {object} input.pr        the pull request (live: labels, draft, author)
 * @param {string} input.headSha   the commit this check is attached to
 * @param {object | null} input.review  latestReview() of the PR
 * @param {boolean} [input.unchanged]   onlyBaseMerges() from the approved commit to the head
 * @param {string} [input.overrideBy]   who added the override label, when known
 * @returns {{ pass: boolean, reason: string, override?: boolean }}
 */
export function verdict({ pr, headSha, review, unchanged = false, overrideBy }) {
  if (pr.labels?.some((l) => l.name === OVERRIDE_LABEL)) {
    const by = overrideBy ? ` by @${overrideBy}` : '';
    return {
      pass: true,
      override: true,
      reason: `Overridden: the \`${OVERRIDE_LABEL}\` label was added${by}. CodeRabbit's approval was not checked.`,
    };
  }
  if (isReleasePr(pr)) {
    return {
      pass: true,
      reason: 'The changesets release PR only bumps versions; no review needed.',
    };
  }
  if (pr.draft) {
    return {
      pass: true,
      reason: 'Draft PR: the gate runs again when it is marked ready for review.',
    };
  }
  if (!review) {
    return {
      pass: false,
      reason: `CodeRabbit has not approved this PR yet. Wait for its review, or comment \`@coderabbitai review\` to start one.`,
    };
  }
  if (review.state !== 'APPROVED') {
    const what = review.state === 'DISMISSED' ? 'was dismissed' : 'requests changes';
    return {
      pass: false,
      reason: `CodeRabbit's latest review (on ${short(review.commit_id)}) ${what}. Fix or answer its findings and resolve the threads; it approves once nothing blocking is left.`,
    };
  }
  if (review.commit_id === headSha) {
    return { pass: true, reason: `CodeRabbit approved the head commit ${short(headSha)}.` };
  }
  if (unchanged) {
    return {
      pass: true,
      reason: `CodeRabbit approved ${short(review.commit_id)}. Every commit since, up to ${short(headSha)}, is a clean merge of the base branch.`,
    };
  }
  return {
    pass: false,
    reason: `CodeRabbit approved ${short(review.commit_id)}, but the commits since, up to ${short(headSha)}, are not only clean merges of the base branch. Wait for it to review the new commits, or comment \`@coderabbitai review\`.`,
  };
}

/**
 * Reads the PR from the API and returns the verdict. Everything it calls is a
 * read, so a fork PR's read-only token is enough.
 */
export async function run({
  repo,
  number,
  headSha,
  baseRef = 'origin/main',
  git = runGit,
  log = console.log,
}) {
  if (!repo || !Number.isInteger(number) || number <= 0 || !/^[0-9a-f]{40}$/.test(headSha ?? '')) {
    throw new Error('GITHUB_REPOSITORY, PR_NUMBER and HEAD_SHA are required');
  }
  if (!/^[\w][\w./-]*$/.test(baseRef)) throw new Error(`bad BASE_REF: ${baseRef}`);
  const pr = await gh(`repos/${repo}/pulls/${number}`);
  const review = latestReview(await ghAll(`repos/${repo}/pulls/${number}/reviews?per_page=100`));

  let overrideBy;
  if (pr.labels?.some((l) => l.name === OVERRIDE_LABEL)) {
    const events = await ghAll(`repos/${repo}/issues/${number}/events?per_page=100`).catch(
      () => [],
    );
    overrideBy = events
      .filter((e) => e.event === 'labeled' && e.label?.name === OVERRIDE_LABEL)
      .at(-1)?.actor?.login;
  }

  let unchanged = false;
  if (review?.state === 'APPROVED' && review.commit_id !== headSha && !pr.draft) {
    const m = onlyBaseMerges({ approved: review.commit_id, head: headSha, baseRef, git });
    log(`Commits after the approval: ${m.why}.`);
    unchanged = m.ok;
  }
  return verdict({ pr, headSha, review, unchanged, overrideBy });
}

async function main() {
  const v = await run({
    repo: process.env.GITHUB_REPOSITORY,
    number: Number(process.env.PR_NUMBER),
    headSha: process.env.HEAD_SHA,
    baseRef: process.env.BASE_REF || 'origin/main',
  });
  console.log(v.reason);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Review gate: ${v.pass ? 'pass' : 'fail'}\n\n${v.reason}\n`,
    );
  }
  if (!v.pass) {
    console.log(`::error::${v.reason}`);
    process.exit(1);
  }
  if (v.override) console.log(`::warning::${v.reason}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`::error::${e.message}`);
    process.exit(1);
  });
}
