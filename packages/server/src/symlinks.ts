import { lstatSync, realpathSync } from 'node:fs';
import { basename, dirname, join, sep } from 'node:path';

/**
 * Where a vault path really lands when reaching it crosses a symlink (SHA-575).
 *
 * The path checks (`containVaultPath`, the read and write scopes, the reserved
 * folders) compare the path as written. A symlink the user put inside the
 * vault can point anywhere, so the checks also need the real path whenever a
 * link is crossed.
 *
 * - `inside`: the real path is in the vault; `rel` is its forward-slash
 *   vault-relative form, ready for the glob and reserved-folder checks.
 * - `outside`: the real path is outside the vault.
 * - `broken`: a link on the way is dangling or loops.
 * - `unreadable`: resolving the link failed another way, such as a
 *   permission error on a folder it points into.
 */
export type LinkTarget =
  | { kind: 'inside'; rel: string }
  | { kind: 'outside' }
  | { kind: 'broken' }
  | { kind: 'unreadable'; code: string };

/**
 * The real path of each vault root, resolved once. A root that doesn't
 * resolve (missing, unreadable) falls back to the path itself, uncached.
 * The cache assumes a vault root doesn't move while the server runs: the
 * server is started for one vault path, and moving that folder (or
 * retargeting a link to it) needs a restart anyway, since the index and the
 * watcher hold the old location too.
 */
const realRoots = new Map<string, string>();

function realRoot(vaultRoot: string): string {
  let real = realRoots.get(vaultRoot);
  if (real === undefined) {
    try {
      real = realpathSync.native(vaultRoot);
    } catch {
      return vaultRoot;
    }
    realRoots.set(vaultRoot, real);
  }
  return real;
}

/**
 * Undefined when no path component below the vault root is a symlink, which
 * is the common case and costs one `lstat` per component. The vault root and
 * its ancestors are not checked: a vault that is itself reached through a
 * link (an iCloud or Dropbox alias, `/tmp` on macOS) is fine.
 *
 * `abs` must already be contained (`containVaultPath`). A component that is
 * missing ends the walk with undefined: the rest of the path doesn't exist,
 * so it can't hold a link.
 */
export function symlinkTarget(vaultRoot: string, abs: string): LinkTarget | undefined {
  if (abs.length <= vaultRoot.length + 1) return undefined;
  const segments = abs.slice(vaultRoot.length + 1).split(sep);
  let p = vaultRoot;
  for (const seg of segments) {
    p = p + sep + seg;
    let isLink: boolean;
    try {
      const st = lstatSync(p, { throwIfNoEntry: false });
      if (st === undefined) return undefined;
      isLink = st.isSymbolicLink();
    } catch {
      // ENOTDIR and the like: the path can't be opened, so the tool's own
      // read or write fails on it.
      return undefined;
    }
    if (isLink) return classify(vaultRoot, abs);
  }
  return undefined;
}

/** Slow path, taken only once a link was seen: resolve and compare real paths. */
function classify(vaultRoot: string, abs: string): LinkTarget {
  const real = realPathOfExisting(abs);
  if (real === BROKEN) return { kind: 'broken' };
  if (typeof real !== 'string') return { kind: 'unreadable', code: real.code };
  const root = realRoot(vaultRoot);
  if (real === root) return { kind: 'inside', rel: '' };
  if (!real.startsWith(root + sep)) return { kind: 'outside' };
  return {
    kind: 'inside',
    rel: real
      .slice(root.length + 1)
      .split(sep)
      .join('/'),
  };
}

const BROKEN = Symbol('broken');

/**
 * The real path of `abs`, or of its nearest existing ancestor with the
 * missing tail appended, so a new file is judged by the folder it would land
 * in. BROKEN when a missing component is itself a link (dangling) or a link
 * loops; the error code when resolving failed another way (EACCES, EPERM).
 */
function realPathOfExisting(abs: string): string | typeof BROKEN | { code: string } {
  const tail: string[] = [];
  let p = abs;
  for (;;) {
    try {
      const real = realpathSync.native(p);
      return tail.length === 0 ? real : join(real, ...tail.reverse());
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? 'UNKNOWN';
      if (code === 'ELOOP') return BROKEN;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') return { code };
      try {
        if (lstatSync(p, { throwIfNoEntry: false })?.isSymbolicLink()) return BROKEN;
      } catch {
        // ENOTDIR on the lstat too: keep climbing.
      }
      const parent = dirname(p);
      if (parent === p) return BROKEN;
      tail.push(basename(p));
      p = parent;
    }
  }
}

/**
 * realVaultTarget's answer for a link that leaves the vault when `follow` is
 * on. Vault-relative globs can't match such a path, so a read or write scope,
 * when one is set, refuses it.
 */
export const OUTSIDE_VAULT = Symbol('outside the vault');

/**
 * The guard both the read path (`resolveVaultPath`) and the write path
 * (`assertWritable`) call. Returns the real vault-relative path when a link
 * is crossed and the target is inside the vault, so the caller can run its
 * scope checks on it too; OUTSIDE_VAULT when `follow` is on and the target is
 * outside the vault; undefined when no link is crossed.
 *
 * @throws Error `Path outside vault: ...` when a link leads outside the vault
 *   and `follow` is off, or when a link is dangling or loops.
 */
export function realVaultTarget(
  vaultRoot: string,
  abs: string,
  inputPath: string,
  follow: boolean,
): string | typeof OUTSIDE_VAULT | undefined {
  const target = symlinkTarget(vaultRoot, abs);
  if (target === undefined) return undefined;
  if (target.kind === 'inside') return target.rel;
  if (target.kind === 'broken') {
    throw new Error(
      `Path outside vault: ${inputPath} goes through a symlink that is dangling or loops.`,
    );
  }
  if (target.kind === 'unreadable') {
    throw new Error(
      `Path not resolved: ${inputPath} goes through a symlink that can't be resolved (${target.code}).`,
    );
  }
  if (follow) return OUTSIDE_VAULT;
  throw new Error(
    `Path outside vault: ${inputPath} goes through a symlink to a location outside the vault. Set SEEKSTONE_FOLLOW_SYMLINKS=1 to allow it.`,
  );
}

/** Test hook: forget cached vault-root real paths. */
export function _resetRealRoots(): void {
  realRoots.clear();
}
