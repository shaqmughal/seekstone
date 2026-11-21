#!/usr/bin/env node
// Review gate (SHA-569). Passes a PR only when CodeRabbit has approved the
// code that would merge. CodeRabbit's own check run reports success whenever
// a review finishes, findings or not, so on its own it guards nothing.
//
//   pass  CodeRabbit's latest review is APPROVED and covers the head commit
//   pass  the approval is on an older commit, and the PR's changes are the
//         same now as then (the commits since only brought in main, which
//         is what pr-autoupdate.yml does to an approved PR)
//   pass  a maintainer added the `review:override` label
//   pass  the changesets release PR, which has no code to review
//   pass  a draft; the gate runs again when the PR is marked ready
//   fail  anything else
//
//   node scripts/review-gate.mjs
//
// Env: GITHUB_TOKEN (read-only is enough, so fork PRs work), GITHUB_REPOSITORY,
// PR_NUMBER, HEAD_SHA (the commit the check is attached to),
// GITHUB_STEP_SUMMARY (optional).

import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gh, ghAll } from './factory/github.mjs';

export const REVIEWER = 'coderabbitai[bot]';
export const OVERRIDE_LABEL = 'review:override';
export const RELEASE_BRANCH = 'changeset-release/main';
export const RELEASE_AUTHOR = 'seekstone-release-bot[bot]';
/** The compare API lists at most 300 files; past that, sameChanges can't tell. */
export const MAX_FILES = 300;

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

// Hunk headers carry line numbers, which shift when main changes lines above
// the PR's hunks. The lines themselves still have to match.
const hunkBody = (patch) => patch.replace(/^@@ [^\n]*@@.*$/gm, '@@');

/**
 * Whether two compare-API file lists describe the same change: same files,
 * same status, and per file either the same resulting blob or the same
 * patch apart from hunk line numbers. Fails closed on a truncated list or a
 * file whose patch GitHub left out.
 */
export function sameChanges(before, after) {
  if (before.length >= MAX_FILES || after.length >= MAX_FILES) return false;
  if (before.length !== after.length) return false;
  const byName = new Map(before.map((f) => [f.filename, f]));
  return after.every((f) => {
    const b = byName.get(f.filename);
    if (!b || b.status !== f.status || b.previous_filename !== f.previous_filename) return false;
    if (b.sha === f.sha) return true;
    return b.patch != null && f.patch != null && hunkBody(b.patch) === hunkBody(f.patch);
  });
}

/**
 * The verdict for one PR.
 * @param {object} input
 * @param {object} input.pr        the pull request (live: labels, draft, author)
 * @param {string} input.headSha   the commit this check is attached to
 * @param {object | null} input.review  latestReview() of the PR
 * @param {boolean} [input.unchanged]   sameChanges() between the approved commit and the head
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
      reason: `CodeRabbit approved ${short(review.commit_id)}. The commits since only bring in main: the PR's own changes at ${short(headSha)} are the same.`,
    };
  }
  return {
    pass: false,
    reason: `CodeRabbit approved ${short(review.commit_id)}, but the PR's changes are different at ${short(headSha)}. Wait for it to review the new commits, or comment \`@coderabbitai review\`.`,
  };
}

async function compareFiles(repo, base, sha) {
  const cmp = await gh(`repos/${repo}/compare/${encodeURIComponent(base)}...${sha}`);
  return cmp.files ?? [];
}

/**
 * Reads the PR from the API and returns the verdict. Everything it calls is a
 * read, so a fork PR's read-only token is enough.
 */
export async function run({ repo, number, headSha, log = console.log }) {
  if (!repo || !Number.isInteger(number) || number <= 0 || !/^[0-9a-f]{40}$/.test(headSha ?? '')) {
    throw new Error('GITHUB_REPOSITORY, PR_NUMBER and HEAD_SHA are required');
  }
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
    try {
      const base = pr.base.ref;
      unchanged = sameChanges(
        await compareFiles(repo, base, review.commit_id),
        await compareFiles(repo, base, headSha),
      );
    } catch (e) {
      log(`Could not compare ${short(review.commit_id)} with ${short(headSha)}: ${e.message}`);
    }
  }
  return verdict({ pr, headSha, review, unchanged, overrideBy });
}

async function main() {
  const v = await run({
    repo: process.env.GITHUB_REPOSITORY,
    number: Number(process.env.PR_NUMBER),
    headSha: process.env.HEAD_SHA,
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
