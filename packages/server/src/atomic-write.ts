import { rename, writeFile } from 'node:fs/promises';

/**
 * Crash-safe file write: write to a same-directory temp file, then rename
 * over the destination. A crash mid-write leaves either the old content or
 * the new content on disk — never a torn file. rename-over-existing works on
 * the full CI OS matrix (proven by patch_note's original implementation).
 *
 * Not a lock: two seekstone processes writing the same note share this temp
 * suffix and can race each other — same exposure as any two writers on one
 * file. CAS (content-hash.ts) is the conflict-detection layer above this.
 */
export async function atomicWrite(absPath: string, content: string): Promise<void> {
  const tmpPath = `${absPath}.seekstone-tmp`;
  await writeFile(tmpPath, content, 'utf8');
  await rename(tmpPath, absPath);
}
