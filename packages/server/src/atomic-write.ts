import { randomBytes } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
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
 * Every call gets its own temp file (`tempPathFor`), opened with `wx` so it
 * can only be a file this call created. Cleanup after a failure only ever
 * removes that file, and two writers on one note never touch each other's
 * temp file (SHA-567). They still race on the final rename, and the last one
 * wins. CAS (content-hash.ts) is the conflict-detection layer above this.
 *
 * A destination that is itself a symlink is written through: the temp file
 * goes next to the link's target and replaces the target, so the link stays
 * a link and the file it points to gets the new bytes (SHA-575). That is the
 * file the path checks approved. Renaming over the link instead would turn
 * it into a regular file and leave the target as it was.
 *
 * Not guaranteed: the rename itself surviving a power loss. The directory is
 * not fsynced, so after a crash the note may still hold its old content. A
 * directory fsync costs real time on some file systems and is left out on
 * purpose. rename-over-existing works on the full CI OS matrix.
 */
export async function atomicWrite(
  absPath: string,
  content: string,
  { openFn = open, renameFn }: AtomicWriteDeps = {},
): Promise<void> {
  const dest = lstatSync(absPath, { throwIfNoEntry: false })?.isSymbolicLink()
    ? realpathSync.native(absPath)
    : absPath;
  const tmpPath = tempPathFor(dest);
  // A failed open created nothing, so it has nothing to clean up.
  const fh = await openFn(tmpPath, 'wx');
  try {
    try {
      await fh.writeFile(content, 'utf8');
      await fh.sync();
    } finally {
      await fh.close();
    }
    await renameWithRetry(tmpPath, dest, { renameFn });
  } catch (err) {
    // Don't leave the temp file in the vault when the write finally fails.
    await rm(tmpPath, { force: true }).catch(() => {});
    throw err;
  }
}

/** Longest file name, in bytes, that ext4, APFS and NTFS all accept. */
const MAX_NAME_BYTES = 255;

/**
 * Differs between processes. The random part covers two machines writing to
 * one synced or network vault, where pids can repeat.
 */
const PROCESS_TAG = `${process.pid.toString(36)}${randomBytes(4).toString('hex')}`;
let tempSeq = 0;
const IS_WINDOWS = process.platform === 'win32';

/**
 * A temp path next to `absPath` that no other call, in this process or
 * another, will use: `.<note name>.<process tag><counter>.seekstone-tmp`.
 * It sits in the note's directory so the rename stays atomic. A crash can
 * leave one behind, and the name keeps it out of everything that reads the
 * vault: Obsidian and the watcher skip dot-prefixed names, and the walker
 * classifies the `.seekstone-tmp` extension as a non-note. A long note name is
 * shortened so the whole name fits in 255 bytes.
 */
function tempPathFor(absPath: string): string {
  // String slicing rather than node:path: this runs on every write, and
  // dirname/basename/join cost ~10x more for the same result.
  const cut = Math.max(absPath.lastIndexOf('/'), IS_WINDOWS ? absPath.lastIndexOf('\\') : -1) + 1;
  const suffix = `.${PROCESS_TAG}${(tempSeq++).toString(36)}.seekstone-tmp`;
  const budget = MAX_NAME_BYTES - 1 - suffix.length;
  let name = absPath.slice(cut);
  // A UTF-16 code unit is at most 3 UTF-8 bytes, so short names skip the byte count.
  if (name.length * 3 > budget && Buffer.byteLength(name) > budget) {
    // Drop whole code points so the name stays valid UTF-8.
    const chars = Array.from(name);
    while (Buffer.byteLength(name) > budget) {
      chars.pop();
      name = chars.join('');
    }
  }
  return `${absPath.slice(0, cut)}.${name}${suffix}`;
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
