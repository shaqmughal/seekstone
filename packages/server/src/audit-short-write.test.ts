import { renameSync, writeFileSync } from 'node:fs';
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
  /** When true, truncating the audit file (by path or fd) throws. */
  truncateFails: false,
  /** When true, the audit file is write-only: opening it for reading fails. */
  writeOnly: false,
  /** Runs once before the next audit writeSync, to stand in for another writer. */
  beforeWrite: undefined as (() => void) | undefined,
}));

vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  const auditFds = new Set<number>();
  const eacces = (): Error =>
    Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
  // The code under test opens the audit file with 'a', O_WRONLY or 'r'.
  const readsFile = (flags: unknown) => flags !== 'a' && flags !== fs.constants.O_WRONLY;
  const openSync = (path: string, ...rest: unknown[]): number => {
    if (chunk.writeOnly && String(path) === chunk.path && readsFile(rest[0])) throw eacces();
    const fd = (fs.openSync as (...a: unknown[]) => number)(path, ...rest);
    if (chunk.path !== '' && String(path) === chunk.path) auditFds.add(fd);
    return fd;
  };
  const closeSync = (fd: number): void => {
    auditFds.delete(fd);
    fs.closeSync(fd);
  };
  const writeSync = (fd: number, data: unknown, ...rest: unknown[]): number => {
    const hook = chunk.beforeWrite;
    chunk.beforeWrite = undefined;
    hook?.();
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
  const truncateSync = (path: string, len?: number): void => {
    // truncateSync opens the path with 'r+', which needs read access.
    if (String(path) === chunk.path && (chunk.truncateFails || chunk.writeOnly)) throw eacces();
    fs.truncateSync(path, len);
  };
  const ftruncateSync = (fd: number, len?: number): void => {
    if (chunk.truncateFails && auditFds.has(fd)) throw new Error('EIO: i/o error, ftruncate');
    fs.ftruncateSync(fd, len);
  };
  const mocked = { openSync, closeSync, writeSync, fsyncSync, truncateSync, ftruncateSync };
  return { ...fs, ...mocked, default: { ...fs, ...mocked } };
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

/** Each line of the audit file: a record's tool, or the raw text if it doesn't parse. */
async function lines(): Promise<string[]> {
  return (await readFile(auditPath, 'utf8')).split('\n').map((l) => {
    try {
      return JSON.parse(l).tool;
    } catch {
      return l;
    }
  });
}

const open = (maxBytes = 1e9): AuditLog => AuditLog.open({ path: auditPath, maxBytes });
const PART = JSON.stringify(rec('x')).slice(0, 14);

/** Record 'x' with two 7-byte writes landing before the third fails. */
function tear(audit: AuditLog, failWith: 'throw' | 'zero' = 'throw'): void {
  Object.assign(chunk, { size: 7, failAfter: 2, failWith });
  expect(() => audit.record(rec('x'))).toThrow(failWith === 'zero' ? /no progress/ : /ENOSPC/);
  Object.assign(chunk, { size: undefined, failAfter: undefined });
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'seekstone-audit-short-'));
  auditPath = join(dir, 'audit.jsonl');
  chunk.path = auditPath;
});
afterEach(async () => {
  Object.assign(chunk, { size: undefined, path: '', failAfter: undefined, failWith: 'throw' });
  Object.assign(chunk, { fsyncFails: false, truncateFails: false, writeOnly: false });
  chunk.beforeWrite = undefined;
  await rm(dir, { recursive: true, force: true });
});

