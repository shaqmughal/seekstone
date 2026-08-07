import { resolve, sep } from 'node:path';

/**
 * Resolve a vault-relative path to an absolute path, guaranteeing the result
 * stays inside the vault. This is the single containment guard for every tool
 * handler — the previous inline `join(...).startsWith(vaultRoot)` checks had
 * no separator boundary, so with a vault at `/home/u/vault` the input
 * `../vault-backup/x.md` resolved to `/home/u/vault-backup/x.md` and passed.
 *
 * `resolve` (not `join`) also normalizes an absolute `input` instead of
 * concatenating it, so absolute-path inputs are contained too.
 *
 * @throws Error `Path outside vault: <input>` when the resolved path escapes.
 */
export function resolveVaultPath(vaultRoot: string, inputPath: string): string {
  const abs = resolve(vaultRoot, inputPath);
  if (abs !== vaultRoot && !abs.startsWith(vaultRoot + sep)) {
    throw new Error(`Path outside vault: ${inputPath}`);
  }
  return abs;
}
