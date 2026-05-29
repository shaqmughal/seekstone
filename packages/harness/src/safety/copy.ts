import { cp, mkdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export interface CopyResult {
  /** Absolute, real path of the safety copy. */
  copyRoot: string;
  /** Absolute, real path of the original (for the guard check). */
  originalRoot: string;
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
  const destAbs = resolve(tmpdir(), label);

  if (destAbs === srcAbs) {
    throw new Error(`Refusing to copy: destination equals source (${srcAbs}).`);
  }
  if (destAbs.startsWith(`${srcAbs}/`)) {
    throw new Error(`Refusing to copy: destination is inside source.`);
  }

  await mkdir(destAbs, { recursive: true });
  await cp(srcAbs, destAbs, {
    recursive: true,
    force: true,
    preserveTimestamps: true,
    // Skip the giant .obsidian/.git/.trash dirs — write-safety tests don't need them
    // and copying them blows the scratch budget on big vaults.
    filter: (src) => {
      const rel = src.slice(srcAbs.length);
      if (rel.includes('/.obsidian/') || rel.endsWith('/.obsidian')) return false;
      if (rel.includes('/.trash/') || rel.endsWith('/.trash')) return false;
      if (rel.includes('/.git/') || rel.endsWith('/.git')) return false;
      return true;
    },
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
