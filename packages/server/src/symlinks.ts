import { lstatSync } from 'node:fs';
import { join, sep } from 'node:path';

/**
 * Seekstone doesn't follow symlinks below the vault root (SHA-575). This is
 * the only implementation of that check: reads, writes, index admission, the
 * watcher, the scoped boot walk and the journal all call it.
 *
 * Returns the first path component below `vaultRoot` that is a symlink (or a
 * Windows junction, which Node reports as one), as a vault-relative
 * forward-slash path, or undefined when no component is.
 *
 * - `abs` must be the lexically resolved absolute path the caller will use for
 *   I/O (the output of `containVaultPath`). `resolve` collapses `L/../x`, and
 *   the I/O uses that same collapsed path, so checking it is sound.
 * - The walk uses `lstat` one component at a time from the root down, the
 *   last component included. It never uses `access`, `stat` or `realpath`,
 *   which follow links.
 * - A missing component (ENOENT) or a file used as a folder (ENOTDIR) ends the
 *   walk with undefined: nothing below exists, so nothing below is a link.
 *   The caller's own I/O then fails as it would have.
 * - Any other error (EACCES, EPERM, ENAMETOOLONG, ELOOP) fails closed: the
 *   component is treated as a link.
 * - The vault root and its ancestors are never checked, so a vault that is
 *   itself reached through a link (an iCloud alias, `/tmp` on macOS) works.
 */
export function crossesLink(vaultRoot: string, abs: string): string | undefined {
  return findLink(vaultRoot, abs)?.at;
}

/**
 * The walk behind `crossesLink`, telling a real link (`error: false`) from
 * an `lstat` that failed (`error: true`). Reads and writes treat both as a
 * link (fail closed). The watcher purges only on a real link and ignores an
 * event whose `lstat` failed, so a transient error (a Windows delete-pending
 * EPERM, a folder without search permission) can't wipe an indexed subtree.
 */
export function findLink(
  vaultRoot: string,
  abs: string,
): { at: string; error: boolean } | undefined {
  const base = vaultRoot.endsWith(sep) ? vaultRoot : vaultRoot + sep;
  if (!abs.startsWith(base)) return undefined;
  const segments = abs
    .slice(base.length)
    .split(sep)
    .filter((s) => s !== '');
  let p = base.slice(0, -1);
  for (let i = 0; i < segments.length; i++) {
    p = p + sep + segments[i];
    const state = linkState(p);
    if (state === 'missing') return undefined;
    if (state !== 'other') {
      return { at: segments.slice(0, i + 1).join('/'), error: state === 'error' };
    }
  }
  return undefined;
}

/**
 * One `lstat`. `missing` for ENOENT and ENOTDIR (nothing below exists),
 * `link` for a symlink, `error` for any other failure.
 */
function linkState(p: string): 'link' | 'missing' | 'error' | 'other' {
  try {
    const st = lstatSync(p, { throwIfNoEntry: false });
    if (st === undefined) return 'missing';
    return st.isSymbolicLink() ? 'link' : 'other';
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return code === 'ENOENT' || code === 'ENOTDIR' ? 'missing' : 'error';
  }
}

/** linkState for the fail-closed callers: an error counts as a link. */
function isLinkOrError(p: string): boolean {
  const state = linkState(p);
  return state === 'link' || state === 'error';
}

/** The fixed ending of every "goes through a symlink" refusal (audit matches on it). */
export const SYMLINK_ENDING = "goes through a symlink, and Seekstone doesn't follow symlinks.";

/** Read refusal for a path that crosses a link. */
export function symlinkReadError(inputPath: string): Error {
  return new Error(`"${inputPath}" ${SYMLINK_ENDING}`);
}

/** Write refusal for a path that crosses a link. */
export function symlinkWriteError(relPath: string): Error {
  return new Error(`Write not permitted: "${relPath}" ${SYMLINK_ENDING}`);
}

/**
 * True when `message` is exactly one of the symlink refusals above. The read
 * and write shapes are matched in full (opening text, closing quote, fixed
 * ending), so another error that merely ends with the same words, such as
 * `Note not found: <path>` with a path chosen to end that way, doesn't match.
 */
export function isSymlinkRefusal(message: string): boolean {
  if (message === TRASH_LINK_MESSAGE || message === HISTORY_LINK_WRITE_MESSAGE) return true;
  const tail = `" ${SYMLINK_ENDING}`;
  if (!message.endsWith(tail)) return false;
  return message.startsWith('"') || message.startsWith('Write not permitted: "');
}

/** `delete_note` refusal when `.trash` is a link (fixed text, no path). */
export const TRASH_LINK_MESSAGE =
  "Delete not permitted: .trash/ is a symlink, and Seekstone doesn't follow symlinks. Pass permanent: true to delete without recovery.";

/** Write refusal when write history turns out to go through a link mid-session. */
export const HISTORY_LINK_WRITE_MESSAGE = `Write not permitted: write history (.seekstone/history) ${SYMLINK_ENDING}`;

/** Why write history is off for the session, when a link was found at boot. */
export const HISTORY_OFF_MESSAGE =
  'WRITE HISTORY IS OFF: .seekstone/history goes through a symlink. Writes work but cannot be undone. Make it a regular folder and restart.';

/**
 * True when any part of write history is a link: `.seekstone`,
 * `.seekstone/history`, `blobs/`, `manifest.jsonl` or `manifest.lock`. Five
 * `lstat`s. The lock is created with `wx` (O_EXCL), which fails on an existing
 * link, but a lock that already exists is opened for reading to see who holds
 * it, and that open would follow a link. Claim and temp files are only ever
 * created with `wx`, so they need no check.
 */
export function historyCrossesLink(vaultRoot: string): boolean {
  const seekstone = join(vaultRoot, '.seekstone');
  const history = join(seekstone, 'history');
  for (const p of [seekstone, history]) {
    const state = linkState(p);
    if (state === 'link' || state === 'error') return true;
    if (state === 'missing') return false;
  }
  return (
    isLinkOrError(join(history, 'blobs')) ||
    isLinkOrError(join(history, 'manifest.jsonl')) ||
    isLinkOrError(join(history, 'manifest.lock'))
  );
}

/** True when any segment of a forward-slash vault-relative path starts with a dot. */
export function hasDotSegment(relPath: string): boolean {
  if (relPath.startsWith('.')) return true;
  return relPath.includes('/.');
}

/**
 * Drop walk entries that sit under a symlinked folder. A scoped walk
 * (SEEKSTONE_READ_PATHS) needs this: fast-glob reads from the fixed base of
 * each include glob even when that folder is a link, so `Notes/**` with
 * `Notes` linked elsewhere returns the files behind it. File links are
 * already skipped by the walk. Each folder is `lstat`'d once per call.
 */
export function dropLinkedEntries<T extends { relPath: string }>(
  vaultRoot: string,
  entries: T[],
): T[] {
  const seen = new Map<string, boolean>();
  const linked = (folder: string): boolean => {
    if (folder === '') return false;
    let v = seen.get(folder);
    if (v !== undefined) return v;
    const slash = folder.lastIndexOf('/');
    v =
      linked(slash === -1 ? '' : folder.slice(0, slash)) || isLinkOrError(join(vaultRoot, folder));
    seen.set(folder, v);
    return v;
  };
  return entries.filter((e) => {
    const slash = e.relPath.lastIndexOf('/');
    return !linked(slash === -1 ? '' : e.relPath.slice(0, slash));
  });
}
