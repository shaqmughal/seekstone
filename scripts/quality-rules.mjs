// Quality rules for pull requests (SHA-520). Pure functions over the PR's
// changed-file list as GitHub's "list pull request files" API returns it:
// { filename, status, additions, deletions, patch? }. The CLI wrapper
// (check-quality-rules.mjs) fetches that list and applies the results.
//
// All PRs:      no weakened tests (unless approved by label).
// factory PRs:  scope lock and size limit. Failing-test-first runs as its
//               own CI job, since it needs to execute tests.

export const SIZE_LIMIT = 400;

const TEST_FILE = /\.test\.(?:[cm]?[jt]s)$/;
/** A test or suite declaration at the start of a diff line's code. */
const TEST_DECL = /^\s*(?:it|test)(?:\.(?:each|concurrent|sequential)\b[^(]*)?\s*\(/;
/**
 * Ways to switch a test off or narrow a run, at the start of an added code
 * line. Anchored like TEST_DECL, so the same text inside a string literal
 * (e.g. this module's own test fixtures) doesn't count.
 */
const DISABLE =
  /^\s*(?:(?:it|test|describe|suite)\.(?:skip|skipIf|only|todo)\b|x(?:it|describe|test)\s*\()/;

export const isTestFile = (path) => TEST_FILE.test(path);

/**
 * Files that exist to support tests rather than ship: stub servers, mocks,
 * fakes, fixtures and test utilities. Failing-test-first keeps these at the
 * PR version when it reverts the source, so a new test's helpers stay
 * available and the test fails only if the fix is missing.
 */
const TEST_SUPPORT =
  /(?:^|\/)(?:__fixtures__|__mocks__|testdata|test-utils?)\/|(?:^|\/)(?:stub|mock|fake)s?[-.][^/]*$|[-_.](?:stub|mock|fake|fixture)s?\.[cm]?[jt]sx?$|(?:^|\/)test-?utils?\.[cm]?[jt]sx?$/i;
export const isTestSupport = (path) => TEST_SUPPORT.test(path);

/**
 * The PR's source files for failing-test-first: changed ones to restore from
 * the base commit, added ones to delete, and renamed ones whose new path gets
 * the old path's base content (so imports still resolve and the tests run
 * against the old code, not against a missing file). Tests and test support
 * are left as the PR has them.
 * @returns {{ changed: string[], added: string[], renamed: { from: string, to: string }[] }}
 */
export function sourceToRevert(files) {
  const source = files.filter((f) => !isTestFile(f.filename) && !isTestSupport(f.filename));
  const isRename = (f) => f.status === 'renamed' && f.previous_filename;
  return {
    changed: source.filter((f) => f.status !== 'added' && !isRename(f)).map((f) => f.filename),
    added: source.filter((f) => f.status === 'added').map((f) => f.filename),
    renamed: source.filter(isRename).map((f) => ({ from: f.previous_filename, to: f.filename })),
  };
}

/** Added and removed code lines of a unified diff, without the +/- marker. */
function diffLines(patch = '') {
  const added = [];
  const removed = [];
  for (const line of patch.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) added.push(line.slice(1));
    else if (line.startsWith('-')) removed.push(line.slice(1));
  }
  return { added, removed };
}

/**
 * Ways a PR weakens the test suite: deleted test files, fewer test
 * declarations in a file than before, or newly added skip/only/todo.
 * Moving a test within a file (one removed, one added) is not weakening.
 * @returns {string[]} one human-readable reason per finding
 */
export function weakenedTests(files) {
  const reasons = [];
  for (const f of files) {
    if (!isTestFile(f.filename)) continue;
    if (f.status === 'removed') {
      reasons.push(`${f.filename}: test file deleted`);
      continue;
    }
    const { added, removed } = diffLines(f.patch);
    const lost =
      removed.filter((l) => TEST_DECL.test(l)).length -
      added.filter((l) => TEST_DECL.test(l)).length;
    if (lost > 0) reasons.push(`${f.filename}: ${lost} test(s) removed`);
    const disabled = added.filter((l) => DISABLE.test(l));
    for (const l of disabled) reasons.push(`${f.filename}: adds \`${l.trim().slice(0, 80)}\``);
  }
  return reasons;
}

/** Paths a factory PR must never touch (agents don't edit their own guardrails). */
const LOCKED = [
  /^\.github\//,
  /(^|\/)CLAUDE\.md$/,
  /(^|\/)AGENTS\.md$/,
  /^\.claude\//,
  /^biome\.json$/,
  /^codecov\.yml$/,
  /^\.coderabbit\.ya?ml$/,
];

/**
 * Scope lock for factory PRs. A lockfile change means dependencies changed,
 * which is allowed only with the `dependencies` label.
 * @returns {string[]} one reason per violation
 */
export function scopeViolations(files, labels) {
  const reasons = [];
  for (const f of files) {
    if (LOCKED.some((re) => re.test(f.filename))) {
      reasons.push(`${f.filename}: factory PRs may not change this path`);
    }
    if (f.filename.endsWith('package-lock.json') && !labels.includes('dependencies')) {
      reasons.push(`${f.filename}: dependency change without the \`dependencies\` label`);
    }
  }
  return reasons;
}

/** Generated or bookkeeping files that don't count toward the size limit. */
const SIZE_EXEMPT = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)CHANGELOG\.md$/,
  /^benchmarks\.json$/,
  /^packages\/harness\/fixtures\/baseline-reports\//,
  /^\.changeset\//,
];

