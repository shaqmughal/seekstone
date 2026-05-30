import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from './log.js';

// Fixed clock so emitted lines are deterministic.
const NOW = new Date('2026-05-30T00:00:00.000Z');
const now = (): Date => NOW;

function sink() {
  const lines: string[] = [];
  return { write: (s: string): void => void lines.push(s), lines };
}

describe('createLogger', () => {
  it('defaults to info level — info emits, debug is suppressed', () => {
    const s = sink();
    const log = createLogger({ env: {}, stderr: s.write, now });
    expect(log.level).toBe('info');
    log.info('hello');
    log.debug('quiet');
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]).toContain('INFO ');
    expect(s.lines[0]).toContain('hello');
  });

  it('honors SEEKSTONE_LOG_LEVEL=debug', () => {
    const s = sink();
    const log = createLogger({ env: { SEEKSTONE_LOG_LEVEL: 'debug' }, stderr: s.write, now });
    expect(log.level).toBe('debug');
    log.debug('verbose');
    expect(s.lines.some((l) => l.includes('DEBUG') && l.includes('verbose'))).toBe(true);
  });

  it('error level suppresses warn/info/debug', () => {
    const s = sink();
    const log = createLogger({ env: { SEEKSTONE_LOG_LEVEL: 'error' }, stderr: s.write, now });
    log.warn('w');
    log.info('i');
    log.debug('d');
    log.error('e');
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]).toContain('ERROR');
  });

  it('falls back to info on an invalid level and warns', () => {
    const s = sink();
    const log = createLogger({ env: { SEEKSTONE_LOG_LEVEL: 'loud' }, stderr: s.write, now });
    expect(log.level).toBe('info');
    expect(s.lines.some((l) => l.includes('invalid SEEKSTONE_LOG_LEVEL'))).toBe(true);
  });

  it('formats structured fields as key=value', () => {
    const s = sink();
    const log = createLogger({ env: {}, stderr: s.write, now });
    log.info('tool ok', { tool: 'search', durationMs: 3, resultBytes: 120 });
    expect(s.lines[0]).toContain('tool=search');
    expect(s.lines[0]).toContain('durationMs=3');
    expect(s.lines[0]).toContain('resultBytes=120');
  });

  it('NEVER writes to stdout — only stderr', () => {
    const outSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const errSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    try {
      // No injected stderr → exercises the real default sink.
      const log = createLogger({ env: { SEEKSTONE_LOG_LEVEL: 'debug' }, now });
      log.error('e');
      log.warn('w');
      log.info('i');
      log.debug('d');
      expect(outSpy).not.toHaveBeenCalled();
      expect(errSpy).toHaveBeenCalled();
    } finally {
      outSpy.mockRestore();
      errSpy.mockRestore();
    }
  });
});

describe('createLogger file sink', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'seekstone-log-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('appends JSON lines to SEEKSTONE_LOG_FILE', async () => {
    const file = join(dir, 'seekstone.log');
    const log = createLogger({ env: { SEEKSTONE_LOG_FILE: file }, stderr: () => {}, now });
    log.info('tool ok', { tool: 'search', durationMs: 2 });
    log.error('tool error', { tool: 'read_note' });
    const lines = (await readFile(file, 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0] ?? '{}');
    expect(first).toMatchObject({ level: 'info', msg: 'tool ok', tool: 'search', durationMs: 2 });
    expect(first.t).toBe(NOW.toISOString());
    expect(JSON.parse(lines[1] ?? '{}')).toMatchObject({ level: 'error', tool: 'read_note' });
  });

  it('rotates the file once it exceeds the max size', async () => {
    const file = join(dir, 'seekstone.log');
    const log = createLogger({
      env: { SEEKSTONE_LOG_FILE: file, SEEKSTONE_LOG_MAX_SIZE: '200b' },
      stderr: () => {},
      now,
    });
    for (let i = 0; i < 20; i++) log.info('line', { i, pad: 'xxxxxxxxxxxxxxxxxxxx' });
    const rotated = await readFile(`${file}.1`, 'utf8').then(
      () => true,
      () => false,
    );
    expect(rotated).toBe(true);
  });

  it('degrades gracefully when the log file is unwritable', () => {
    const s = sink();
    const bad = join(dir, 'no-such-dir', 'x.log');
    const log = createLogger({ env: { SEEKSTONE_LOG_FILE: bad }, stderr: s.write, now });
    // Warns about the file, then keeps logging to stderr without throwing.
    expect(s.lines.some((l) => l.includes('cannot write log file'))).toBe(true);
    expect(() => log.info('still works')).not.toThrow();
    expect(s.lines.some((l) => l.includes('still works'))).toBe(true);
  });
});
