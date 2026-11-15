import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiUrl, requiredChecks } from './github.mjs';

afterEach(() => vi.unstubAllGlobals());

describe('apiUrl', () => {
  it('builds api.github.com URLs for repo paths', () => {
    expect(apiUrl('repos/o/r/pulls?state=open&head=o:factory%2FSHA-1-x').href).toBe(
      'https://api.github.com/repos/o/r/pulls?state=open&head=o:factory%2FSHA-1-x',
    );
  });

  it('refuses paths that could leave the API or the repo', () => {
    for (const p of [
      '//evil.example/x',
      'https://evil.example/repos/o/r',
      'repos/o/r/../../../users',
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
