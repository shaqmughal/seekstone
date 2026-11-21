import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isReleasePr,
  latestReview,
  MAX_FILES,
  OVERRIDE_LABEL,
  RELEASE_AUTHOR,
  RELEASE_BRANCH,
  REVIEWER,
  run,
  sameChanges,
  verdict,
} from './review-gate.mjs';

afterEach(() => vi.unstubAllGlobals());

const HEAD = 'a'.repeat(40);
const OLD = 'b'.repeat(40);

const pull = (over: Record<string, unknown> = {}) => ({
  number: 7,
  draft: false,
  labels: [] as { name: string }[],
  user: { login: 'someone' },
  head: { ref: 'feat/x', sha: HEAD, repo: { full_name: 'o/r' } },
  base: { ref: 'main', repo: { full_name: 'o/r' } },
  ...over,
});

const review = (state: string, commit_id = HEAD, submitted_at = '2026-11-21T10:00:00Z') => ({
  user: { login: REVIEWER },
  state,
  commit_id,
  submitted_at,
});

const file = (over: Record<string, unknown> = {}) => ({
  filename: 'src/a.ts',
  status: 'modified',
  sha: 'blob1',
  patch: '@@ -1,2 +1,3 @@\n a\n+b\n c',
  ...over,
});

describe('isReleasePr', () => {
  const release = () =>
    pull({
      user: { login: RELEASE_AUTHOR },
      head: { ref: RELEASE_BRANCH, sha: HEAD, repo: { full_name: 'o/r' } },
    });

  it('matches the release app branch in this repo', () => {
    expect(isReleasePr(release())).toBe(true);
  });

  it('does not match the same branch name from a fork or another author', () => {
    expect(
      isReleasePr({ ...release(), head: { ref: RELEASE_BRANCH, repo: { full_name: 'x/r' } } }),
    ).toBe(false);
    expect(isReleasePr({ ...release(), head: { ref: RELEASE_BRANCH, repo: null } })).toBe(false);
    expect(isReleasePr({ ...release(), user: { login: 'someone' } })).toBe(false);
    expect(isReleasePr(pull())).toBe(false);
  });
});

describe('latestReview', () => {
  it('takes the newest decisive CodeRabbit review and ignores comments and other people', () => {
    const r = latestReview([
      review('CHANGES_REQUESTED', OLD, '2026-11-21T09:00:00Z'),
      review('APPROVED', HEAD, '2026-11-21T10:00:00Z'),
      review('COMMENTED', HEAD, '2026-11-21T11:00:00Z'),
      { ...review('CHANGES_REQUESTED', HEAD, '2026-11-21T12:00:00Z'), user: { login: 'human' } },
    ]);
    expect(r).toMatchObject({ state: 'APPROVED', commit_id: HEAD });
  });

  it('sorts by submission time, not list order', () => {
    const r = latestReview([
      review('APPROVED', HEAD, '2026-11-21T10:00:00Z'),
      review('CHANGES_REQUESTED', OLD, '2026-11-21T09:00:00Z'),
    ]);
    expect(r?.state).toBe('APPROVED');
  });

  it('reports a dismissed approval as dismissed', () => {
    expect(latestReview([review('DISMISSED')])?.state).toBe('DISMISSED');
  });

  it('returns null when CodeRabbit only commented', () => {
    expect(latestReview([review('COMMENTED')])).toBeNull();
    expect(latestReview([])).toBeNull();
  });
});

describe('sameChanges', () => {
  it('accepts identical file lists', () => {
    expect(sameChanges([file()], [file()])).toBe(true);
  });

  it('accepts a patch whose hunks only moved because main changed lines above', () => {
    const moved = file({ sha: 'blob2', patch: '@@ -11,2 +11,3 @@ fn()\n a\n+b\n c' });
    expect(sameChanges([file()], [moved])).toBe(true);
  });

  it('rejects a changed line, an extra file, a missing file or a new status', () => {
    expect(sameChanges([file()], [file({ sha: 'x', patch: '@@ -1,2 +1,3 @@\n a\n+B\n c' })])).toBe(
      false,
    );
    expect(sameChanges([file()], [file(), file({ filename: 'src/b.ts' })])).toBe(false);
    expect(sameChanges([file()], [file({ filename: 'src/b.ts' })])).toBe(false);
    expect(sameChanges([file()], [file({ status: 'added' })])).toBe(false);
    expect(sameChanges([file()], [file({ previous_filename: 'old.ts' })])).toBe(false);
  });

  it('fails closed when GitHub leaves out a patch or truncates the list', () => {
    expect(sameChanges([file()], [file({ sha: 'x', patch: undefined })])).toBe(false);
    const many = Array.from({ length: MAX_FILES }, (_, i) => file({ filename: `f${i}` }));
    expect(sameChanges(many, many)).toBe(false);
  });
});

