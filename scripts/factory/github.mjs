// Minimal GitHub REST client for the factory scripts (SHA-536). Every
// request goes to api.github.com; the path is checked so values from the
// event payload can't point it anywhere else.

const API = 'https://api.github.com';
const SAFE_PATH = /^repos\/[\w.-]+\/[\w.-]+\/[\w./?=&%:-]*$/;

export function apiUrl(path) {
  // A `.` or `..` segment could walk out of the repo. Dots inside a segment
  // are fine and needed: the compare endpoint takes `base...head`.
  const segments = path.split('?')[0].split('/');
  if (!SAFE_PATH.test(path) || segments.some((s) => s === '.' || s === '..')) {
    throw new Error(`refusing GitHub API path: ${path}`);
  }
  const url = new URL(path, `${API}/`);
  // The URL parser also resolves encoded dot segments (`%2e%2e`); a path that
  // changed on the way through is refused.
  if (url.origin !== API || url.pathname !== `/${path.split('?')[0]}`) {
    throw new Error(`refusing GitHub API URL: ${url}`);
  }
  return url;
}

async function request(path, token, init = {}) {
  // apiUrl() pins the origin to api.github.com and the path to repo endpoints.
  // nosemgrep: rules_lgpl_javascript_ssrf_rule-node-ssrf
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`GitHub ${path}: HTTP ${res.status}`);
  return res;
}

/** A GET, or a POST of `post` as JSON. */
export async function gh(path, { raw = false, post, token = process.env.GITHUB_TOKEN } = {}) {
  const init = post ? { method: 'POST', body: JSON.stringify(post) } : {};
  const res = await request(path, token, init);
  return raw ? res.text() : res.json();
}

/** A GraphQL query. Throws on an HTTP error or a GraphQL error. */
export async function graphql(query, variables, { token = process.env.GITHUB_TOKEN } = {}) {
  const res = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL: HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(`GitHub GraphQL: ${json.errors[0].message}`);
  return json.data;
}

/** The `rel="next"` page of a Link header, as an API path, or null. */
export function nextPage(link) {
  const m = link?.match(/<https:\/\/api\.github\.com\/([^>]+)>;\s*rel="next"/);
  return m ? m[1] : null;
}

/**
 * Every item of a paged list, following Link headers (up to `max` pages).
 * `key` names the array in endpoints that wrap it, like `workflow_runs`.
 */
export async function ghAll(path, { key, max = 20, token = process.env.GITHUB_TOKEN } = {}) {
  const items = [];
  let next = path;
  for (let n = 0; next && n < max; n++) {
    const res = await request(next, token);
    const body = await res.json();
    items.push(...(key ? body[key] : body));
    next = nextPage(res.headers.get('link'));
  }
  return items;
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

const PASS = new Set(['success', 'skipped', 'neutral']);

/**
 * State of each required check on the head commit, using the newest check
 * run per name. A missing check counts as pending.
 * @returns {{ pending: string[], failed: string[] }}
 */
export function requiredState(required, checkRuns) {
  const latest = new Map();
  for (const r of checkRuns) {
    const prev = latest.get(r.name);
    if (!prev || r.id > prev.id) latest.set(r.name, r);
  }
  const pending = [];
  const failed = [];
  for (const name of required) {
    const r = latest.get(name);
    if (r?.status !== 'completed') pending.push(name);
    else if (!PASS.has(r.conclusion)) failed.push(name);
  }
  return { pending, failed };
}
