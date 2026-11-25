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
const chunk = vi.hoisted(() => ({
  size: undefined as number | undefined,
  path: '',
  /** Short writes that land before the write fails; undefined never fails. */
  failAfter: undefined as number | undefined,
  /** How the write fails: throw ENOSPC, or return 0 bytes. */
  failWith: 'throw' as 'throw' | 'zero',
  /** When true, fsyncSync on the audit file throws. */
  fsyncFails: false,
  /** When true, ftruncateSync on the audit file throws. */
  truncateFails: false,
}));

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
    if (chunk.failAfter !== undefined) {
      if (chunk.failAfter <= 0) {
        if (chunk.failWith === 'zero') return 0;
        throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });
      }
      chunk.failAfter--;
    }
    const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : (data as Buffer);
    const off = typeof rest[0] === 'number' ? rest[0] : 0;
    const len = typeof rest[1] === 'number' ? rest[1] : buf.length - off;
    return fs.writeSync(fd, buf, off, Math.min(len, size));
  };
  const fsyncSync = (fd: number): void => {
    if (chunk.fsyncFails && auditFds.has(fd)) throw new Error('EIO: i/o error, fsync');
    fs.fsyncSync(fd);
  };
  const ftruncateSync = (fd: number, len?: number): void => {
    if (chunk.truncateFails && auditFds.has(fd)) throw new Error('EIO: i/o error, ftruncate');
    fs.ftruncateSync(fd, len);
  };
  return {
    ...fs,
    openSync,
    closeSync,
    writeSync,
    fsyncSync,
    ftruncateSync,
    default: { ...fs, openSync, closeSync, writeSync, fsyncSync, ftruncateSync },
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
  chunk.failAfter = undefined;
  chunk.failWith = 'throw';
  chunk.fsyncFails = false;
  chunk.truncateFails = false;
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

  it.each([
    ['throws ENOSPC', 'throw', /ENOSPC/],
    ['makes no progress', 'zero', /no progress/],
  ] as const)('removes the partial line when a later write %s', async (_name, failWith, error) => {
    const audit = AuditLog.open({ path: auditPath, maxBytes: 1e9 });
    audit.record(rec('a'));
    const before = await readFile(auditPath, 'utf8');
    // Two 7-byte writes land, then the third fails.
    chunk.size = 7;
    chunk.failAfter = 2;
    chunk.failWith = failWith;
    expect(() => audit.record(rec('x'))).toThrow(error);
    expect(await readFile(auditPath, 'utf8')).toBe(before);
    chunk.size = undefined;
    chunk.failAfter = undefined;
    audit.record(rec('b'));
    expect((await lines()).map((l) => (l === '' ? '' : JSON.parse(l).tool))).toEqual([
      'a',
      'b',
      '',
    ]);
  });

  it('reports the write error when the truncate after it also fails', () => {
    const audit = AuditLog.open({ path: auditPath, maxBytes: 1e9 });
    chunk.size = 7;
    chunk.failAfter = 1;
    chunk.truncateFails = true;
    expect(() => audit.record(rec('x'))).toThrow(/ENOSPC/);
  });

  it('keeps a complete record when fsync fails, and counts it for rotation', async () => {
    const len = Buffer.byteLength(`${JSON.stringify(rec('a'))}\n`);
    // Room for one record: the second one must rotate the first out.
    const audit = AuditLog.open({ path: auditPath, maxBytes: len + 1 });
    chunk.fsyncFails = true;
    expect(() => audit.record(rec('a'))).toThrow(/EIO/);
    chunk.fsyncFails = false;
    expect(JSON.parse((await lines())[0] as string)).toEqual(rec('a'));
    audit.record(rec('b'));
    expect(JSON.parse((await readFile(`${auditPath}.1`, 'utf8')).trim())).toEqual(rec('a'));
    expect((await lines()).map((l) => (l === '' ? '' : JSON.parse(l).tool))).toEqual(['b', '']);
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
