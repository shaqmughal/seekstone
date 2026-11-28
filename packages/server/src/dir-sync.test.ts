import { afterEach, describe, expect, it } from 'vitest';
import { setDirSyncEnabled, setDirSyncLog, syncDir } from './dir-sync.js';
import type { Logger } from './log.js';

afterEach(() => {
  setDirSyncEnabled(true);
  setDirSyncLog(undefined);
});

const fsError = (code: string) => Object.assign(new Error(code), { code });

describe('syncDir (SHA-652)', () => {
  it('does nothing while turned off', () => {
    const events: string[] = [];
    setDirSyncEnabled(false);
    syncDir('/vault', { platform: 'linux', openSync: () => events.push('open') });
    expect(events).toEqual([]);
  });

  it('logs a failed folder fsync at debug, once per folder, to the boot logger', () => {
    const debug: unknown[][] = [];
    const log = { debug: (...args: unknown[]) => debug.push(args) } as unknown as Logger;
    setDirSyncLog(log);
    const deps = {
      platform: 'darwin' as const,
      openSync: () => 7,
      fsyncSync: () => {
        throw fsError('EINVAL');
      },
      closeSync: () => {},
    };
    syncDir('/vault/a', deps);
    syncDir('/vault/a', deps);
    syncDir('/vault/b', deps);
    expect(debug).toEqual([
      [expect.stringContaining('folder fsync failed'), { dir: '/vault/a', code: 'EINVAL' }],
      [expect.stringContaining('folder fsync failed'), { dir: '/vault/b', code: 'EINVAL' }],
    ]);
  });

  it('ignores a close that throws after a good fsync', () => {
    const closeSync = () => {
      throw fsError('EBADF');
    };
    const deps = { platform: 'linux' as const, openSync: () => 7, fsyncSync: () => {}, closeSync };
    expect(() => syncDir('/vault/c', deps)).not.toThrow();
  });
});
