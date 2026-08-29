import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuditLog, type AuditRecord } from './audit.js';
import { contentHash } from './content-hash.js';
import type { ServerContext } from './context.js';
import { dispatch, HANDLED_TOOLS, WRITE_TOOLS } from './dispatch.js';
import { buildIndex } from './index/build.js';
import { Journal } from './journal.js';
import { createLogger } from './log.js';
import { PERMISSIVE_POLICY } from './policy.js';

/**
 * SHA-297 acceptance: every write-tool call — ok or refused — emits exactly
 * one audit record; read tools emit none; records carry hashes that match
 * read_note's contentHash and never carry note content.
 */

// Sentinels: if any of these ever appear in the audit file, content leaked.
const BODY_SENTINEL = 'SENTINEL-BODY-7f3a9c';
const FM_SENTINEL = 'SENTINEL-FM-VALUE-2b8d';
const QUERY_SENTINEL = 'SENTINEL-QUERY-e41c';
const NEW_CONTENT_SENTINEL = 'SENTINEL-NEW-CONTENT-90aa';

const NOTE_A = `---
title: ${FM_SENTINEL}
tags: [x]
---
# Alpha

## Section
${BODY_SENTINEL} hello twice: hello.

- item ^blk1
`;
const NOTE_B = `# Beta

Links to [[Alpha]] and [[Alpha#Section]].
`;

const log = createLogger({ env: { SEEKSTONE_LOG_LEVEL: 'error' }, stderr: () => {} });

let vault: string;
let auditPath: string;
let ctx: ServerContext;

async function freshCtx(opts: { journal?: boolean; audit?: boolean } = {}): Promise<ServerContext> {
  const built = await buildIndex(vault);
  const c: ServerContext = {
    vaultRoot: vault,
    index: built.index,
    notes: built.notes,
    backlinks: built.backlinks,
    policy: PERMISSIVE_POLICY,
  };
  if (opts.journal !== false) {
    c.journal = await Journal.open(vault, { maxBytes: 1e9, maxEntries: 1e6 });
  }
  if (opts.audit !== false) c.audit = AuditLog.open({ path: auditPath, maxBytes: 1e9 });
  return c;
}

async function records(): Promise<AuditRecord[]> {
  const raw = await readFile(auditPath, 'utf8').catch(() => '');
  return raw
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as AuditRecord);
}

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'seekstone-audit-dispatch-'));
  auditPath = `${vault}-audit.jsonl`; // sibling of the vault dir (portable: no separator games)
  await writeFile(join(vault, 'Alpha.md'), NOTE_A, 'utf8');
  await writeFile(join(vault, 'Beta.md'), NOTE_B, 'utf8');
  ctx = await freshCtx();
});

afterEach(async () => {
  await rm(vault, { recursive: true, force: true });
  await rm(auditPath, { force: true });
  await rm(`${auditPath}.1`, { force: true });
});

