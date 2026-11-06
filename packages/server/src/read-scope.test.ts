import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ServerContext } from './context.js';
import { dispatch, HANDLED_TOOLS, WRITE_TOOLS } from './dispatch.js';
import { buildIndex } from './index/build.js';
import { Journal } from './journal.js';
import type { Logger } from './log.js';
import { PERMISSIVE_POLICY, parseWritePolicy, readScopeWalk, type WritePolicy } from './policy.js';
import { scopeWarnings } from './scope-warnings.js';
import { startWatcher } from './watcher.js';

/**
 * End-to-end read scope (SHA-291): a vault with a hidden `journal/` folder,
 * every tool driven through dispatch, and a sentinel string planted in every
 * part of the hidden note that a tool could surface.
 */

const SENTINEL = 'zzsentinelqq';
const SCOPE = 'notes/**';

const quiet: Logger = {
  level: 'error',
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};

let vault: string;

async function put(rel: string, body: string): Promise<void> {
  await mkdir(join(vault, rel, '..'), { recursive: true });
  await writeFile(join(vault, rel), body, 'utf8');
}

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'seekstone-readscope-'));
  await put(
    'notes/visible.md',
    '# Visible\nSee [[secret]] and [[ghost]]. #public\n\n- [ ] visible task\n',
  );
  await put('notes/other.md', '# Other\nBack to [[visible]].\n');
  await put(
    'journal/secret.md',
    `---\ntitle: ${SENTINEL} title\nmood: ${SENTINEL}\n---\n# ${SENTINEL} heading\nBody ${SENTINEL} text #${SENTINEL}tag\nLinks to [[visible]].\n\n- [ ] ${SENTINEL} task\n`,
  );
  await put('journal/template.md', `${SENTINEL} template body\n`);
  await put(
    '.obsidian/daily-notes.json',
    JSON.stringify({ folder: 'notes/daily', format: 'YYYY-MM-DD', template: 'journal/template' }),
  );
});

afterEach(async () => {
  await rm(vault, { recursive: true, force: true });
});

async function ctxFor(policy: WritePolicy, journal = true): Promise<ServerContext> {
  const built = await buildIndex(vault, readScopeWalk(policy));
  const ctx: ServerContext = { vaultRoot: vault, ...built, policy };
  if (journal) ctx.journal = await Journal.open(vault, { maxBytes: 1e9, maxEntries: 1e6 });
  return ctx;
}

async function call(ctx: ServerContext, tool: string, args: Record<string, unknown>) {
  const res = await dispatch(ctx, tool, args, quiet);
  return { text: res.content.map((c) => c.text).join('\n'), isError: res.isError === true };
}

/** One probing call per tool: each asks for exactly what a leak would show. */
function probes(target: string): Array<[string, Record<string, unknown>]> {
  return [
    ['search', { query: SENTINEL }],
    ['search', { query: 'Body text' }],
    ['query_notes', { where: { mood: SENTINEL } }],
    ['query_notes', {}],
    ['context_pack', { query: SENTINEL }],
    ['read_note', { path: target }],
    ['read_notes', { items: [{ path: target }, { path: 'notes/visible.md' }] }],
    ['list_notes', {}],
    ['list_tags', {}],
    ['list_tasks', {}],
    ['outline_note', { path: target }],
    ['get_backlinks', { path: 'notes/visible.md' }],
    ['get_backlinks', { path: target }],
    ['get_links', { path: 'notes/visible.md' }],
    ['get_links', { path: target }],
    ['resolve_note', { reference: 'secret' }],
    ['get_periodic_note', { date: '2026-01-02' }],
    ['list_writes', {}],
    ['create_note', { path: target, content: 'x' }],
    ['delete_note', { path: target }],
    ['move_note', { from: target, to: 'notes/moved.md' }],
    ['rename_heading', { path: target, oldHeading: `${SENTINEL} heading`, newHeading: 'h' }],
    ['append_note', { path: target, content: 'x' }],
    ['patch_frontmatter', { path: target, patch: { a: 1 } }],
    ['patch_note', { path: target, target: { heading: 'h' }, operation: 'append', content: 'x' }],
    ['replace_in_note', { path: target, find: 'Body', replace: 'B' }],
    ['update_task', { path: target, line: 9, state: 'x' }],
    ['append_periodic_note', { date: '2026-01-03', content: 'x' }],
    ['undo_write', {}],
  ];
}

