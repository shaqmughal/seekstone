import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerContext } from './context.js';
import { dispatch, HANDLED_TOOLS, WRITE_TOOLS } from './dispatch.js';
import { buildIndex } from './index/build.js';
import type { Logger } from './log.js';
import { createLogger } from './log.js';
import { PERMISSIVE_POLICY, parseWritePolicy } from './policy.js';

interface LogRecord {
  level: string;
  msg: string;
  fields?: Record<string, unknown>;
}

function recordingLogger(): { logger: Logger; records: LogRecord[] } {
  const records: LogRecord[] = [];
  const mk =
    (level: string) =>
    (msg: string, fields?: Record<string, unknown>): void => {
      records.push({ level, msg, fields });
    };
  return {
    logger: {
      level: 'debug',
      error: mk('error'),
      warn: mk('warn'),
      info: mk('info'),
      debug: mk('debug'),
    },
    records,
  };
}

let vaultRoot: string;
let ctx: ServerContext;

beforeAll(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), 'seekstone-dispatch-'));
  await writeFile(join(vaultRoot, 'note.md'), '---\ntitle: A\n---\n# A\nhello world\n', 'utf8');
  const { index, notes, attachments } = await buildIndex(vaultRoot);
  ctx = {
    vaultRoot,
    index,
    notes,
    generation: 0,
    backlinks: new Map(),
    attachments,
    policy: PERMISSIVE_POLICY,
  };
});