describe('audit — one record per write-tool call', () => {
  it('covers every write tool (plus get_periodic_note create) with ok outcomes and hash pairs', async () => {
    const calls: Array<[string, unknown]> = [
      ['create_note', { path: 'New.md', content: NEW_CONTENT_SENTINEL }],
      ['append_note', { path: 'Alpha.md', content: NEW_CONTENT_SENTINEL }],
      ['patch_frontmatter', { path: 'Alpha.md', patch: { status: NEW_CONTENT_SENTINEL } }],
      [
        'patch_note',
        {
          path: 'Alpha.md',
          target: { heading: 'Section' },
          operation: 'append',
          content: NEW_CONTENT_SENTINEL,
        },
      ],
      ['replace_in_note', { path: 'Alpha.md', find: 'hello', replace: NEW_CONTENT_SENTINEL }],
      ['rename_heading', { path: 'Alpha.md', oldHeading: 'Section', newHeading: 'Part' }],
      ['get_periodic_note', { period: 'daily', date: '2026-01-03', createIfMissing: true }],
      [
        'append_periodic_note',
        { period: 'daily', date: '2026-01-03', content: NEW_CONTENT_SENTINEL },
      ],
      ['move_note', { from: 'Alpha.md', to: 'Moved.md' }],
      ['delete_note', { path: 'New.md' }],
      ['undo_write', {}],
    ];
    const covered = new Set(calls.map(([n]) => n));
    for (const w of WRITE_TOOLS) expect(covered.has(w)).toBe(true);

    for (const [name, args] of calls) {
      const res = await dispatch(ctx, name, args, log);
      expect(res.isError, `${name}: ${res.content[0]?.text}`).toBeUndefined();
      // The audit detail must never reach the MCP client.
      expect('audit' in res).toBe(false);
    }

    const recs = await records();
    expect(recs.map((r) => r.tool)).toEqual(calls.map(([n]) => n));
    for (const r of recs) {
      expect(r.v).toBe(1);
      expect(r.outcome).toBe('ok');
      expect(typeof r.durationMs).toBe('number');
      expect(Number.isNaN(Date.parse(r.ts))).toBe(false);
      expect(typeof r.seq).toBe('number');
      expect(r.files?.length).toBeGreaterThan(0);
    }

    // Hash pairs chain: each record's hashAfter is the next record's hashBefore for the same path.
    const alpha = recs.filter((r) => r.files?.some((f) => f.path === 'Alpha.md'));
    for (let i = 1; i < alpha.length; i++) {
      const prev = alpha[i - 1]?.files?.find((f) => f.path === 'Alpha.md');
      const cur = alpha[i]?.files?.find((f) => f.path === 'Alpha.md');
      expect(cur?.hashBefore).toBe(prev?.hashAfter);
    }
    // create: no before; delete: no after; move: from→null, to←raw; undo references its target seq.
    expect(recs[0]?.files?.[0]).toMatchObject({ path: 'New.md', hashBefore: null });
    const del = recs.find((r) => r.tool === 'delete_note');
    expect(del?.files?.[0]).toMatchObject({ path: 'New.md', hashAfter: null });
    expect(del?.trashedTo).toMatch(/^\.trash\//);
    const mv = recs.find((r) => r.tool === 'move_note');
    expect(mv?.files?.map((f) => f.path).sort()).toEqual(['Alpha.md', 'Beta.md', 'Moved.md']);
    expect(mv).toMatchObject({ from: 'Alpha.md', to: 'Moved.md', notesRewritten: 1 });
    const undo = recs.find((r) => r.tool === 'undo_write');
    expect(undo).toMatchObject({ undoOf: del?.seq, restored: 1 });
    const fm = recs.find((r) => r.tool === 'patch_frontmatter');
    expect(fm?.keysAdded).toEqual(['status']);
    expect(recs.find((r) => r.tool === 'get_periodic_note')).toMatchObject({ created: true });
  });

  it('hashes equal read_note contentHash for the same bytes', async () => {
    await dispatch(ctx, 'append_note', { path: 'Alpha.md', content: 'x' }, log);
    const [r] = await records();
    const read = JSON.parse(
      (await dispatch(ctx, 'read_note', { path: 'Alpha.md' }, log)).content[0]?.text ?? '',
    );
    expect(r?.files?.[0]?.hashAfter).toBe(read.contentHash);
    expect(r?.files?.[0]?.hashBefore).toBe(contentHash(NOTE_A));
  });

  it('never records note content, frontmatter values, or queries', async () => {
    await dispatch(ctx, 'search', { query: QUERY_SENTINEL }, log);
    await dispatch(
      ctx,
      'query_notes',
      { where: [{ key: 'title', op: 'eq', value: FM_SENTINEL }] },
      log,
    );
    await dispatch(ctx, 'append_note', { path: 'Alpha.md', content: NEW_CONTENT_SENTINEL }, log);
    await dispatch(
      ctx,
      'patch_frontmatter',
      { path: 'Alpha.md', patch: { k: NEW_CONTENT_SENTINEL } },
      log,
    );
    await dispatch(
      ctx,
      'replace_in_note',
      { path: 'Alpha.md', find: BODY_SENTINEL, replace: 'z' },
      log,
    );
    await dispatch(ctx, 'create_note', { path: 'Alpha.md', content: NEW_CONTENT_SENTINEL }, log); // refused
    await dispatch(
      ctx,
      'patch_note',
      {
        path: 'Alpha.md',
        target: { heading: NEW_CONTENT_SENTINEL },
        operation: 'append',
        content: 'c',
      },
      log,
    ); // heading_not_found error — message must not echo the heading? it lists available headings
    const raw = await readFile(auditPath, 'utf8');
    for (const s of [BODY_SENTINEL, FM_SENTINEL, QUERY_SENTINEL, NEW_CONTENT_SENTINEL]) {
      expect(raw, `sentinel ${s} leaked into the audit log`).not.toContain(s);
    }
  });

  it('read tools emit nothing; get_periodic_note emits only when it creates', async () => {
    for (const name of [
      'search',
      'read_note',
      'list_notes',
      'list_tags',
      'outline_note',
      'get_links',
      'get_backlinks',
      'list_writes',
      'context_pack',
      'query_notes',
    ]) {
      const args =
        name === 'search' || name === 'context_pack' ? { query: 'a' } : { path: 'Alpha.md' };
      await dispatch(ctx, name, args, log);
    }
    await dispatch(ctx, 'get_periodic_note', { period: 'daily', date: '2026-01-03' }, log);
    expect(await records()).toEqual([]);
    await dispatch(
      ctx,
      'get_periodic_note',
      { period: 'daily', date: '2026-01-03', createIfMissing: true },
      log,
    );
    await dispatch(
      ctx,
      'get_periodic_note',
      { period: 'daily', date: '2026-01-03', createIfMissing: true },
      log,
    ); // exists now
    expect((await records()).map((r) => r.tool)).toEqual(['get_periodic_note']);
  });

  it('records refused attempts: hash_conflict, write_paths, read-only, undo_conflict, error', async () => {
    await dispatch(ctx, 'append_note', { path: 'Alpha.md', content: 'x', prevHash: 'stale' }, log);
    ctx.policy = { readOnly: false, writeGlobs: ['journal/**'] };
    await dispatch(ctx, 'delete_note', { path: 'Alpha.md' }, log);
    ctx.policy = { readOnly: true };
    await dispatch(ctx, 'move_note', { from: 'Alpha.md', to: 'B.md' }, log);
    ctx.policy = PERMISSIVE_POLICY;
    await dispatch(ctx, 'append_note', { path: 'Alpha.md', content: 'x' }, log); // ok, seq 1
    await writeFile(join(vault, 'Alpha.md'), 'external\n', 'utf8');
    await dispatch(ctx, 'undo_write', {}, log);
    await dispatch(ctx, 'append_note', { path: 'Missing.md', content: 'x' }, log);

    const recs = await records();
    expect(recs.map((r) => [r.tool, r.outcome, r.policy])).toEqual([
      ['append_note', 'hash_conflict', undefined],
      ['delete_note', 'policy_denied', 'write_paths'],
      ['move_note', 'policy_denied', 'read_only'],
      ['append_note', 'ok', undefined],
      ['undo_write', 'undo_conflict', undefined],
      ['append_note', 'error', undefined],
    ]);
    expect(recs[0]).toMatchObject({ path: 'Alpha.md' });
    expect(recs[2]).toMatchObject({ from: 'Alpha.md', to: 'B.md' });
    expect(recs.map((r) => r.error)).toEqual([
      'hash_conflict',
      'write_paths',
      'read_only',
      undefined,
      'undo_conflict',
      'not_found',
    ]);
    for (const r of recs) if (r.outcome !== 'ok') expect(r.files).toBeUndefined();
  });

  it('falls back to the after-hash only when the journal is off', async () => {
    ctx = await freshCtx({ journal: false });
    await dispatch(ctx, 'append_note', { path: 'Alpha.md', content: 'x' }, log);
    await dispatch(
      ctx,
      'move_note',
      { from: 'Alpha.md', to: 'Moved.md', rewriteLinks: false },
      log,
    );
    const recs = await records();
    expect(recs[0]?.seq).toBeUndefined();
    expect(recs[0]?.files).toEqual([{ path: 'Alpha.md', hashAfter: recs[0]?.contentHash }]);
    expect(recs[0]?.files?.[0]?.hashBefore).toBeUndefined();
    // move has no single `path` in its detail → no files without the journal.
    expect(recs[1]?.files).toBeUndefined();
    expect(recs[1]).toMatchObject({ from: 'Alpha.md', to: 'Moved.md' });
  });

  it('is zero-overhead and file-free when SEEKSTONE_AUDIT_FILE is unset', async () => {
    ctx = await freshCtx({ audit: false });
    await rm(auditPath, { force: true }); // beforeEach's default ctx created it
    const res = await dispatch(ctx, 'append_note', { path: 'Alpha.md', content: 'x' }, log);
    expect(res.isError).toBeUndefined();
    await expect(readFile(auditPath, 'utf8')).rejects.toThrow();
  });

  it('reports audit_failed (write already landed) when the record cannot be appended', async () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) return;
    await chmod(auditPath, 0o400);
    const res = await dispatch(ctx, 'append_note', { path: 'Alpha.md', content: 'x' }, log);
    expect(res.isError).toBe(true);
    const parsed = JSON.parse((res.content[0]?.text ?? '').replace(/^Error: /, ''));
    expect(parsed).toMatchObject({ error: 'audit_failed', tool: 'append_note', outcome: 'ok' });
    expect(parsed.hint).toContain('DID complete');
    expect(await readFile(join(vault, 'Alpha.md'), 'utf8')).not.toBe(NOTE_A);
    // A refused call that also cannot be audited says the op did not run.
    const denied = await dispatch(
      ctx,
      'append_note',
      { path: 'Alpha.md', content: 'x', prevHash: 'stale' },
      log,
    );
    expect(JSON.parse((denied.content[0]?.text ?? '').replace(/^Error: /, '')).hint).toContain(
      'did not run',
    );
  });

  it('every HANDLED_TOOL is either a write tool, get_periodic_note, or emits nothing', async () => {
    // Guard: a future write tool added to HANDLED_TOOLS but not WRITE_TOOLS would silently skip auditing.
    const reads = HANDLED_TOOLS.filter((t) => !WRITE_TOOLS.has(t) && t !== 'get_periodic_note');
    expect(reads).toEqual([
      'search',
      'query_notes',
      'context_pack',
      'read_note',
      'list_notes',
      'list_tags',
      'outline_note',
      'get_backlinks',
      'get_links',
      'list_writes',
    ]);
  });
});
