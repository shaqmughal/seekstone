// Pure logic for scripts/check-changesets.mjs, split out so it can be unit
// tested (mirrors benchmarks-guard.mjs / check-docs-sync.mjs).
//
// The invariant: `seekstone` is the only package this repo publishes.
// `@seekstone/core` and `@seekstone/harness` are private — core ships *inside*
// the server bundle — so a changeset naming either is a "mixed changeset",
// which `changeset version` hard-errors on. That error only surfaces in the
// post-merge Release workflow, where it silently blocked 0.17.0 for two days
// (SHA-324). Fail the PR instead.

export const PUBLISHABLE = 'seekstone';
const BUMPS = new Set(['patch', 'minor', 'major']);

/**
 * Validate one `.changeset/*.md` file. Returns a list of actionable error
 * strings (empty when the changeset is fine).
 */
export function checkChangeset(file, text) {
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n?---(?:\r?\n|$)/);
  if (!fm) {
    return [`${file}: missing the "---" frontmatter block. Regenerate it with \`npx changeset\`.`];
  }

  const errors = [];
  const lines = fm[1].split(/\r?\n/).filter((l) => l.trim() !== '');
  // An empty frontmatter is a valid "no release" changeset (`changeset --empty`).
  for (const line of lines) {
    const entry = line.match(/^\s*(["']?)([^"']+)\1\s*:\s*(\S+)\s*$/);
    if (!entry) {
      errors.push(`${file}: cannot parse frontmatter line "${line.trim()}".`);
      continue;
    }
    const [, , pkg, bump] = entry;
    if (pkg !== PUBLISHABLE) {
      errors.push(
        `${file}: names "${pkg}", but "${PUBLISHABLE}" is the only package a changeset may name. ` +
          `"${pkg}" is private (it ships inside the server bundle), and a changeset that names it ` +
          `breaks \`changeset version\` in the Release workflow. Remove that line; if the change ` +
          `affects users, bump "${PUBLISHABLE}" instead.`,
      );
    }
    if (!BUMPS.has(bump)) {
      errors.push(`${file}: bump "${bump}" for "${pkg}" must be one of patch, minor, major.`);
    }
  }
  return errors;
}