describe('AuditLog with short writes', () => {
  it('writes the whole line when writeSync returns early', async () => {
    const audit = open();
    // 7 bytes per call splits the two-byte "é" across calls too.
    chunk.size = 7;
    audit.record(rec('a'));
    audit.record(rec('b'));
    expect(await lines()).toEqual(['a', 'b', '']);
    const first = (await readFile(auditPath, 'utf8')).split('\n')[0] as string;
    expect(JSON.parse(first)).toEqual(rec('a'));
  });

  it('throws when a write makes no progress', () => {
    const audit = open();
    chunk.size = 0;
    expect(() => audit.record(rec('a'))).toThrow(/no progress/);
  });

  it.each([
    ['throws ENOSPC', 'throw'],
    ['makes no progress', 'zero'],
  ] as const)('removes the partial line when a later write %s', async (_name, failWith) => {
    const audit = open();
    audit.record(rec('a'));
    const before = await readFile(auditPath, 'utf8');
    tear(audit, failWith);
    expect(await readFile(auditPath, 'utf8')).toBe(before);
    audit.record(rec('b'));
    expect(await lines()).toEqual(['a', 'b', '']);
  });

  it('reports the write error and starts the next record on a new line when the truncate also fails', async () => {
    const [a, b] = [open(), open()];
    a.record(rec('a'));
    chunk.truncateFails = true;
    tear(a);
    b.record(rec('c'));
    a.record(rec('b'));
    expect(await lines()).toEqual(['a', PART, 'c', 'b', '']);
  });

  it('keeps a record another writer appends while a write fails', async () => {
    const [a, b] = [open(), open()];
    a.record(rec('first'));
    // B appends a whole record after A has measured the file, before A writes.
    chunk.beforeWrite = () => {
      chunk.size = undefined;
      b.record(rec('second'));
      chunk.size = 7;
    };
    tear(a);
    a.record(rec('third'));
    expect(await lines()).toEqual(['first', 'second', PART, 'third', '']);
  });

  it('leaves alone a file another server rotated in before the truncate', async () => {
    const a = open();
    a.record(rec('first'));
    const fresh = `${JSON.stringify(rec('b1'))}\n${JSON.stringify(rec('b2'))}\n`;
    // Rotate just before the third (failing) write: A's fd keeps the old file.
    const rotate = () => {
      renameSync(auditPath, `${auditPath}.1`);
      writeFileSync(auditPath, fresh);
    };
    chunk.beforeWrite = () => (chunk.beforeWrite = () => (chunk.beforeWrite = rotate));
    tear(a);
    expect(await readFile(auditPath, 'utf8')).toBe(fresh);
  });

  it('starts on a new line when the file has a torn tail at open', async () => {
    await writeFile(auditPath, `${JSON.stringify(rec('a'))}\n{"v":1,"ts"`, 'utf8');
    open().record(rec('b'));
    expect(await lines()).toEqual(['a', '{"v":1,"ts"', 'b', '']);
  });

  it('counts the leading newline when deciding to rotate', async () => {
    await writeFile(auditPath, 'x', 'utf8');
    const line = `${JSON.stringify(rec('b'))}\n`;
    open(1 + Buffer.byteLength(line)).record(rec('b'));
    expect(await readFile(`${auditPath}.1`, 'utf8')).toBe('x');
    expect(await readFile(auditPath, 'utf8')).toBe(line);
  });

  it('joins the torn tail of a write-only file it cannot read', async () => {
    await writeFile(auditPath, '{"v":1', 'utf8');
    chunk.writeOnly = true;
    open().record(rec('b'));
    expect((await readFile(auditPath, 'utf8')).startsWith(`{"v":1{"v":1,`)).toBe(true);
  });

  it('removes the partial line from a write-only audit file', async () => {
    const audit = open();
    audit.record(rec('a'));
    chunk.writeOnly = true;
    tear(audit);
    expect(await lines()).toEqual(['a', '']);
  });

  it('keeps a complete record when fsync fails, and counts it for rotation', async () => {
    // Room for one record: the second one must rotate the first out.
    const audit = open(Buffer.byteLength(`${JSON.stringify(rec('a'))}\n`) + 1);
    chunk.fsyncFails = true;
    expect(() => audit.record(rec('a'))).toThrow(/EIO/);
    chunk.fsyncFails = false;
    expect(await lines()).toEqual(['a', '']);
    audit.record(rec('b'));
    expect(JSON.parse((await readFile(`${auditPath}.1`, 'utf8')).trim())).toEqual(rec('a'));
    expect(await lines()).toEqual(['b', '']);
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
      audit: open(),
    };
    chunk.size = 0;
    const res = await dispatch(ctx, 'append_note', { path: 'Note.md', content: 'more' }, log);
    chunk.size = undefined;
    expect(res.isError).toBe(true);
    const parsed = JSON.parse((res.content[0]?.text ?? '').replace(/^Error: /, ''));
    expect(parsed).toMatchObject({ error: 'audit_failed', tool: 'append_note', outcome: 'ok' });
  });
});
