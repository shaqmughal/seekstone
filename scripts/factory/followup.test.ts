import { describe, expect, it } from 'vitest';
import {
  decide,
  fixHistory,
  MAX_FIXES,
  markerFor,
  requiredState,
  ticketFromBranch,
} from './followup.mjs';

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
const pr = (over = {}) => ({ number: 7, draft: true, headSha: SHA, labels: [], ...over });

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
    const comments = [{ body: 'hi' }, { body: `x ${markerFor('0000000', 1)}` }];
    expect(fixHistory(comments, SHA)).toEqual({ attempts: 1, forSha: false });
    comments.push({ body: markerFor(SHA, 2) });
    expect(fixHistory(comments, SHA)).toEqual({ attempts: 2, forSha: true });
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
  const base = { required: REQUIRED, comments: [], sonnet: false };

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
    const comments = [{ body: markerFor(SHA, 1) }];
    expect(decide({ ...base, comments, pr: pr(), checkRuns: red }).action).toBe('none');
  });

  it('blocks after the last attempt', () => {
    const comments = [{ body: markerFor('1111111', MAX_FIXES) }];
    const d = decide({ ...base, comments, pr: pr(), checkRuns: red });
    expect(d.action).toBe('block');
    expect(d.reason).toContain('test (ubuntu-latest)');
  });

  it('gives a Sonnet ticket one final attempt on Opus', () => {
    const comments = [{ body: markerFor('1111111', MAX_FIXES) }];
    const d = decide({ ...base, sonnet: true, comments, pr: pr(), checkRuns: red });
    expect(d).toMatchObject({ action: 'fix', attempt: MAX_FIXES + 1, model: 'opus' });
    const before = decide({ ...base, sonnet: true, pr: pr(), checkRuns: red });
    expect(before.model).toBeUndefined();
  });
});
