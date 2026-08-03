import picomatch from 'picomatch';

/**
 * Write policy — read-only mode and write-path scoping, parsed once at boot
 * and enforced at the dispatch layer (tool visibility + rejection) and inside
 * every write handler at the point the final vault-relative path is known
 * (`assertWritable`). Two env vars:
 *
 *   SEEKSTONE_READ_ONLY=1        — write tools are unregistered from
 *                                  tools/list AND rejected at dispatch.
 *   SEEKSTONE_WRITE_PATHS=<glob,>— comma-separated vault-relative globs;
 *                                  writes are permitted only under matching
 *                                  paths (e.g. "journal/**,inbox/*.md").
 *
 * Read-only wins over write paths. Unset write paths = everything writable.
 */
export interface WritePolicy {
  readOnly: boolean;
  /** Vault-relative glob allowlist; undefined = all paths writable. */
  writeGlobs?: string[];
}

/** Default policy for contexts built without env config (tests, benches). */
export const PERMISSIVE_POLICY: WritePolicy = { readOnly: false };

export function parseWritePolicy(env: Record<string, string | undefined>): WritePolicy {
  const ro = (env.SEEKSTONE_READ_ONLY ?? '').toLowerCase();
  const readOnly = ro === '1' || ro === 'true';
  const globs = (env.SEEKSTONE_WRITE_PATHS ?? '')
    .split(',')
    .map((g) => g.trim())
    .filter((g) => g.length > 0);
  return globs.length > 0 ? { readOnly, writeGlobs: globs } : { readOnly };
}

/** Normalize a vault-relative path for glob matching (Windows separators, ./). */
function normalizeRel(relPath: string): string {
  let p = relPath.replaceAll('\\', '/');
  while (p.startsWith('./')) p = p.slice(2);
  return p;
}

export function isWritable(policy: WritePolicy, relPath: string): boolean {
  if (policy.readOnly) return false;
  if (!policy.writeGlobs) return true;
  // dot:true so notes under dot-folders still match `**` patterns.
  return picomatch(policy.writeGlobs, { dot: true })(normalizeRel(relPath));
}

/**
 * Throw with an actionable message when the policy forbids writing `relPath`.
 * Call from write handlers with the final vault-relative path — after any
 * internal path computation (e.g. periodic-note date resolution).
 */
export function assertWritable(policy: WritePolicy, relPath: string): void {
  if (policy.readOnly) {
    throw new Error('Server is read-only (SEEKSTONE_READ_ONLY=1); write tools are disabled.');
  }
  if (!isWritable(policy, relPath)) {
    throw new Error(
      `Write not permitted: "${relPath}" is outside SEEKSTONE_WRITE_PATHS (${policy.writeGlobs?.join(', ')}).`,
    );
  }
}
