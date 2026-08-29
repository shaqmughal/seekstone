import { chmod, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuditLog, type AuditRecord, classifyError, resolveAuditConfig } from './audit.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'seekstone-audit-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const rec = (over: Partial<AuditRecord> = {}): AuditRecord => ({
  v: 1,
  ts: '2026-08-29T00:00:00.000Z',
  tool: 'append_note',
  outcome: 'ok',
  durationMs: 1,
  ...over,
});

describe('resolveAuditConfig', () => {
  it('is off unless SEEKSTONE_AUDIT_FILE is set (blank counts as unset)', () => {
    expect(resolveAuditConfig({})).toBeUndefined();
    expect(resolveAuditConfig({ SEEKSTONE_AUDIT_FILE: '  ' })).toBeUndefined();
  });
  it('defaults to 10 MB and parses SEEKSTONE_AUDIT_MAX_SIZE', () => {
    expect(resolveAuditConfig({ SEEKSTONE_AUDIT_FILE: '/x/a.jsonl' })).toEqual({
      path: '/x/a.jsonl',
      maxBytes: 10e6,
    });
    expect(
      resolveAuditConfig({ SEEKSTONE_AUDIT_FILE: '/x/a.jsonl', SEEKSTONE_AUDIT_MAX_SIZE: '512kb' })
        ?.maxBytes,
    ).toBe(512e3);
  });
});

describe('AuditLog', () => {
  it('creates the file at open and appends one JSON line per record', async () => {
    const path = join(dir, 'audit.jsonl');
    const log = AuditLog.open({ path, maxBytes: 1e6 });
    expect((await stat(path)).size).toBe(0);
    log.record(rec());
    log.record(rec({ tool: 'delete_note', outcome: 'policy_denied', policy: 'write_paths' }));
    const lines = (await readFile(path, 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] ?? '')).toMatchObject({ v: 1, tool: 'append_note', outcome: 'ok' });
    expect(JSON.parse(lines[1] ?? '')).toMatchObject({ outcome: 'policy_denied' });
  });

  it('resumes the byte count of an existing file across reopen', async () => {
    const path = join(dir, 'audit.jsonl');
    AuditLog.open({ path, maxBytes: 1e6 }).record(rec());
    const size = (await stat(path)).size;
    const reopened = AuditLog.open({ path, maxBytes: size + 10 });
    reopened.record(rec()); // would exceed the cap → rotates first
    expect((await readFile(`${path}.1`, 'utf8')).trim().split('\n')).toHaveLength(1);
    expect((await readFile(path, 'utf8')).trim().split('\n')).toHaveLength(1);
  });

  it('rotates to <file>.1 past the cap, keeping every record across the boundary', async () => {
    const path = join(dir, 'audit.jsonl');
    const one = `${JSON.stringify(rec())}\n`.length;
    const log = AuditLog.open({ path, maxBytes: one * 2 + 1 });
    log.record(rec({ durationMs: 1 }));
    log.record(rec({ durationMs: 2 }));
    log.record(rec({ durationMs: 3 })); // third would exceed → rotate
    const rotated = (await readFile(`${path}.1`, 'utf8')).trim().split('\n');
    const current = (await readFile(path, 'utf8')).trim().split('\n');
    expect(rotated.map((l) => JSON.parse(l).durationMs)).toEqual([1, 2]);
    expect(current.map((l) => JSON.parse(l).durationMs)).toEqual([3]);
  });

  it('never rotates an empty file even when a single record exceeds the cap', async () => {
    const path = join(dir, 'audit.jsonl');
    const log = AuditLog.open({ path, maxBytes: 5 });
    log.record(rec());
    await expect(stat(`${path}.1`)).rejects.toThrow();
  });

  it('open throws for an unwritable path', () => {
    expect(() =>
      AuditLog.open({ path: join(dir, 'missing', 'audit.jsonl'), maxBytes: 1 }),
    ).toThrow();
  });

  it('record throws when the file becomes unwritable', async () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) return; // chmod is advisory there
    const path = join(dir, 'audit.jsonl');
    const log = AuditLog.open({ path, maxBytes: 1e6 });
    await chmod(path, 0o400);
    expect(() => log.record(rec())).toThrow();
  });
});

describe('classifyError', () => {
  it('maps structured and policy errors to outcomes', () => {
    expect(classifyError(JSON.stringify({ error: 'hash_conflict' }))).toEqual({
      outcome: 'hash_conflict',
      error: 'hash_conflict',
    });
    expect(classifyError(JSON.stringify({ error: 'undo_conflict', seq: 3 }))).toEqual({
      outcome: 'undo_conflict',
      error: 'undo_conflict',
    });
    // Structured codes are kept; their payload (e.g. available headings) is not.
    expect(
      classifyError(JSON.stringify({ error: 'heading_not_found', available: ['Secret'] })),
    ).toEqual({ outcome: 'error', error: 'heading_not_found' });
    expect(classifyError(JSON.stringify({ error: 42 }))).toEqual({
      outcome: 'error',
      error: 'error',
    });
    expect(classifyError('{not json')).toEqual({ outcome: 'error', error: 'error' });
    expect(classifyError('Server is read-only (SEEKSTONE_READ_ONLY=1); …')).toEqual({
      outcome: 'policy_denied',
      policy: 'read_only',
      error: 'read_only',
    });
    expect(classifyError('Write not permitted: "x" is outside SEEKSTONE_WRITE_PATHS')).toEqual({
      outcome: 'policy_denied',
      policy: 'write_paths',
      error: 'write_paths',
    });
    expect(classifyError('Note not found: a.md').error).toBe('not_found');
    expect(classifyError("ENOENT: no such file or directory, open '/v/a.md'").error).toBe(
      'not_found',
    );
    expect(classifyError('Note already exists: a.md').error).toBe('exists');
    expect(classifyError('Invalid regex: Unterminated group').error).toBe('invalid_regex');
    expect(classifyError('Write-safety violation: frontmatter region changed').error).toBe(
      'write_safety_violation',
    );
    expect(classifyError('[\n  {\n    "code": "invalid_type"').error).toBe('invalid_input');
    expect(classifyError('something else entirely').error).toBe('error');
  });
});
