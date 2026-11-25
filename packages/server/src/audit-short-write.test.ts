import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditLog, type AuditRecord } from './audit.js';
import type { ServerContext } from './context.js';
import { dispatch } from './dispatch.js';
import { buildIndex } from './index/build.js';
import { createLogger } from './log.js';
import { PERMISSIVE_POLICY } from './policy.js';

// SHA-580: writeSync may write fewer bytes than asked. These tests make it do
// so for the audit file and check that a record is written whole or the call
// reports audit_failed.

/** Bytes per writeSync call on the audit file; undefined writes normally. */
const chunk = vi.hoisted(() => ({ size: undefined as number | undefined, path: '' }));

vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  const auditFds = new Set<number>();
  const openSync = (path: string, ...rest: unknown[]): number => {
    const fd = (fs.openSync as (...a: unknown[]) => number)(path, ...rest);
    if (chunk.path !== '' && String(path) === chunk.path) auditFds.add(fd);
    return fd;
  };
  const closeSync = (fd: number): void => {
    auditFds.delete(fd);
    fs.closeSync(fd);
  };
  const writeSync = (fd: number, data: unknown, ...rest: unknown[]): number => {
    const size = chunk.size;
    if (size === undefined || !auditFds.has(fd)) {
      return (fs.writeSync as (...a: unknown[]) => number)(fd, data, ...rest);
    }
    const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : (data as Buffer);
    const off = typeof rest[0] === 'number' ? rest[0] : 0;
    const len = typeof rest[1] === 'number' ? rest[1] : buf.length - off;
    return fs.writeSync(fd, buf, off, Math.min(len, size));
  };
  return {
    ...fs,
    openSync,
    closeSync,
    writeSync,
    default: { ...fs, openSync, closeSync, writeSync },
  };
});

const log = createLogger({ env: { SEEKSTONE_LOG_LEVEL: 'error' }, stderr: () => {} });

let dir: string;
let auditPath: string;

const rec = (tool: string): AuditRecord => ({
  v: 1,
  ts: '2026-01-01T00:00:00.000Z',
  tool,
  outcome: 'ok',
  durationMs: 1,
  files: [{ path: `${tool}.md`, hashAfter: 'é'.repeat(20) }],
});

async function lines(): Promise<string[]> {
  return (await readFile(auditPath, 'utf8')).split('\n');
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'seekstone-audit-short-'));
  auditPath = join(dir, 'audit.jsonl');
  chunk.path = auditPath;
  chunk.size = undefined;
});
afterEach(async () => {
  chunk.size = undefined;
  chunk.path = '';
  await rm(dir, { recursive: true, force: true });
});

describe('AuditLog with short writes', () => {
  it('writes the whole line when writeSync returns early', async () => {
    const audit = AuditLog.open({ path: auditPath, maxBytes: 1e9 });
    // 7 bytes per call splits the two-byte "é" across calls too.
    chunk.size = 7;
    audit.record(rec('a'));
    audit.record(rec('b'));
    chunk.size = undefined;
    expect((await lines()).map((l) => (l === '' ? '' : JSON.parse(l).tool))).toEqual([
      'a',
      'b',
      '',
    ]);
    expect(JSON.parse((await lines())[0] as string)).toEqual(rec('a'));
  });

  it('throws when a write makes no progress', () => {
    const audit = AuditLog.open({ path: auditPath, maxBytes: 1e9 });
    chunk.size = 0;
    expect(() => audit.record(rec('a'))).toThrow(/no progress/);
  });

  it('a write tool reports audit_failed when the record makes no progress', async () => {
    const vault = join(dir, 'vault');
    await mkdir(vault);
    await writeFile(join(vault, 'Note.md'), 'start\n', 'utf8');
    const built = await buildIndex(vault);
    const ctx: ServerContext = {
      vaultRoot: vault,
      index: built.index,
      notes: built.notes,
      generation: 0,
      backlinks: built.backlinks,
      attachments: built.attachments,
      policy: PERMISSIVE_POLICY,
      audit: AuditLog.open({ path: auditPath, maxBytes: 1e9 }),
    };
    chunk.size = 0;
    const res = await dispatch(ctx, 'append_note', { path: 'Note.md', content: 'more' }, log);
    chunk.size = undefined;
    expect(res.isError).toBe(true);
    const parsed = JSON.parse((res.content[0]?.text ?? '').replace(/^Error: /, ''));
    expect(parsed).toMatchObject({ error: 'audit_failed', tool: 'append_note', outcome: 'ok' });
  });
});
