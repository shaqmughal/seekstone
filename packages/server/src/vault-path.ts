import { access } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { isReadable, type WritePolicy } from './policy.js';
import { realVaultTarget } from './symlinks.js';

/**
 * Resolve a vault-relative path to an absolute path, guaranteeing the result
 * stays inside the vault. The previous inline `join(...).startsWith(vaultRoot)`
 * checks had no separator boundary, so with a vault at `/home/u/vault` the
 * input `../vault-backup/x.md` resolved to `/home/u/vault-backup/x.md` and
 * passed.
 *
 * `resolve` (not `join`) also normalizes an absolute `input` instead of
 * concatenating it, so absolute-path inputs are contained too.
 *
 * The check is on the path as written; `resolveVaultPath` adds the symlink
 * check. Containment only — no read-scope check. Use it directly only where the
 * caller never reads the file and answers from the index (get_links,
 * get_backlinks), which is scoped at build time. Everything that touches
 * disk goes through `resolveVaultPath`.
 *
 * @throws Error `Path outside vault: <input>` when the resolved path escapes.
 */
export function containVaultPath(vaultRoot: string, inputPath: string): string {
  const abs = resolve(vaultRoot, inputPath);
  if (abs !== vaultRoot && !abs.startsWith(vaultRoot + sep)) {
    throw new Error(`Path outside vault: ${inputPath}`);
  }
  return abs;
}

/**
 * The single containment-and-read-scope guard for every tool handler that
 * reads or writes a vault file by path. On top of `containVaultPath`, a path
 * outside SEEKSTONE_READ_PATHS fails exactly as a missing file would: an
 * ENOENT error with the message `fs.readFile` produces, so a caller can't
 * tell an excluded note from a nonexistent one (SHA-291). When the path
 * crosses a symlink, its real path must stay in the vault (unless
 * SEEKSTONE_FOLLOW_SYMLINKS=1) and in the read scope (SHA-575).
 *
 * @throws Error `Path outside vault: <input>` when the resolved path escapes,
 *   lexically or through a symlink.
 * @throws ENOENT-shaped Error when the path is outside the read scope.
 */
export function resolveVaultPath(
  ctx: { vaultRoot: string; policy: WritePolicy },
  inputPath: string,
): string {
  const abs = containVaultPath(ctx.vaultRoot, inputPath);
  if (ctx.policy.readGlobs && !isReadable(ctx.policy, vaultRelative(ctx.vaultRoot, abs))) {
    throw notFoundError(abs);
  }
  // Through a symlink, the real path must be in the vault (unless
  // SEEKSTONE_FOLLOW_SYMLINKS is on) and inside the read scope too (SHA-575).
  const real = realVaultTarget(ctx.vaultRoot, abs, inputPath, ctx.policy.followSymlinks === true);
  if (real !== undefined && ctx.policy.readGlobs && !isReadable(ctx.policy, real)) {
    throw notFoundError(abs);
  }
  return abs;
}

/**
 * True when `inputPath` exists and the read path would let a tool open it.
 * A path the read scope hides, or one behind a symlink `resolveVaultPath`
 * refuses, reports false, like a missing file.
 */
export async function existsReadable(
  ctx: { vaultRoot: string; policy: WritePolicy },
  inputPath: string,
): Promise<boolean> {
  try {
    await access(resolveVaultPath(ctx, inputPath));
    return true;
  } catch {
    return false;
  }
}

/** Forward-slash vault-relative key, the same shape walkVault produces. */
function vaultRelative(vaultRoot: string, abs: string): string {
  return relative(vaultRoot, abs).split(sep).join('/');
}

/** Mirror the error fs.readFile raises for a missing file (all platforms use this text). */
export function notFoundError(absPath: string): NodeJS.ErrnoException {
  const err: NodeJS.ErrnoException = new Error(
    `ENOENT: no such file or directory, open '${absPath}'`,
  );
  err.code = 'ENOENT';
  err.syscall = 'open';
  err.path = absPath;
  return err;
}
