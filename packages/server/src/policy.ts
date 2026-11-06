import picomatch from 'picomatch';

/**
 * Path policy: read-only mode plus read- and write-path scoping, parsed once
 * at boot. Three env vars:
 *
 *   SEEKSTONE_READ_ONLY=1         — write tools are unregistered from
 *                                   tools/list AND rejected at dispatch.
 *   SEEKSTONE_READ_PATHS=<glob,>  — comma-separated vault-relative globs;
 *                                   files outside them are invisible: never
 *                                   indexed or watched, and a direct read
 *                                   fails the same way a missing file does.
 *   SEEKSTONE_WRITE_PATHS=<glob,> — comma-separated vault-relative globs;
 *                                   writes are permitted only under matching
 *                                   paths (e.g. "journal/**,inbox/*.md").
 *
 * A path is writable only if it is also readable (SHA-291, decision D1), so
 * the write scope is the intersection of both glob sets; unset write paths
 * mean "everything readable". Read-only wins over both. Unset read paths =
 * the whole vault.
 *
 * Read scope is enforced in two places: the index build and watcher (excluded
 * files never enter the index) and `resolveVaultPath` (every tool that reads
 * a file by path goes through it). Write scope is enforced at dispatch and in
 * every write handler via `assertWritable`.
 */
export interface WritePolicy {
  readOnly: boolean;
  /** Vault-relative glob allowlist; undefined = all paths writable. */
  writeGlobs?: string[];
  /** Vault-relative glob allowlist; undefined = whole vault readable. */
  readGlobs?: string[];
}

/** Default policy for contexts built without env config (tests, benches). */
export const PERMISSIVE_POLICY: WritePolicy = { readOnly: false };

/**
 * Split a comma-separated glob list, keeping commas inside `{a,b}` brace
 * sets: "Encyclopedia/{A,B}/**,inbox/*.md" is two globs, not three.
 */
export function splitGlobs(raw: string | undefined): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of raw ?? '') {
    if (ch === '{') depth++;
    else if (ch === '}' && depth > 0) depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((g) => g.trim()).filter((g) => g.length > 0);
}

export function parseWritePolicy(env: Record<string, string | undefined>): WritePolicy {
  const ro = (env.SEEKSTONE_READ_ONLY ?? '').toLowerCase();
  const policy: WritePolicy = { readOnly: ro === '1' || ro === 'true' };
  const writeGlobs = splitGlobs(env.SEEKSTONE_WRITE_PATHS);
  if (writeGlobs.length > 0) policy.writeGlobs = writeGlobs;
  const readGlobs = splitGlobs(env.SEEKSTONE_READ_PATHS);
  if (readGlobs.length > 0) policy.readGlobs = readGlobs;
  return policy;
}

/** Normalize a vault-relative path for glob matching (Windows separators, ./). */
function normalizeRel(relPath: string): string {
  let p = relPath.replaceAll('\\', '/');
  while (p.startsWith('./')) p = p.slice(2);
  return p;
}

/**
 * Split a glob list into include and exclude patterns. A leading `!` makes a
 * glob an exclusion, so "**,!Journal/**" means "everything except Journal".
 * With only exclusions, the include set is everything. (picomatch alone would
 * OR the patterns, letting `notes/**` re-admit what `!notes/private/**`
 * removed; fast-glob, which walks the vault, treats `!` as an exclusion, and
 * both layers must agree.)
 */
export function splitGlobSet(globs: string[]): { include: string[]; exclude: string[] } {
  const include: string[] = [];
  const exclude: string[] = [];
  for (const g of globs) {
    if (g.startsWith('!')) {
      const rest = g.slice(1).trim();
      if (rest.length > 0) exclude.push(rest);
    } else {
      include.push(g);
    }
  }
  return { include: include.length > 0 ? include : ['**'], exclude };
}

/**
 * Compiled matchers, keyed by the glob array so each set compiles once per
 * process. Keying by the array (not the policy object) keeps policies plain,
 * comparable data while still paying picomatch's compile cost only once.
 */
const matchers = new WeakMap<string[], (p: string) => boolean>();

function matcherFor(globs: string[]): (p: string) => boolean {
  let m = matchers.get(globs);
  if (m === undefined) {
    const { include, exclude } = splitGlobSet(globs);
    // dot:true so notes under dot-folders still match `**` patterns.
    const inc = picomatch(include, { dot: true });
    const exc = exclude.length > 0 ? picomatch(exclude, { dot: true }) : undefined;
    m = exc ? (p: string) => inc(p) && !exc(p) : inc;
    matchers.set(globs, m);
  }
  return m;
}

/** True when `relPath` is inside the read scope (always true when unscoped). */
export function isReadable(policy: WritePolicy, relPath: string): boolean {
  if (!policy.readGlobs) return true;
  return matcherFor(policy.readGlobs)(normalizeRel(relPath));
}

export function isWritable(policy: WritePolicy, relPath: string): boolean {
  if (policy.readOnly) return false;
  if (!isReadable(policy, relPath)) return false;
  if (!policy.writeGlobs) return true;
  return matcherFor(policy.writeGlobs)(normalizeRel(relPath));
}

/**
 * Throw with an actionable message when the policy forbids writing `relPath`.
 * Call from write handlers with the final vault-relative path — after any
 * internal path computation (e.g. periodic-note date resolution) and before
 * the first disk read, so a refused write never reveals whether a file exists.
 */
export function assertWritable(policy: WritePolicy, relPath: string): void {
  if (policy.readOnly) {
    throw new Error('Server is read-only (SEEKSTONE_READ_ONLY=1); write tools are disabled.');
  }
  if (!isReadable(policy, relPath)) {
    throw new Error(
      `Write not permitted: "${relPath}" is outside SEEKSTONE_READ_PATHS (${policy.readGlobs?.join(', ')}).`,
    );
  }
  if (!isWritable(policy, relPath)) {
    throw new Error(
      `Write not permitted: "${relPath}" is outside SEEKSTONE_WRITE_PATHS (${policy.writeGlobs?.join(', ')}).`,
    );
  }
}

/**
 * The read scope as walker options, so the index build only descends into
 * readable folders. Undefined when unscoped (the walker's default).
 */
export function readScopeWalk(
  policy: WritePolicy,
): { include: string[]; exclude: string[] } | undefined {
  return policy.readGlobs ? splitGlobSet(policy.readGlobs) : undefined;
}