describe('read scope: nothing hidden crosses the tool boundary', () => {
  it('probes cover every handled tool', () => {
    const probed = new Set(probes('x').map(([t]) => t));
    expect(HANDLED_TOOLS.filter((t) => !probed.has(t))).toEqual([]);
  });

  it('control: without a read scope the probes DO surface the sentinel', async () => {
    const ctx = await ctxFor(PERMISSIVE_POLICY, false);
    const { text } = await call(ctx, 'search', { query: SENTINEL });
    expect(text).toContain(SENTINEL);
  });

  it('no response from any tool contains the sentinel', async () => {
    // Journal an edit to the hidden note while unscoped, so list_writes /
    // undo_write have a hidden entry to (not) show.
    const before = await ctxFor(PERMISSIVE_POLICY);
    expect(
      (await call(before, 'append_note', { path: 'journal/secret.md', content: SENTINEL })).isError,
    ).toBe(false);

    const ctx = await ctxFor(parseWritePolicy({ SEEKSTONE_READ_PATHS: SCOPE }));
    const corpus: string[] = [];
    for (const [tool, args] of probes('journal/secret.md')) {
      const { text } = await call(ctx, tool, args);
      corpus.push(`${tool}: ${text}`);
    }
    const leaks = corpus.filter((t) => t.includes(SENTINEL));
    expect(leaks).toEqual([]);
    // The hidden note's bytes are untouched by the refused writes.
    expect(await readFile(join(vault, 'journal/secret.md'), 'utf8')).toContain(SENTINEL);
  });

  it('listings never name the hidden folder', async () => {
    const ctx = await ctxFor(parseWritePolicy({ SEEKSTONE_READ_PATHS: SCOPE }));
    for (const tool of ['list_notes', 'list_tags', 'list_tasks', 'query_notes']) {
      expect((await call(ctx, tool, {})).text).not.toContain('journal/');
    }
    expect((await call(ctx, 'get_backlinks', { path: 'notes/visible.md' })).text).not.toContain(
      'journal/',
    );
  });
});

describe('read scope: a hidden note is indistinguishable from a missing one', () => {
  const READS: Array<[string, (p: string) => Record<string, unknown>]> = [
    ['read_note', (p) => ({ path: p })],
    ['outline_note', (p) => ({ path: p })],
    ['read_notes', (p) => ({ items: [{ path: p }] })],
    ['get_links', (p) => ({ path: p })],
    ['get_backlinks', (p) => ({ path: p })],
  ];

  it.each(READS)('%s gives the same response for hidden and missing paths', async (tool, args) => {
    const ctx = await ctxFor(parseWritePolicy({ SEEKSTONE_READ_PATHS: SCOPE }), false);
    const hidden = await call(ctx, tool, args('journal/secret.md'));
    const missing = await call(ctx, tool, args('journal/nope.md'));
    expect(hidden.isError).toBe(missing.isError);
    expect(hidden.text.replaceAll('secret.md', 'X')).toBe(missing.text.replaceAll('nope.md', 'X'));
  });

  it('every write tool refuses a hidden path with the read-scope message and the same text as a missing one', async () => {
    const ctx = await ctxFor(parseWritePolicy({ SEEKSTONE_READ_PATHS: SCOPE }), false);
    for (const [tool, args] of probes('journal/secret.md')) {
      if (!WRITE_TOOLS.has(tool) || tool === 'undo_write' || tool === 'append_periodic_note')
        continue;
      const hidden = await call(ctx, tool, args);
      const missingArgs = JSON.parse(JSON.stringify(args).replaceAll('secret.md', 'nope.md'));
      const missing = await call(ctx, tool, missingArgs);
      expect(hidden.isError, tool).toBe(true);
      expect(hidden.text, tool).toContain('outside SEEKSTONE_READ_PATHS');
      expect(hidden.text.replaceAll('secret.md', 'X'), tool).toBe(
        missing.text.replaceAll('nope.md', 'X'),
      );
    }
  });

  it('links into the hidden folder resolve exactly like links to nothing', async () => {
    const ctx = await ctxFor(parseWritePolicy({ SEEKSTONE_READ_PATHS: SCOPE }), false);
    const { links } = JSON.parse(
      (await call(ctx, 'get_links', { path: 'notes/visible.md' })).text,
    ) as {
      links: Array<{ target: string; resolved: boolean }>;
    };
    const byRaw = (t: string) => links.find((l) => JSON.stringify(l).includes(t));
    expect(byRaw('secret')?.resolved).toBe(false);
    expect(byRaw('ghost')?.resolved).toBe(false);
  });
});

describe('read scope: write scope is the intersection (D1)', () => {
  it('a write glob that reaches outside the read scope cannot write there', async () => {
    const policy = parseWritePolicy({
      SEEKSTONE_READ_PATHS: SCOPE,
      SEEKSTONE_WRITE_PATHS: 'journal/**,notes/**',
    });
    const ctx = await ctxFor(policy, false);
    const res = await call(ctx, 'create_note', { path: 'journal/new.md', content: 'x' });
    expect(res.isError).toBe(true);
    expect(res.text).toContain('outside SEEKSTONE_READ_PATHS');
    await expect(readdir(join(vault, 'journal'))).resolves.not.toContain('new.md');
    expect((await call(ctx, 'create_note', { path: 'notes/new.md', content: 'x' })).isError).toBe(
      false,
    );
  });
});

