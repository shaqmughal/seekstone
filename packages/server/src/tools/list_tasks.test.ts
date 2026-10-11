import MiniSearch from 'minisearch';
import { describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import { buildDoc } from '../index/doc.js';
import type { IndexedNote } from '../index/types.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import { ListTasksInput, listTasks } from './list_tasks.js';

function buildCtx(notes: { path: string; raw: string; mtimeMs?: number }[]): ServerContext {
  const index = new MiniSearch<IndexedNote>({
    idField: 'id',
    fields: ['title', 'body', 'tags', 'fmKeys'],
    storeFields: ['id', 'title', 'tags', 'sizeBytes', 'mtimeMs'],
    searchOptions: { boost: { title: 3, tags: 2, body: 1 }, fuzzy: 0.2, prefix: true },
  });
  const notesMap = new Map<string, IndexedNote>();
  for (const n of notes) {
    const doc = buildDoc(n.path, n.raw);
    if (n.mtimeMs !== undefined) doc.mtimeMs = n.mtimeMs;
    notesMap.set(n.path, doc);
    index.add(doc);
  }
  return {
    vaultRoot: '/vault',
    index,
    notes: notesMap,
    backlinks: new Map(),
    policy: PERMISSIVE_POLICY,
  } as ServerContext;
}

const MIXED = [
  '# Inbox',
  '- [ ] open one',
  '- [x] done one',
  '* [/] custom slash',
  '+ [-] custom dash',
  '  - [ ] nested child',
  '```',
  '- [ ] fenced decoy',
  '```',
  '`- [ ] inline decoy`',
].join('\n');

describe('listTasks', () => {
  it('finds -, *, + bullets at any indent and skips fenced/inline code', () => {
    const ctx = buildCtx([{ path: 'a.md', raw: MIXED }]);
    const { tasks, total } = listTasks(ctx, { state: 'any', limit: 100 });
    expect(total).toBe(5);
    expect(tasks.map((t) => t.text)).toEqual([
      'open one',
      'done one',
      'custom slash',
      'custom dash',
      'nested child',
    ]);
  });

  it('reports nested tasks as individual rows with the enclosing heading', () => {
    const ctx = buildCtx([{ path: 'a.md', raw: MIXED }]);
    const { tasks } = listTasks(ctx, { state: 'any', limit: 100 });
    for (const t of tasks) expect(t.heading).toBe('Inbox');
  });

  it('omits heading for tasks above the first heading', () => {
    const ctx = buildCtx([{ path: 'a.md', raw: '- [ ] orphan\n# H\n- [ ] titled' }]);
    const { tasks } = listTasks(ctx, { state: 'any', limit: 100 });
    expect(tasks[0]?.heading).toBeUndefined();
    expect(tasks[1]?.heading).toBe('H');
  });

  it('defaults to open tasks only', () => {
    const ctx = buildCtx([{ path: 'a.md', raw: MIXED }]);
    const { tasks } = listTasks(ctx, { state: 'open', limit: 100 });
    expect(tasks.map((t) => t.text)).toEqual(['open one', 'nested child']);
  });

  it('treats done as x or X and supports single-char custom markers', () => {
    const ctx = buildCtx([{ path: 'a.md', raw: '- [x] lower\n- [X] upper\n- [/] slash' }]);
    expect(listTasks(ctx, { state: 'done', limit: 100 }).tasks.map((t) => t.text)).toEqual([
      'lower',
      'upper',
    ]);
    expect(listTasks(ctx, { state: '/', limit: 100 }).tasks.map((t) => t.text)).toEqual(['slash']);
  });

  it('scopes to a single note via path', () => {
    const ctx = buildCtx([
      { path: 'a.md', raw: '- [ ] in a' },
      { path: 'b.md', raw: '- [ ] in b' },
    ]);
    const { tasks } = listTasks(ctx, { path: 'b.md', state: 'open', limit: 100 });
    expect(tasks).toEqual([{ path: 'b.md', line: 1, state: ' ', text: 'in b' }]);
  });

  it('throws note_not_found for an unknown path', () => {
    const ctx = buildCtx([{ path: 'a.md', raw: '- [ ] x' }]);
    expect(() => listTasks(ctx, { path: 'missing.md', state: 'open', limit: 100 })).toThrow(
      /note_not_found/,
    );
  });

  it('filters by folder prefix', () => {
    const ctx = buildCtx([
      { path: 'daily/2026-10-01.md', raw: '- [ ] daily task' },
      { path: 'projects/p.md', raw: '- [ ] project task' },
    ]);
    const { tasks } = listTasks(ctx, { folder: 'daily/', state: 'open', limit: 100 });
    expect(tasks.map((t) => t.path)).toEqual(['daily/2026-10-01.md']);
  });

  it('filters by tag, including nested child tags', () => {
    const ctx = buildCtx([
      { path: 'a.md', raw: '#project/alpha\n- [ ] tagged' },
      { path: 'b.md', raw: '- [ ] untagged' },
    ]);
    const { tasks } = listTasks(ctx, { tag: 'project', state: 'open', limit: 100 });
    expect(tasks.map((t) => t.text)).toEqual(['tagged']);
  });

  it('suggests tags on an empty result for an unknown tag (query_notes parity)', () => {
    const ctx = buildCtx([{ path: 'a.md', raw: '#project\n- [ ] x' }]);
    expect(() => listTasks(ctx, { tag: 'projct', state: 'open', limit: 100 })).toThrow(
      /unknown_tag/,
    );
  });

  it('filters by modifiedAfter against note mtime', () => {
    const ctx = buildCtx([
      { path: 'old.md', raw: '- [ ] stale', mtimeMs: Date.UTC(2026, 0, 1) },
      { path: 'new.md', raw: '- [ ] fresh', mtimeMs: Date.UTC(2026, 9, 1) },
    ]);
    const { tasks } = listTasks(ctx, {
      modifiedAfter: '2026-06-01',
      state: 'open',
      limit: 100,
    });
    expect(tasks.map((t) => t.path)).toEqual(['new.md']);
  });

  it('sorts by path then line, deterministically', () => {
    const ctx = buildCtx([
      { path: 'b.md', raw: '- [ ] b1\n- [ ] b2' },
      { path: 'a.md', raw: 'x\n- [ ] a1' },
    ]);
    const { tasks } = listTasks(ctx, { state: 'open', limit: 100 });
    expect(tasks.map((t) => `${t.path}:${t.line}`)).toEqual(['a.md:2', 'b.md:1', 'b.md:2']);
  });

  it('applies limit and reports total + truncated', () => {
    const raw = Array.from({ length: 5 }, (_, i) => `- [ ] t${i}`).join('\n');
    const ctx = buildCtx([{ path: 'a.md', raw }]);
    const result = listTasks(ctx, { state: 'open', limit: 2 });
    expect(result.tasks).toHaveLength(2);
    expect(result.total).toBe(5);
    expect(result.truncated).toBe(true);

    const all = listTasks(ctx, { state: 'open', limit: 100 });
    expect(all.truncated).toBe(false);
  });

  it('skips checkboxes inside frontmatter', () => {
    const ctx = buildCtx([{ path: 'a.md', raw: '---\nnote: "- [ ] not a task"\n---\n- [ ] real' }]);
    const { tasks } = listTasks(ctx, { state: 'open', limit: 100 });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.line).toBe(4);
  });

  it('returns line numbers that point at the actual file line', () => {
    const raw = '---\ntitle: t\n---\n\n# H\n\n- [ ] target';
    const ctx = buildCtx([{ path: 'a.md', raw }]);
    const { tasks } = listTasks(ctx, { state: 'open', limit: 100 });
    const [task] = tasks;
    if (!task) throw new Error('expected exactly one task');
    expect(raw.split('\n')[task.line - 1]).toBe('- [ ] target');
  });

  it('schema rejects an unparseable modifiedAfter and accepts an ISO one', () => {
    const bad = ListTasksInput.safeParse({ state: 'open', limit: 10, modifiedAfter: 'not-a-date' });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.map((i) => i.message)).toContain('not a parseable date');
    }

    const good = ListTasksInput.safeParse({
      state: 'open',
      limit: 10,
      modifiedAfter: '2026-10-01T00:00:00Z',
    });
    expect(good.success).toBe(true);
  });
});