/** Changed lines that count toward the factory size limit. */
export function changedLines(files) {
  return files
    .filter((f) => !SIZE_EXEMPT.some((re) => re.test(f.filename)))
    .reduce((n, f) => n + (f.additions ?? 0) + (f.deletions ?? 0), 0);
}

/** Test files added or changed by the PR (inputs to the flaky and failing-first checks). */
export function changedTestFiles(files) {
  return files
    .filter((f) => isTestFile(f.filename) && f.status !== 'removed')
    .map((f) => f.filename)
    .sort();
}

/**
 * Apply every diff-based rule.
 * @param {Array<{filename: string, status: string, additions?: number, deletions?: number, patch?: string}>} files
 * @param {string[]} labels
 */
export function evaluate(files, labels) {
  const factory = labels.includes('factory');
  const weakened = weakenedTests(files);
  const approved = labels.includes('tests-weakened:approved');
  const failures = [];
  if (weakened.length > 0 && !approved) {
    failures.push(
      'Tests weakened. A maintainer can add the `tests-weakened:approved` label to accept it:',
      ...weakened.map((r) => `  - ${r}`),
    );
  }
  if (factory) {
    const scope = scopeViolations(files, labels);
    if (scope.length > 0) failures.push('Scope lock:', ...scope.map((r) => `  - ${r}`));
    const size = changedLines(files);
    if (size > SIZE_LIMIT) {
      failures.push(`Size limit: ${size} changed lines (max ${SIZE_LIMIT}). Split the ticket.`);
    }
  }
  return {
    ok: failures.length === 0,
    failures,
    weakened,
    approved,
    testFiles: changedTestFiles(files),
  };
}

/**
 * Group repo-relative test paths by Vitest root: packages/<pkg>/... runs with
 * --root packages/<pkg>; anything else (e.g. scripts/) from the repo root.
 * @returns {Map<string, string[]>}
 */
export function byRoot(paths) {
  const groups = new Map();
  for (const p of paths) {
    // Paths come from the PR. One that starts with "-" would be read as a
    // Vitest option, so refuse it rather than pass it on.
    if (p.startsWith('-') || p.includes('/-')) throw new Error(`refusing test path: ${p}`);
    const m = p.match(/^(packages\/[^/]+)\/(.+)$/);
    const root = m ? m[1] : '.';
    const rel = m ? m[2] : p;
    groups.set(root, [...(groups.get(root) ?? []), rel]);
  }
  return groups;
}