describe('verdict', () => {
  it('passes an approval on the head commit', () => {
    const v = verdict({ pr: pull(), headSha: HEAD, review: review('APPROVED') });
    expect(v.pass).toBe(true);
    expect(v.reason).toContain('approved the head commit');
  });

  it('fails with no review, a change request or a dismissed approval', () => {
    expect(verdict({ pr: pull(), headSha: HEAD, review: null })).toMatchObject({ pass: false });
    const cr = verdict({ pr: pull(), headSha: HEAD, review: review('CHANGES_REQUESTED') });
    expect(cr).toMatchObject({ pass: false });
    expect(cr.reason).toContain('requests changes');
    const dis = verdict({ pr: pull(), headSha: HEAD, review: review('DISMISSED') });
    expect(dis.reason).toContain('was dismissed');
  });

  it('fails an approval on an older commit when the changes differ', () => {
    const v = verdict({ pr: pull(), headSha: HEAD, review: review('APPROVED', OLD) });
    expect(v.pass).toBe(false);
    expect(v.reason).toContain('changes are different');
  });

  it('passes an approval on an older commit when only main was merged in since', () => {
    const v = verdict({
      pr: pull(),
      headSha: HEAD,
      review: review('APPROVED', OLD),
      unchanged: true,
    });
    expect(v.pass).toBe(true);
    expect(v.reason).toContain('only bring in main');
  });

  it('passes on the override label and says so', () => {
    const v = verdict({
      pr: pull({ labels: [{ name: OVERRIDE_LABEL }] }),
      headSha: HEAD,
      review: review('CHANGES_REQUESTED'),
      overrideBy: 'maintainer',
    });
    expect(v).toMatchObject({ pass: true, override: true });
    expect(v.reason).toContain('by @maintainer');
  });

  it('passes the release PR and drafts without a review', () => {
    const release = pull({
      user: { login: RELEASE_AUTHOR },
      head: { ref: RELEASE_BRANCH, sha: HEAD, repo: { full_name: 'o/r' } },
    });
    expect(verdict({ pr: release, headSha: HEAD, review: null }).pass).toBe(true);
    const draft = verdict({ pr: pull({ draft: true }), headSha: HEAD, review: null });
    expect(draft.pass).toBe(true);
    expect(draft.reason).toContain('Draft');
  });
});

describe('run', () => {
  const routes = (map: Record<string, unknown>) => {
    const fetch = vi.fn(async (url: URL) => {
      const path = url.pathname + url.search;
      const hit = Object.entries(map).find(([k]) => path.startsWith(k));
      if (!hit) return new Response('{}', { status: 404 });
      return new Response(JSON.stringify(hit[1]), { status: 200 });
    });
    vi.stubGlobal('fetch', fetch);
    return fetch;
  };

  it('refuses bad input before calling the API', async () => {
    const fetch = routes({});
    await expect(run({ repo: 'o/r', number: 7, headSha: 'main' })).rejects.toThrow(/required/);
    await expect(run({ repo: 'o/r', number: Number.NaN, headSha: HEAD })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('passes an approved head', async () => {
    routes({
      '/repos/o/r/pulls/7/reviews': [review('APPROVED')],
      '/repos/o/r/pulls/7': pull(),
    });
    expect((await run({ repo: 'o/r', number: 7, headSha: HEAD })).pass).toBe(true);
  });

  it('compares the approved commit with the head when they differ', async () => {
    const fetch = routes({
      '/repos/o/r/pulls/7/reviews': [review('APPROVED', OLD)],
      '/repos/o/r/pulls/7': pull(),
      [`/repos/o/r/compare/main...${OLD}`]: { files: [file()] },
      [`/repos/o/r/compare/main...${HEAD}`]: { files: [file()] },
    });
    const v = await run({ repo: 'o/r', number: 7, headSha: HEAD });
    expect(v.pass).toBe(true);
    expect(fetch.mock.calls.map(([u]) => (u as URL).pathname)).toContain(
      `/repos/o/r/compare/main...${HEAD}`,
    );
  });

  it('fails closed when the compare call fails', async () => {
    const log = vi.fn();
    routes({
      '/repos/o/r/pulls/7/reviews': [review('APPROVED', OLD)],
      '/repos/o/r/pulls/7': pull(),
    });
    const v = await run({ repo: 'o/r', number: 7, headSha: HEAD, log });
    expect(v.pass).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Could not compare'));
  });

  it('names who added the override label', async () => {
    routes({
      '/repos/o/r/pulls/7/reviews': [],
      '/repos/o/r/pulls/7': pull({ labels: [{ name: OVERRIDE_LABEL }] }),
      '/repos/o/r/issues/7/events': [
        { event: 'labeled', label: { name: 'bug' }, actor: { login: 'x' } },
        { event: 'labeled', label: { name: OVERRIDE_LABEL }, actor: { login: 'maintainer' } },
      ],
    });
    const v = await run({ repo: 'o/r', number: 7, headSha: HEAD });
    expect(v).toMatchObject({ pass: true, override: true });
    expect(v.reason).toContain('@maintainer');
  });
});