afterAll(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

describe('dispatch', () => {
  it('routes a tool call and logs a "tool ok" record with metadata', async () => {
    const { logger, records } = recordingLogger();
    const res = await dispatch(ctx, 'list_notes', {}, logger);
    expect(res.isError).toBeUndefined();
    expect(res.content[0]?.type).toBe('text');
    const ok = records.find((r) => r.msg === 'tool ok');
    expect(ok?.level).toBe('info');
    expect(ok?.fields).toMatchObject({ tool: 'list_notes' });
    expect(typeof ok?.fields?.durationMs).toBe('number');
    expect(typeof ok?.fields?.resultBytes).toBe('number');
  });

  it('returns isError and logs "tool error" with a stack for an unknown tool', async () => {
    const { logger, records } = recordingLogger();
    const res = await dispatch(ctx, 'nope', {}, logger);
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toContain('Unknown tool');
    const err = records.find((r) => r.msg === 'tool error');
    expect(err?.level).toBe('error');
    expect(err?.fields?.tool).toBe('nope');
    expect(typeof err?.fields?.stack).toBe('string');
  });

  it('logs vault-relative path as metadata at info', async () => {
    const { logger, records } = recordingLogger();
    await dispatch(ctx, 'read_note', { path: 'note.md' }, logger);
    const ok = records.find((r) => r.msg === 'tool ok');
    expect(ok?.fields?.path).toBe('note.md');
  });

  it('does NOT log note content/frontmatter at info; only at debug', async () => {
    const { logger, records } = recordingLogger();
    await dispatch(
      ctx,
      'create_note',
      { path: 'secret.md', content: 'TOP SECRET BODY', frontmatter: { ssn: '123-45-6789' } },
      logger,
    );
    const ok = records.find((r) => r.msg === 'tool ok');
    const okJson = JSON.stringify(ok?.fields ?? {});
    expect(okJson).not.toContain('TOP SECRET BODY');
    expect(okJson).not.toContain('123-45-6789');
    // The debug "tool start" record carries the full args (gated to debug at runtime).
    const start = records.find((r) => r.msg === 'tool start');
    expect(JSON.stringify(start?.fields ?? {})).toContain('TOP SECRET BODY');
  });

  it('logs query length but never the raw query at info', async () => {
    const { logger, records } = recordingLogger();
    await dispatch(ctx, 'search', { query: 'confidential-term' }, logger);
    const ok = records.find((r) => r.msg === 'tool ok');
    expect(ok?.fields?.queryLen).toBe('confidential-term'.length);
    expect(JSON.stringify(ok?.fields ?? {})).not.toContain('confidential-term');
  });

  it('routes query_notes, returns minified JSON, and logs predicate count not values', async () => {
    const { logger, records } = recordingLogger();
    const res = await dispatch(
      ctx,
      'query_notes',
      { where: [{ key: 'title', op: 'ne', value: 'secret-value' }] },
      logger,
    );
    expect(res.isError).toBeUndefined();
    const text = res.content[0]?.text ?? '';
    expect(JSON.parse(text)).toEqual([{ path: 'note.md', title: 'A' }]);
    expect(text).not.toContain('\n'); // minified, same context-tax discipline as search
    const ok = records.find((r) => r.msg === 'tool ok');
    expect(ok?.fields?.whereCount).toBe(1);
    expect(JSON.stringify(ok?.fields ?? {})).not.toContain('secret-value');
  });

  it('never writes to stdout while dispatching (protects the stdio transport)', async () => {
    const outSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    try {
      const log = createLogger({ env: { SEEKSTONE_LOG_LEVEL: 'debug' } });
      await dispatch(ctx, 'list_notes', {}, log);
      await dispatch(ctx, 'read_note', { path: 'note.md' }, log);
      await dispatch(ctx, 'search', { query: 'hello' }, log);
      await dispatch(ctx, 'nope', {}, log);
      expect(outSpy).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('HANDLED_TOOLS matches the cases the dispatcher actually accepts', async () => {
    const { logger } = recordingLogger();
    for (const tool of HANDLED_TOOLS) {
      // A bad-args call should fail validation, NOT fall through to "Unknown tool".
      const res = await dispatch(ctx, tool, { __invalid__: true }, logger);
      if (res.isError) {
        expect(res.content[0]?.text).not.toContain('Unknown tool');
      }
    }
  });
});

describe('dispatch — read-only mode', () => {
  const roCtx = (): ServerContext => ({ ...ctx, policy: { readOnly: true } });

  it('rejects every write tool with an isError result (not a throw)', async () => {
    const { logger, records } = recordingLogger();
    for (const tool of WRITE_TOOLS) {
      const res = await dispatch(roCtx(), tool, { path: 'note.md', content: 'x' }, logger);
      expect(res.isError).toBe(true);
      expect(res.content[0]?.text).toContain('read-only');
    }
    expect(records.filter((r) => r.msg === 'tool rejected (read-only)')).toHaveLength(
      WRITE_TOOLS.size,
    );
  });

  it('still serves read tools', async () => {
    const { logger } = recordingLogger();
    const res = await dispatch(roCtx(), 'search', { query: 'hello' }, logger);
    expect(res.isError).toBeUndefined();
  });

  it('forces createIfMissing off for get_periodic_note', async () => {
    const { logger } = recordingLogger();
    const res = await dispatch(
      roCtx(),
      'get_periodic_note',
      { period: 'daily', createIfMissing: true },
      logger,
    );
    expect(res.isError).toBeUndefined();
    const parsed = JSON.parse(res.content[0]?.text ?? '{}');
    expect(parsed.created).toBe(false);
  });
});

describe('rename_heading dispatch text', () => {
  it('reports notes skipped by SEEKSTONE_WRITE_PATHS in the result text', async () => {
    const scopedVault = await mkdtemp(join(tmpdir(), 'seekstone-dispatch-rename-'));
    try {
      await writeFile(join(scopedVault, 'subject.md'), '# Subject\n\n## Old\n\nbody\n', 'utf8');
      await writeFile(join(scopedVault, 'linker.md'), 'See [[subject#Old]].\n', 'utf8');
      const built = await buildIndex(scopedVault);
      const scopedCtx: ServerContext = {
        vaultRoot: scopedVault,
        index: built.index,
        notes: built.notes,
        generation: 0,
        backlinks: built.backlinks,
        attachments: built.attachments,
        policy: parseWritePolicy({ SEEKSTONE_WRITE_PATHS: 'subject.md' }),
      };
      const { logger } = recordingLogger();
      const res = await dispatch(
        scopedCtx,
        'rename_heading',
        { path: 'subject.md', oldHeading: 'Old', newHeading: 'New' },
        logger,
      );
      expect(res.isError).toBeUndefined();
      const text = res.content[0]?.text ?? '';
      expect(text).toContain('Renamed heading "Old" → "New" in subject.md');
      expect(text).toContain(
        'Skipped (not writable: outside SEEKSTONE_WRITE_PATHS or through a symlink): linker.md.',
      );
    } finally {
      await rm(scopedVault, { recursive: true, force: true });
    }
  });
});

describe('move_note and delete_note return contentHash to the client (SHA-581)', () => {
  let hashVault: string;
  let hashCtx: ServerContext;
  const sha256 = (raw: Buffer): string => createHash('sha256').update(raw).digest('hex');
  const endingHash = (text: string): string | undefined =>
    /contentHash: ([0-9a-f]{64})$/.exec(text)?.[1];

  beforeEach(async () => {
    hashVault = await mkdtemp(join(tmpdir(), 'seekstone-dispatch-hash-'));
    await writeFile(join(hashVault, 'subject.md'), '# Subject\n\nbody\n', 'utf8');
    await writeFile(join(hashVault, 'linker.md'), 'See [[subject]].\n', 'utf8');
    const built = await buildIndex(hashVault);
    hashCtx = {
      vaultRoot: hashVault,
      index: built.index,
      notes: built.notes,
      generation: 0,
      backlinks: built.backlinks,
      attachments: built.attachments,
      policy: PERMISSIVE_POLICY,
    };
  });

  afterEach(async () => {
    await rm(hashVault, { recursive: true, force: true });
  });

  it('move_note ends its text with the hash of the note at its new path', async () => {
    const { logger } = recordingLogger();
    const res = await dispatch(
      hashCtx,
      'move_note',
      { from: 'subject.md', to: 'sub/moved.md' },
      logger,
    );
    expect(res.isError).toBeUndefined();
    const hash = endingHash(res.content[0]?.text ?? '');
    expect(hash).toBe(sha256(await readFile(join(hashVault, 'sub', 'moved.md'))));

    // The returned hash chains straight into a prevHash edit without a re-read.
    const append = await dispatch(
      hashCtx,
      'append_note',
      { path: 'sub/moved.md', content: 'more\n', prevHash: hash },
      logger,
    );
    expect(append.isError).toBeUndefined();
  });

  it('move_note still ends with the hash when it reports skipped notes', async () => {
    hashCtx.policy = parseWritePolicy({ SEEKSTONE_WRITE_PATHS: 'subject.md,moved.md' });
    const { logger } = recordingLogger();
    const res = await dispatch(
      hashCtx,
      'move_note',
      { from: 'subject.md', to: 'moved.md' },
      logger,
    );
    expect(res.isError).toBeUndefined();
    const text = res.content[0]?.text ?? '';
    expect(text).toContain(
      'Skipped (not writable: outside SEEKSTONE_WRITE_PATHS or through a symlink): linker.md.',
    );
    expect(endingHash(text)).toBe(sha256(await readFile(join(hashVault, 'moved.md'))));
  });

  it('delete_note ends its text with the hash of the note as moved into .trash/', async () => {
    const { logger } = recordingLogger();
    const res = await dispatch(hashCtx, 'delete_note', { path: 'subject.md' }, logger);
    expect(res.isError).toBeUndefined();
    const text = res.content[0]?.text ?? '';
    expect(text).toContain('Moved subject.md to .trash/subject.md');
    expect(endingHash(text)).toBe(sha256(await readFile(join(hashVault, '.trash', 'subject.md'))));
  });
});
