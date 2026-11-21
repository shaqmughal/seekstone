import { type FileHandle, open, rename, rm } from 'node:fs/promises';

/** Test seams for `atomicWrite`. Production callers pass nothing. */
export interface AtomicWriteDeps {
  openFn?: (path: string, flags: string) => Promise<FileHandle>;
  renameFn?: RenameRetryDeps['renameFn'];
}

/**
 * Crash-safe file write: write a same-directory temp file, fsync it, close
 * it, then rename it over the destination (the same shape as the journal's
 * `writeDurable`). The fsync means the new data is on disk before the rename
 * can be, so a crash or power loss leaves the old content or the new content,
 * never an empty or partial note (SHA-561).
 *
 * Not guaranteed: the rename itself surviving a power loss. The directory is
 * not fsynced, so after a crash the note may still hold its old content. A
 * directory fsync costs real time on some file systems and is left out on
 * purpose. rename-over-existing works on the full CI OS matrix.
 *
 * Not a lock: two seekstone processes writing the same note share this temp
 * suffix and can race each other — same exposure as any two writers on one
 * file. CAS (content-hash.ts) is the conflict-detection layer above this.
 */
export async function atomicWrite(
  absPath: string,
  content: string,
  { openFn = open, renameFn }: AtomicWriteDeps = {},
): Promise<void> {
  const tmpPath = `${absPath}.seekstone-tmp`;
  try {
    const fh = await openFn(tmpPath, 'w');
    try {
      await fh.writeFile(content, 'utf8');
      await fh.sync();
    } finally {
      await fh.close();
    }
    await renameWithRetry(tmpPath, absPath, { renameFn });
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
