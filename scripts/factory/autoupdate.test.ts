import { describe, expect, it } from 'vitest';
import { candidates, decide, REBASE_LABEL } from './autoupdate.mjs';

const pull = (over = {}) => ({
  number: 10,
  state: 'open',
  draft: false,
  base: { ref: 'main', repo: { full_name: 'o/r' } },
  auto_merge: { merge_method: 'squash' },
  labels: [],
  head: { sha: 'aaa', repo: { full_name: 'o/r' } },
  ...over,
});

const pr = (over = {}) => ({
  number: 10,
  headSha: 'aaa111',
  behindBy: 0,
  pending: [] as string[],
  failed: [] as string[],
  ...over,
});

describe('candidates', () => {
  it('keeps open, non-draft PRs into main with auto-merge on', () => {
    expect(candidates([pull()]).map((p) => p.number)).toEqual([10]);
  });

  it('drops PRs without auto-merge, drafts, other bases, closed PRs, forks and needs-rebase', () => {
    const out = candidates([
      pull({ number: 1, auto_merge: null }),
      pull({ number: 2, draft: true }),
      pull({ number: 3, base: { ref: 'release', repo: { full_name: 'o/r' } } }),
      pull({ number: 7, head: { sha: 'f', repo: { full_name: 'someone/fork' } } }),
      pull({ number: 8, head: { sha: 'g', repo: null } }),
      pull({ number: 4, state: 'closed' }),
      pull({ number: 5, labels: [{ name: REBASE_LABEL }] }),
      pull({ number: 6, labels: [{ name: 'factory' }] }),
    ]);
    expect(out.map((p) => p.number)).toEqual([6]);
  });
});

describe('decide', () => {
  it('does nothing when there are no approved PRs', () => {
    expect(decide([])).toEqual({ action: 'none', reason: 'no approved PR is behind main' });
  });

  it('updates the oldest PR that is behind main', () => {
    const d = decide([
      pr({ number: 12, headSha: 'bbb', behindBy: 1 }),
      pr({ number: 11, headSha: 'aaa', behindBy: 3 }),
    ]);
    expect(d).toMatchObject({ action: 'update', pr: 11, sha: 'aaa' });
    expect(d.reason).toContain('3 commit(s) behind');
  });

  it('waits while an approved PR is up to date and its CI is running', () => {
    const d = decide([
      pr({ number: 11, behindBy: 2 }),
      pr({ number: 12, behindBy: 0, pending: ['test (ubuntu-latest)'] }),
    ]);
    expect(d).toMatchObject({ action: 'wait', pr: 12 });
    expect(d.reason).toContain('waiting on CI');
  });

  it('waits while an up-to-date PR with green checks is about to merge', () => {
    const d = decide([pr({ number: 11, behindBy: 2 }), pr({ number: 12, behindBy: 0 })]);
    expect(d).toMatchObject({ action: 'wait', pr: 12 });
    expect(d.reason).toContain('ready to merge');
  });

  it('skips a PR with failed checks so it cannot hold up the queue', () => {
    const d = decide([
      pr({ number: 11, behindBy: 0, failed: ['quality rules'] }),
      pr({ number: 12, headSha: 'ccc', behindBy: 1 }),
    ]);
    expect(d).toMatchObject({ action: 'update', pr: 12, sha: 'ccc' });
    expect(d.reason).toContain('skipped with failed checks: #11');
  });

  it('does not update a PR whose checks failed, even when it is behind', () => {
    const d = decide([pr({ number: 11, behindBy: 4, failed: ['test (windows-latest)'] })]);
    expect(d.action).toBe('none');
    expect(d.reason).toContain('#11');
  });

  it('picks the oldest when several PRs are up to date', () => {
    const d = decide([
      pr({ number: 14, behindBy: 0, pending: ['x'] }),
      pr({ number: 13, behindBy: 0, pending: ['x'] }),
    ]);
    expect(d).toMatchObject({ action: 'wait', pr: 13 });
  });
});
