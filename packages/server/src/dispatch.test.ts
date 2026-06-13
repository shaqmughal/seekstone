import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ServerContext } from './context.js';
import { dispatch, HANDLED_TOOLS } from './dispatch.js';
import { buildIndex } from './index/build.js';
import type { Logger } from './log.js';
import { createLogger } from './log.js';

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
  const { index, notes } = await buildIndex(vaultRoot);
  ctx = { vaultRoot, index, notes, backlinks: new Map() };
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
