import { cp, mkdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

export interface CopyResult {
  /** Absolute, real path of the safety copy. */
  copyRoot: string;
  /** Absolute, real path of the original (for the guard check). */
  originalRoot: string;
}

/**
 * Vault-relative paths skipped when copying a scratch vault: the big
 * .obsidian / .git / .trash dirs that write-safety tests don't need and that
 * would blow the scratch budget on large vaults.
 *
 * Separator-agnostic: fs.cp passes native paths (backslashes on Windows), so
 * we normalise before matching — otherwise these exclusions silently never
 * fire on Windows.
 */
export function isCopyExcluded(rel: string): boolean {
  const norm = rel.replaceAll('\\', '/');
  for (const dir of ['.obsidian', '.trash', '.git']) {
    if (norm.includes(`/${dir}/`) || norm.endsWith(`/${dir}`)) return true;
  }
  return false;
}

/**
 * Copy a vault to an isolated scratch directory. Hard refuses if:
 *   - the destination resolves to the same path as the source
 *   - the destination resolves to a subdirectory of the source
 *
 * This is the one place in the harness that can mutate a vault, so the
 * guards are intentionally paranoid. Add a third layer of protection at
 * call sites by also enforcing the destination is under tmpdir().
 */
export async function copyVault(
  srcRoot: string,
  opts: { label?: string } = {},
): Promise<CopyResult> {
  const srcAbs = await realpath(resolve(srcRoot));
  const label = opts.label ?? `seekstone-safety-${Date.now()}`;
  // realpath the tmpdir base so destAbs is the same (long) form as srcAbs.
  // On Windows, os.tmpdir() can return an 8.3 short path (e.g. RUNNER~1);
  // leaving it unresolved makes the dest==src / inside-source guards compare
  // mismatched path forms (so they never fire) and feeds fs.cp a short path it
  // intermittently mis-resolves into a spurious ENOENT. Same root cause as the
  // watcher fix in SHA-144; see SHA-152.
  const destAbs = resolve(await realpath(tmpdir()), label);

  if (destAbs === srcAbs) {
    throw new Error(`Refusing to copy: destination equals source (${srcAbs}).`);
  }
  if (destAbs.startsWith(`${srcAbs}${sep}`)) {
    throw new Error(`Refusing to copy: destination is inside source.`);
  }

  await mkdir(destAbs, { recursive: true });
  await cp(srcAbs, destAbs, {
    recursive: true,
    // force defaults to true, which makes fs.cp unlink-before-overwrite — a
    // step that intermittently throws a spurious ENOENT on Windows. The dest is
    // a freshly created, uniquely-labelled empty dir, so there is nothing to
    // overwrite and force buys us nothing.
    force: false,
    preserveTimestamps: true,
    filter: (src) => !isCopyExcluded(src.slice(srcAbs.length)),
  });

  return {
    copyRoot: await realpath(destAbs),
    originalRoot: srcAbs,
  };
}

/** Build a safety scratch path under tmpdir() without copying yet — handy for tests. */
export function scratchPath(label: string): string {
  return join(tmpdir(), label);
}
