import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  decide,
  fixHistory,
  MAX_FIXES,
  markerFor,
  REVIEW_DONE,
  REVIEW_OPEN_LABEL,
  requiredState,
  reviewRound,
  ticketFromBranch,
} from './followup.mjs';
import { reviewStatus } from './review.mjs';

const REQUIRED = ['test (ubuntu-latest)', 'quality rules'];
const run = (id: number, name: string, status: string, conclusion: string | null = null) => ({
  id,
  name,
  status,
  conclusion,
});
const green = [
  run(1, 'test (ubuntu-latest)', 'completed', 'success'),
  run(2, 'quality rules', 'completed', 'success'),
];
const red = [
  run(1, 'test (ubuntu-latest)', 'completed', 'failure'),
  run(2, 'quality rules', 'completed', 'success'),
];
const SHA = 'abc1234def5678';
const BOT = 'seekstone-factory[bot]';
const mine = (body: string) => ({ user: { login: BOT }, body });
const pr = (over = {}) => ({ number: 7, draft: true, headSha: SHA, labels: [], ...over });

const clean = { reviewed: true, changesRequested: false, open: 0 };
const base = { required: REQUIRED, comments: [], sonnet: false, bot: BOT, review: clean };
const started = mine(`Starting the review round.\n\n<!-- factory-review sha=${SHA} -->`);
const done = mine(`Review round finished.\n\n${REVIEW_DONE}`);

describe('requiredState', () => {
  it('uses the newest run per check and treats skipped as passing', () => {
    const runs = [
      run(1, 'quality rules', 'completed', 'cancelled'),
      run(5, 'quality rules', 'completed', 'skipped'),
      run(2, 'test (ubuntu-latest)', 'in_progress'),
    ];
    expect(requiredState(REQUIRED, runs)).toEqual({
      pending: ['test (ubuntu-latest)'],
      failed: [],
    });
  });

  it('counts a missing check as pending and a cancelled one as failed', () => {
    expect(requiredState(REQUIRED, [run(1, 'quality rules', 'completed', 'cancelled')])).toEqual({
      pending: ['test (ubuntu-latest)'],
      failed: ['quality rules'],
    });
  });
});

describe('fixHistory', () => {
  it('counts attempts and spots a fix already started for this commit', () => {
    const comments = [mine('hi'), mine(`x ${markerFor('0000000', 1)}`)];
    expect(fixHistory(comments, SHA, BOT)).toEqual({ attempts: 1, forSha: false });
    comments.push(mine(markerFor(SHA, 2)));
    expect(fixHistory(comments, SHA, BOT)).toEqual({ attempts: 2, forSha: true });
  });

  it('ignores markers posted by anyone but the factory app', () => {
    const forged = [{ user: { login: 'someone' }, body: markerFor(SHA, MAX_FIXES) }];
    expect(fixHistory(forged, SHA, BOT)).toEqual({ attempts: 0, forSha: false });
    expect(decide({ ...base, comments: forged, pr: pr(), checkRuns: red })).toMatchObject({
      action: 'fix',
      attempt: 1,
    });
  });
});

describe('ticketFromBranch', () => {
  it('reads the ticket from a factory branch only', () => {
    expect(ticketFromBranch('factory/SHA-196-unit-test')).toBe('SHA-196');
    expect(ticketFromBranch('factory/SHA-7')).toBe('SHA-7');
    expect(ticketFromBranch('feature/SHA-196-x')).toBeNull();
    expect(ticketFromBranch('factory/SHA-196x')).toBeNull();
  });
});

describe('decide', () => {
  it('marks a green draft ready', () => {
    expect(decide({ ...base, pr: pr(), checkRuns: green })).toEqual({ action: 'ready' });
  });

  it('waits while required checks run', () => {
    const d = decide({ ...base, pr: pr(), checkRuns: [green[0]] });
    expect(d.action).toBe('wait');
  });

  it('does nothing for a PR that is ready or blocked', () => {
    expect(decide({ ...base, pr: pr({ draft: false }), checkRuns: red }).action).toBe('none');
    expect(
      decide({ ...base, pr: pr({ labels: ['factory-blocked'] }), checkRuns: red }).action,
    ).toBe('none');
  });

  it('starts fix attempt 1 on a red check, without waiting for the rest', () => {
    const d = decide({ ...base, pr: pr(), checkRuns: [red[0]] });
    expect(d).toEqual({
      action: 'fix',
      failed: ['test (ubuntu-latest)'],
      attempt: 1,
      model: undefined,
    });
  });

  it('starts only one fix per commit', () => {
    const comments = [mine(markerFor(SHA, 1))];
    expect(decide({ ...base, comments, pr: pr(), checkRuns: red }).action).toBe('none');
  });

  it('blocks after the last attempt', () => {
    const comments = [mine(markerFor('1111111', MAX_FIXES))];
    const d = decide({ ...base, comments, pr: pr(), checkRuns: red });
    expect(d.action).toBe('block');
    expect(d.reason).toContain('test (ubuntu-latest)');
  });

  it('gives a Sonnet ticket one final attempt on Opus', () => {
    const comments = [mine(markerFor('1111111', MAX_FIXES))];
    const d = decide({ ...base, sonnet: true, comments, pr: pr(), checkRuns: red });
    expect(d).toMatchObject({ action: 'fix', attempt: MAX_FIXES + 1, model: 'opus' });
    const before = decide({ ...base, sonnet: true, pr: pr(), checkRuns: red });
    expect(before.model).toBeUndefined();
  });
});

