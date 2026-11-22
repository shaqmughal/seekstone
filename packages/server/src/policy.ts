import { posix, relative, resolve, sep } from 'node:path';
import picomatch from 'picomatch';
import { realVaultTarget } from './symlinks.js';

/**
 * Path policy: read-only mode, read- and write-path scoping and symlink
 * handling, parsed once at boot. Four env vars:
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
 *   SEEKSTONE_FOLLOW_SYMLINKS=1   — allow reads and writes through a symlink
 *                                   whose real target is outside the vault.
 *                                   Off by default: such a path is refused.
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
 *
 * Both checks also run on the real path when a path crosses a symlink and
 * lands inside the vault, so a link can't route around a scope or into a
 * reserved folder (SHA-575).
 */
export interface WritePolicy {
  readOnly: boolean;
  /** Vault-relative glob allowlist; undefined = all paths writable. */
  writeGlobs?: string[];
  /** Vault-relative glob allowlist; undefined = whole vault readable. */
  readGlobs?: string[];
  /** SEEKSTONE_FOLLOW_SYMLINKS: allow symlinks whose real target is outside the vault. */
  followSymlinks?: boolean;
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
  const follow = (env.SEEKSTONE_FOLLOW_SYMLINKS ?? '').toLowerCase();
  if (follow === '1' || follow === 'true') policy.followSymlinks = true;
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
 * Top-level folders no write tool may touch: the write journal lives in
 * `.seekstone/history/` and `delete_note` moves notes into `.trash/`. Letting
 * an agent write there would let it overwrite or delete its own undo history.
 */
const RESERVED_FOLDERS = ['.seekstone', '.trash'] as const;
export type ReservedFolder = (typeof RESERVED_FOLDERS)[number];

/**
 * The reserved folder `inputPath` falls inside, or undefined. The path is
 * normalized the way `containVaultPath` resolves it, so `notes/../.trash/x`
 * counts. With `vaultRoot`, absolute paths inside the vault are caught too.
 * The comparison ignores case, and trailing dots and spaces that Windows
 * drops from a folder name, because Windows and default macOS file systems
 * would put `.Trash./x` in the same folder as `.trash/x`. The check is on the
 * path as written; `assertWritable` repeats it on the real path when the path
 * crosses a symlink.
 */
export function reservedFolder(inputPath: string, vaultRoot?: string): ReservedFolder | undefined {
  // Every write goes through here. Normalizing can only drop segments, never
  // create a name, so a path that doesn't mention either folder can't be in
  // one; skipping the path work keeps the common case at a string scan.
  const lower = inputPath.toLowerCase();
  if (!lower.includes('.seekstone') && !lower.includes('.trash')) return undefined;
  const rel =
    vaultRoot === undefined
      ? posix.normalize(inputPath.replaceAll('\\', '/'))
      : relative(vaultRoot, resolve(vaultRoot, inputPath));
  // Drop an NTFS stream suffix too: on Windows `.trash::$INDEX_ALLOCATION`
  // names the `.trash` directory itself.
  const first = (rel.split(/[\\/]/, 1)[0] ?? '')
    .replace(/:.*$/, '')
    .toLowerCase()
    .replace(/[. ]+$/, '');
  return RESERVED_FOLDERS.find((f) => f === first);
}

/**
 * Throw with an actionable message when the policy forbids writing `relPath`.
 * Call from write handlers with the final vault-relative path — after any
 * internal path computation (e.g. periodic-note date resolution) and before
 * the first disk read, so a refused write never reveals whether a file exists.
 * Pass `vaultRoot` so an absolute path into a reserved folder is refused too.
 * `allow` exempts one reserved folder: `move_note` passes `.trash` for its
 * source, because moving a trashed note back out is how it is restored, and
 * `undo_write` passes it for the journal entry's paths, which come from
 * Seekstone's own history rather than the caller.
 */
export function assertWritable(
  policy: WritePolicy,
  relPath: string,
  vaultRoot?: string,
  allow?: ReservedFolder,
): void {
  if (policy.readOnly) {
    throw new Error('Server is read-only (SEEKSTONE_READ_ONLY=1); write tools are disabled.');
  }
  assertInScope(policy, relPath, `"${relPath}"`, vaultRoot, allow);
  if (vaultRoot === undefined) return;
  // Through a symlink, the real path must be in the vault (unless
  // SEEKSTONE_FOLLOW_SYMLINKS is on) and pass the same checks (SHA-575). A
  // path that escapes as written is left to containVaultPath's error. No
  // `allow` here: a link into a reserved folder is refused in every case.
  const abs = resolve(vaultRoot, relPath);
  if (!abs.startsWith(vaultRoot + sep)) return;
  const real = realVaultTarget(vaultRoot, abs, relPath, policy.followSymlinks === true);
  if (real !== undefined) {
    assertInScope(
      policy,
      real,
      // The real path isn't named: it may be in a folder the read scope hides.
      `"${relPath}" goes through a symlink to a path that`,
      undefined,
      undefined,
    );
  }
}

/**
 * True when `assertWritable` would let `relPath` be written. For paths a
 * tool picks itself (the notes a move or heading rename rewrites), which it
 * skips and reports instead of failing the whole call.
 */
export function canWrite(policy: WritePolicy, relPath: string, vaultRoot: string): boolean {
  try {
    assertWritable(policy, relPath, vaultRoot);
    return true;
  } catch {
    return false;
  }
}

/** The scope and reserved-folder checks; `label` names the path in the message. */
function assertInScope(
  policy: WritePolicy,
  relPath: string,
  label: string,
  vaultRoot: string | undefined,
  allow: ReservedFolder | undefined,
): void {
  if (!isReadable(policy, relPath)) {
    throw new Error(
      `Write not permitted: ${label} is outside SEEKSTONE_READ_PATHS (${policy.readGlobs?.join(', ')}).`,
    );
  }
  if (!isWritable(policy, relPath)) {
    throw new Error(
      `Write not permitted: ${label} is outside SEEKSTONE_WRITE_PATHS (${policy.writeGlobs?.join(', ')}).`,
    );
  }
  const reserved = reservedFolder(relPath, vaultRoot);
  if (reserved !== undefined && reserved !== allow) {
    throw new Error(
      `Write not permitted: ${label} is inside ${reserved}/, which Seekstone reserves for write history and deleted notes.`,
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
