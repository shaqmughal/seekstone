import { rename, rm, writeFile } from 'node:fs/promises';

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
  try {
    await renameWithRetry(tmpPath, absPath);
  } catch (err) {
    // Don't leave the temp file in the vault when the write finally fails.
    await rm(tmpPath, { force: true }).catch(() => {});
    throw err;
  }
}

/**
 * Error codes Windows returns while another process (antivirus, a sync
 * client, an indexer, Obsidian) briefly holds the destination open without
 * delete-sharing. They clear on their own within milliseconds (SHA-531).
 */
const TRANSIENT_WINDOWS_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);

/** Backoff before each retry, in ms; ~1.3 s worst case in total. */
const RETRY_DELAYS_MS = [10, 20, 40, 80, 160, 320, 640];

export interface RenameRetryDeps {
  platform?: NodeJS.Platform;
  renameFn?: (from: string, to: string) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * `rename`, retried with short backoff on Windows when the destination is
 * transiently locked. Anything else (other platforms, other error codes, or
 * a lock that outlasts the backoff) throws the original error unchanged.
 * The happy path is a single rename with no added work.
 */
export async function renameWithRetry(
  from: string,
  to: string,
  {
    platform = process.platform,
    renameFn = rename,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  }: RenameRetryDeps = {},
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await renameFn(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? '';
      const delay = RETRY_DELAYS_MS[attempt];
      if (platform !== 'win32' || !TRANSIENT_WINDOWS_CODES.has(code) || delay === undefined) {
        throw err;
      }
      await sleep(delay);
    }
  }
}
