import { closeSync, fsyncSync, openSync } from 'node:fs';
import type { Logger } from './log.js';

/** Test seams for `syncDir`. Production callers pass nothing. */
export interface DirSyncDeps {
  platform?: NodeJS.Platform;
  openSync?: (path: string, flags: string) => number;
  fsyncSync?: (fd: number) => void;
  closeSync?: (fd: number) => void;
  log?: Logger;
}

let enabled = true;
let moduleLog: Logger | undefined;
/** Folders whose fsync failed and has been logged, so each is logged once. */
const loggedDirs = new Set<string>();

/** The logger `syncDir` reports failures to. Set once at boot. */
export function setDirSyncLog(log: Logger | undefined): void {
  moduleLog = log;
}

/**
 * Turns the folder fsync off or on for the whole process. Only the timing
 * script (`scripts/bench-dir-fsync.mjs`) calls this, to measure the cost.
 */
export function setDirSyncEnabled(on: boolean): void {
  enabled = on;
}

/**
 * fsync a folder, so a rename into it survives a power cut (SHA-652). Call
 * it after the rename. Skipped on Windows, where a folder can't be opened
 * for fsync and rename durability is up to the file system.
 *
 * A failure (EINVAL on a file system that doesn't support it, say) is not
 * thrown: the rename already happened, so the write did too. It is logged
 * at debug, once per folder.
 */
export function syncDir(dir: string, deps: DirSyncDeps = {}): void {
  if (!enabled || (deps.platform ?? process.platform) === 'win32') return;
  const close = deps.closeSync ?? closeSync;
  let fd: number | undefined;
  try {
    fd = (deps.openSync ?? openSync)(dir, 'r');
    (deps.fsyncSync ?? fsyncSync)(fd);
  } catch (err) {
    if (!loggedDirs.has(dir)) {
      loggedDirs.add(dir);
      const code = (err as NodeJS.ErrnoException).code;
      (deps.log ?? moduleLog)?.debug('folder fsync failed; a power cut may undo renames', {
        dir,
        code,
      });
    }
  } finally {
    if (fd !== undefined) {
      try {
        close(fd);
      } catch {
        // Nothing to do: the fd is gone either way.
      }
    }
  }
}
