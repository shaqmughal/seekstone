import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  isReleasePr,
  latestReview,
  OVERRIDE_LABEL,
  onlyBaseMerges,
  RELEASE_AUTHOR,
  RELEASE_BRANCH,
  REVIEWER,
  run,
  runGit,
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

describe('onlyBaseMerges', () => {
  // A real repo: main with a.txt and b.txt; a PR branch that edits a.txt.
  // Two functions share the same body, so a relocated edit would look the
  // same in a patch with its line numbers removed.
  let dir: string;
  const git = (args: string[]) => runGit(args, dir);
  const write = (name: string, text: string) => writeFileSync(join(dir, name), text);
  const commit = (msg: string) => {
    git(['add', '-A']);
    git(['commit', '-q', '-m', msg]);
    return git(['rev-parse', 'HEAD']);
  };
  const body = 'function f() {\n  return 1;\n}\n';
  let approved: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'review-gate-'));
    git(['init', '-q', '-b', 'main']);
    git(['config', 'user.email', 'test@example.com']);
    git(['config', 'user.name', 'test']);
    git(['config', 'commit.gpgsign', 'false']);
    write('a.txt', `// one\n${body}// two\n${body}`);
    write('b.txt', 'b\n');
    commit('base');
    git(['checkout', '-q', '-b', 'pr']);
    write('a.txt', `// one\n${body.replace('1', '2')}// two\n${body}`);
    approved = commit('pr change');
    git(['checkout', '-q', 'main']);
    write('b.txt', 'b changed on main\n');
    commit('main moves on');
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const branchFrom = (name: string) => git(['checkout', '-q', '-B', name, approved]);

  it('accepts a clean merge of main', () => {
    branchFrom('clean');
    git(['merge', '-q', '--no-edit', 'main']);
    const head = git(['rev-parse', 'HEAD']);
    expect(onlyBaseMerges({ approved, head, baseRef: 'main', git })).toMatchObject({ ok: true });
  });

  it('accepts two merges in a row', () => {
    branchFrom('twice');
    git(['merge', '-q', '--no-edit', 'main~1']);
    git(['merge', '-q', '--no-edit', 'main']);
    const head = git(['rev-parse', 'HEAD']);
    expect(onlyBaseMerges({ approved, head, baseRef: 'main', git }).ok).toBe(true);
  });

  it('rejects a merge that slipped in an edit', () => {
    branchFrom('evil');
    git(['merge', '-q', '--no-commit', 'main']);
    write('a.txt', `// one\n${body.replace('1', '2')}// two\n${body.replace('1', '3')}`);
    const head = commit('merge main');
    const m = onlyBaseMerges({ approved, head, baseRef: 'main', git });
    expect(m).toMatchObject({ ok: false });
    expect(m.why).toContain('differs from a clean merge');
  });

  it('rejects an edit moved to a function with the same context', () => {
    branchFrom('moved');
    write('a.txt', `// one\n${body}// two\n${body.replace('1', '2')}`);
    const head = commit('move the change');
    expect(onlyBaseMerges({ approved, head, baseRef: 'main', git }).why).toContain('not a merge');
  });

  it('rejects a merge of a branch that is not main', () => {
    git(['checkout', '-q', '-B', 'side', 'main~1']);
    write('c.txt', 'c\n');
    const side = commit('side');
    branchFrom('other');
    git(['merge', '-q', '--no-edit', side]);
    const head = git(['rev-parse', 'HEAD']);
    expect(onlyBaseMerges({ approved, head, baseRef: 'main', git }).why).toContain('not on main');
  });

  it('rejects an approval that is not on the first-parent line', () => {
    git(['checkout', '-q', '-B', 'reverse', 'main']);
    git(['merge', '-q', '--no-edit', approved]);
    const head = git(['rev-parse', 'HEAD']);
    expect(onlyBaseMerges({ approved, head, baseRef: 'main', git }).ok).toBe(false);
  });

  it('fails closed on a missing commit or when nothing came after the approval', () => {
    const m = onlyBaseMerges({ approved: 'f'.repeat(40), head: approved, baseRef: 'main', git });
    expect(m.why).toContain('git could not check it');
    expect(onlyBaseMerges({ approved, head: approved, baseRef: 'main', git }).ok).toBe(false);
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
    expect(v.reason).toContain('not only clean merges');
  });

  it('passes an approval on an older commit when only clean merges of main came since', () => {
    const v = verdict({
      pr: pull(),
      headSha: HEAD,
      review: review('APPROVED', OLD),
      unchanged: true,
    });
    expect(v.pass).toBe(true);
    expect(v.reason).toContain('clean merge of the base branch');
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

  it('checks the commits after an older approval with git', async () => {
    const log = vi.fn();
    const git = vi.fn(() => {
      throw new Error('fatal: bad object');
    });
    routes({
      '/repos/o/r/pulls/7/reviews': [review('APPROVED', OLD)],
      '/repos/o/r/pulls/7': pull(),
    });
    const v = await run({ repo: 'o/r', number: 7, headSha: HEAD, git, log });
    expect(v.pass).toBe(false);
    expect(git).toHaveBeenCalledWith([
      'rev-list',
      '--first-parent',
      '--parents',
      `${OLD}..${HEAD}`,
    ]);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('git could not check it'));
  });

  it('refuses a base ref that could be read as a git option', async () => {
    routes({});
    await expect(
      run({ repo: 'o/r', number: 7, headSha: HEAD, baseRef: '--output=x' }),
    ).rejects.toThrow(/bad BASE_REF/);
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
