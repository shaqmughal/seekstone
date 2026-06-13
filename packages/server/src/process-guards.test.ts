import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from './log.js';
import { installProcessGuards } from './process-guards.js';

type CapturedError = { msg: string; fields?: Record<string, unknown> };

function fakeLogger(): Logger & { errors: CapturedError[] } {
  const errors: CapturedError[] = [];
  return {
    errors,
    level: 'debug',
    error: (msg, fields) => void errors.push({ msg, fields }),
    warn: () => {},
    info: () => {},
    debug: () => {},
  };
}

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
});

describe('installProcessGuards', () => {
  it('logs an unhandledRejection via the logger and keeps the process alive', () => {
    const log = fakeLogger();
    const exit = vi.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('process.exit should not be called');
    }) as never);

    dispose = installProcessGuards(log);
    process.emit('unhandledRejection', new Error('boom'), Promise.resolve());

    expect(log.errors).toHaveLength(1);
    expect(log.errors[0]?.fields).toMatchObject({ error: 'boom' });
    expect(exit).not.toHaveBeenCalled();
    exit.mockRestore();
  });

  it('stringifies non-Error rejection reasons', () => {
    const log = fakeLogger();
    dispose = installProcessGuards(log);

    process.emit('unhandledRejection', 'plain string reason', Promise.resolve());

    expect(log.errors[0]?.fields).toMatchObject({ error: 'plain string reason' });
  });

  it('disposer removes the listener', () => {
    const log = fakeLogger();
    const before = process.listenerCount('unhandledRejection');
    const off = installProcessGuards(log);
    expect(process.listenerCount('unhandledRejection')).toBe(before + 1);
    off();
    expect(process.listenerCount('unhandledRejection')).toBe(before);
  });
});
