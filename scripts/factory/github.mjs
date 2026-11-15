// Minimal GitHub REST client for the factory scripts (SHA-536). Every
// request goes to api.github.com; the path is checked so values from the
// event payload can't point it anywhere else.

const API = 'https://api.github.com';
const SAFE_PATH = /^repos\/[\w.-]+\/[\w.-]+\/[\w./?=&%:-]*$/;

export function apiUrl(path) {
  if (!SAFE_PATH.test(path) || path.includes('..')) {
    throw new Error(`refusing GitHub API path: ${path}`);
  }
  const url = new URL(path, `${API}/`);
  if (url.origin !== API) throw new Error(`refusing GitHub API URL: ${url}`);
  return url;
}

export async function gh(path, { raw = false, token = process.env.GITHUB_TOKEN } = {}) {
  const res = await fetch(apiUrl(path), {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`GitHub ${path}: HTTP ${res.status}`);
  return raw ? res.text() : res.json();
}

/** Contexts of the required status checks on main. Throws when there are none. */
export async function requiredChecks(repo) {
  const rules = await gh(`repos/${repo}/rules/branches/main`);
  const required = rules
    .filter((r) => r.type === 'required_status_checks')
    .flatMap((r) => r.parameters.required_status_checks.map((c) => c.context));
  // With no required checks every PR would look green; refuse instead.
  if (required.length === 0) throw new Error('no required status checks found for main');
  return required;
}