describe('reviewRound', () => {
  it('reads the start and done markers from the factory app only', () => {
    expect(reviewRound([started], BOT)).toEqual({ started: true, sha: SHA, done: false });
    expect(reviewRound([started, done], BOT)).toEqual({ started: true, sha: SHA, done: true });
    const forged = [{ ...started, user: { login: 'someone' } }];
    expect(reviewRound(forged, BOT)).toEqual({ started: false, sha: null, done: false });
  });
});

describe('decide: the CodeRabbit review round', () => {
  const findings = { reviewed: true, changesRequested: true, open: 3 };

  it('keeps a green draft waiting until CodeRabbit has reviewed the head', () => {
    const review = { ...clean, reviewed: false };
    expect(decide({ ...base, review, pr: pr(), checkRuns: green })).toMatchObject({
      action: 'wait',
      reason: expect.stringContaining('CodeRabbit'),
    });
  });

  it('starts the review round once CI is green and CodeRabbit has findings', () => {
    expect(decide({ ...base, review: findings, pr: pr(), checkRuns: green })).toEqual({
      action: 'review',
      reason: 'CodeRabbit: 3 open finding(s), changes requested',
    });
    const threadsOnly = { ...clean, open: 1 };
    expect(decide({ ...base, review: threadsOnly, pr: pr(), checkRuns: green }).action).toBe(
      'review',
    );
    const blockedOnly = { ...clean, changesRequested: true };
    expect(decide({ ...base, review: blockedOnly, pr: pr(), checkRuns: green }).action).toBe(
      'review',
    );
  });

  it('fixes CI first when CI fails and CodeRabbit has findings too', () => {
    expect(decide({ ...base, review: findings, pr: pr(), checkRuns: red })).toMatchObject({
      action: 'fix',
      attempt: 1,
    });
  });

  it('does nothing while the review round runs, even if CI fails', () => {
    const d = decide({ ...base, review: findings, comments: [started], pr: pr(), checkRuns: red });
    expect(d).toEqual({ action: 'none', reason: 'the review round is still running' });
  });

  it('lets a new commit go on when a round died without its done marker', () => {
    const old = mine('Starting the review round.\n\n<!-- factory-review sha=1111111 -->');
    expect(reviewRound([old], BOT)).toEqual({ started: true, sha: '1111111', done: false });
    const comments = [old];
    expect(decide({ ...base, review: findings, comments, pr: pr(), checkRuns: red })).toMatchObject(
      { action: 'fix', attempt: 1 },
    );
    expect(
      decide({ ...base, review: findings, comments, pr: pr(), checkRuns: green }),
    ).toMatchObject({ action: 'ready', label: REVIEW_OPEN_LABEL });
  });

  it('marks ready with the label when findings are still open after the round', () => {
    const d = decide({
      ...base,
      review: findings,
      comments: [started, done],
      pr: pr(),
      checkRuns: green,
    });
    expect(d).toMatchObject({ action: 'ready', label: REVIEW_OPEN_LABEL });
    expect(d.reason).toContain('3 open finding(s)');
  });

  it('marks ready without the label when the round cleared everything', () => {
    const d = decide({ ...base, comments: [started, done], pr: pr(), checkRuns: green });
    expect(d).toEqual({ action: 'ready' });
  });

  it('still waits for CodeRabbit on the new head after the round', () => {
    const review = { ...findings, reviewed: false };
    const d = decide({ ...base, review, comments: [started, done], pr: pr(), checkRuns: green });
    expect(d.action).toBe('wait');
  });

  it('keeps the CI-fix loop going after the round, without a second round', () => {
    const comments = [started, done, mine(markerFor('1111111', 1))];
    expect(decide({ ...base, review: findings, comments, pr: pr(), checkRuns: red })).toMatchObject(
      { action: 'fix', attempt: 2 },
    );
    expect(decide({ ...base, review: findings, comments, pr: pr(), checkRuns: green }).action).toBe(
      'ready',
    );
  });

  it('starts the round for an outside-diff finding followed by an approval on the head', () => {
    const body = readFileSync(
      new URL('./fixtures/coderabbit-review-outside-diff.md', import.meta.url),
      'utf8',
    );
    const author = { login: 'coderabbitai' };
    const reviews = [
      { author, state: 'COMMENTED', body, commit: { oid: SHA } },
      { author, state: 'APPROVED', body: '', commit: { oid: SHA } },
    ];
    const review = reviewStatus({
      reviews,
      threads: [],
      comments: [],
      checkRuns: [],
      headSha: SHA,
    });
    expect(decide({ ...base, review, pr: pr(), checkRuns: green })).toEqual({
      action: 'review',
      reason: 'CodeRabbit: 1 open finding(s)',
    });
  });
});
