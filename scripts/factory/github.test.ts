import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiUrl, ghAll, nextPage, requiredChecks } from './github.mjs';

afterEach(() => vi.unstubAllGlobals());

describe('apiUrl', () => {
  it('builds api.github.com URLs for repo paths', () => {
    expect(apiUrl('repos/o/r/pulls?state=open&head=o:factory%2FSHA-1-x').href).toBe(
      'https://api.github.com/repos/o/r/pulls?state=open&head=o:factory%2FSHA-1-x',
    );
  });

  it('allows the three-dot range of the compare endpoint', () => {
    const sha = 'a'.repeat(40);
    expect(apiUrl(`repos/o/r/compare/main...${sha}`).href).toBe(
      `https://api.github.com/repos/o/r/compare/main...${sha}`,
    );
  });

  it('refuses paths that could leave the API or the repo', () => {
    for (const p of [
      '//evil.example/x',
      'https://evil.example/repos/o/r',
      'repos/o/r/../../../users',
      'repos/o/r/./x',
      'repos/o/r/%2e%2e/%2e%2e/%2e%2e/users',
      'repos/o/r/%2E%2E/x',
      'users/octocat',
      'repos/o/r/x y',
      'repos/o/r/#frag',
    ]) {
      expect(() => apiUrl(p), p).toThrow(/refusing/);
    }
  });
});

describe('requiredChecks', () => {
  const stub = (body: unknown) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
    );

  it('reads the required check contexts from the main ruleset', async () => {
    stub([
      { type: 'deletion' },
      {
        type: 'required_status_checks',
        parameters: { required_status_checks: [{ context: 'a' }, { context: 'b' }] },
      },
    ]);
    expect(await requiredChecks('o/r')).toEqual(['a', 'b']);
  });

  it('fails closed when main has no required checks', async () => {
    stub([{ type: 'deletion' }]);
    await expect(requiredChecks('o/r')).rejects.toThrow(/no required status checks/);
  });
});

describe('paging', () => {
  it('reads the next page from a Link header', () => {
    const link =
      '<https://api.github.com/repos/o/r/issues?page=2>; rel="next", <https://api.github.com/repos/o/r/issues?page=5>; rel="last"';
    expect(nextPage(link)).toBe('repos/o/r/issues?page=2');
    expect(nextPage('<https://api.github.com/repos/o/r/issues?page=1>; rel="prev"')).toBeNull();
    expect(nextPage(null)).toBeNull();
  });

  it('follows pages and unwraps keyed lists', async () => {
    const pages = [
      new Response(JSON.stringify({ workflow_runs: [1, 2] }), {
        headers: { link: '<https://api.github.com/repos/o/r/runs?page=2>; rel="next"' },
      }),
      new Response(JSON.stringify({ workflow_runs: [3] })),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => pages.shift()),
    );
    expect(await ghAll('repos/o/r/runs', { key: 'workflow_runs' })).toEqual([1, 2, 3]);
  });
});