describe('read scope: journal entries for hidden paths are hidden (D3)', () => {
  it('list_writes omits them, undo_write cannot find them, and "latest" skips them', async () => {
    const open = await ctxFor(PERMISSIVE_POLICY);
    await call(open, 'append_note', { path: 'notes/visible.md', content: 'v' }); // seq 1
    await call(open, 'append_note', { path: 'journal/secret.md', content: 'h' }); // seq 2

    const ctx = await ctxFor(parseWritePolicy({ SEEKSTONE_READ_PATHS: SCOPE }));
    const listed = JSON.parse((await call(ctx, 'list_writes', {})).text) as {
      writes: Array<{ seq: number; paths: string[] }>;
      total: number;
    };
    expect(listed.writes.map((w) => w.seq)).toEqual([1]);
    expect(listed.total).toBe(1);

    const bySeq = await call(ctx, 'undo_write', { seq: 2 });
    expect(bySeq.isError).toBe(true);
    expect(bySeq.text).toContain('Journal entry 2 not found.');
    expect((await call(ctx, 'undo_write', { seq: 99 })).text).toContain(
      'Journal entry 99 not found.',
    );

    const latest = JSON.parse((await call(ctx, 'undo_write', {})).text) as {
      seq?: number;
      undid?: number;
    };
    expect(JSON.stringify(latest)).toContain('1');
    expect(await readFile(join(vault, 'journal/secret.md'), 'utf8')).toMatch(/h\n?$/);
  });
});

describe('read scope: periodic notes (D4)', () => {
  it('creates the daily note without a template that lies outside the read scope', async () => {
    const ctx = await ctxFor(parseWritePolicy({ SEEKSTONE_READ_PATHS: SCOPE }), false);
    const res = await call(ctx, 'get_periodic_note', { date: '2026-01-02', createIfMissing: true });
    expect(res.isError).toBe(false);
    const created = await readFile(join(vault, 'notes/daily/2026-01-02.md'), 'utf8');
    expect(created).not.toContain(SENTINEL);
  });

  it('reports a hidden periodic note as missing rather than probing it', async () => {
    await put(
      '.obsidian/daily-notes.json',
      JSON.stringify({ folder: 'journal', format: 'YYYY-MM-DD' }),
    );
    await put('journal/2026-01-02.md', 'exists\n');
    const ctx = await ctxFor(parseWritePolicy({ SEEKSTONE_READ_PATHS: SCOPE }), false);
    const res = JSON.parse((await call(ctx, 'get_periodic_note', { date: '2026-01-02' })).text) as {
      existed: boolean;
    };
    expect(res.existed).toBe(false);
  });
});

describe('read scope: boot warnings', () => {
  it('warns about write globs outside the read scope and an unreadable template', async () => {
    const warnings = await scopeWarnings(
      vault,
      parseWritePolicy({ SEEKSTONE_READ_PATHS: SCOPE, SEEKSTONE_WRITE_PATHS: 'journal/**' }),
    );
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/^2 file\(s\) match SEEKSTONE_WRITE_PATHS/);
    expect(warnings[1]).toContain('daily note template "journal/template.md"');
  });

  it('is silent when unscoped or when everything lines up', async () => {
    expect(await scopeWarnings(vault, PERMISSIVE_POLICY)).toEqual([]);
    await put('.obsidian/daily-notes.json', JSON.stringify({ template: 'notes/tpl' }));
    expect(
      await scopeWarnings(
        vault,
        parseWritePolicy({ SEEKSTONE_READ_PATHS: SCOPE, SEEKSTONE_WRITE_PATHS: 'notes/**' }),
      ),
    ).toEqual([]);
  });
});

describe('read scope: index and watcher', () => {
  it('the index never contains hidden notes', async () => {
    const ctx = await ctxFor(parseWritePolicy({ SEEKSTONE_READ_PATHS: SCOPE }), false);
    expect([...ctx.notes.keys()].sort()).toEqual(['notes/other.md', 'notes/visible.md']);
    expect(ctx.backlinks.get('notes/visible.md')?.map((b) => b.path)).toEqual(['notes/other.md']);
  });

  it('the watcher ignores edits to hidden files', async () => {
    const ctx = await ctxFor(parseWritePolicy({ SEEKSTONE_READ_PATHS: SCOPE }), false);
    const seen: string[] = [];
    const w = startWatcher(ctx, undefined, {
      usePolling: true,
      pollInterval: 50,
      onRawEvent: (_e, _abs, rel) => seen.push(rel),
    });
    await w.ready;
    try {
      await put('journal/late.md', `# ${SENTINEL}\n`);
      await put('notes/late.md', '# late\n');
      const deadline = Date.now() + 10_000;
      while (!ctx.notes.has('notes/late.md') || !seen.includes('journal/late.md')) {
        if (Date.now() > deadline) throw new Error('watcher timeout');
        await new Promise((r) => setTimeout(r, 25));
      }
      expect(ctx.notes.has('journal/late.md')).toBe(false);
    } finally {
      await w.stop();
    }
  });
});
