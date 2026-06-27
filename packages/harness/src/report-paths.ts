import os from 'node:os';
import { isAbsolute, relative, sep } from 'node:path';

/**
 * Render a filesystem path for inclusion in a committed report so it carries no
 * machine-local detail (the local username, a per-run macOS tmpdir hash, …).
 *
 * Reports are checked in (`fixtures/baseline-reports/`) and must be the same
 * regardless of whose machine produced them. Three cases, in order:
 *
 *   1. Inside the repo (cwd) → a repo-relative POSIX path
 *      (`/Users/x/code/seekstone/packages/.../vault` → `packages/.../vault`).
 *   2. Inside the OS temp dir → `<tmpdir>/<name>` (drops the `/private/var/folders/<hash>`
 *      prefix that `mkdtemp` produces).
 *   3. Anywhere else under $HOME → `<home>/…` so a personal-vault path never
 *      leaks a username.
 *
 * Anything that matches none of these is returned unchanged.
 *
 * `cwd` / `tmpdir` / `home` are injectable so the behaviour is deterministic in
 * tests; in production they default to the live process values.
 */
export interface NormalizeReportPathOptions {
  cwd?: string;
  tmpdir?: string;
  home?: string;
}

const toPosix = (p: string): string => (sep === '/' ? p : p.split(sep).join('/'));

// macOS: `/var`, `/tmp`, `/etc` are symlinks under `/private`. `os.tmpdir()`
// returns the `/var/...` form while `mkdtemp`/`realpath` yield `/private/var/...`,
// so a naive prefix check misses. Strip the leading `/private` on both sides.
const stripPrivate = (p: string): string =>
  p.startsWith('/private/') ? p.slice('/private'.length) : p;

function under(child: string, parent: string): string | null {
  if (!parent) return null;
  const c = stripPrivate(child);
  const p = stripPrivate(parent);
  if (c === p) return '';
  if (c.startsWith(`${p}/`)) return c.slice(p.length + 1);
  return null;
}

export function normalizeReportPath(p: string, opts: NormalizeReportPathOptions = {}): string {
  const cwd = opts.cwd ?? process.cwd();
  const tmp = opts.tmpdir ?? os.tmpdir();
  const home = opts.home ?? os.homedir();

  // 1) Inside the repo → repo-relative.
  const rel = relative(cwd, p);
  if (rel && !rel.startsWith('..') && !isAbsolute(rel)) {
    return toPosix(rel);
  }

  // 2) Inside the OS temp dir → <tmpdir>/<name>.
  const inTmp = under(p, tmp);
  if (inTmp !== null) return inTmp ? `<tmpdir>/${toPosix(inTmp)}` : '<tmpdir>';

  // 3) Elsewhere under $HOME → <home>/… (never leak the username).
  const inHome = under(p, home);
  if (inHome !== null) return inHome ? `<home>/${toPosix(inHome)}` : '<home>';

  return p;
}
