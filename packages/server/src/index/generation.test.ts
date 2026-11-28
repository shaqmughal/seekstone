import MiniSearch from 'minisearch';
import { describe, expect, it, vi } from 'vitest';
import type { ServerContext } from '../context.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import { listTags } from '../tools/list_tags.js';
import { vaultStats } from '../tools/vault_stats.js';
import { addNoteBacklinks, clearInboundBacklinks, removeNoteBacklinks } from './backlinks.js';
import { buildDoc, refreshCachedNote, removeDoc, replaceDoc, upsertDoc } from './doc.js';
import {
  bumpGeneration,
  cachedByGeneration,
  cachedResolveMaps,
  type Generational,
} from './generation.js';
import { buildAttachmentIndex } from './resolve.js';
import type { IndexedNote } from './types.js';

function ctxWith(files: Record<string, string>): ServerContext {
  const ctx: ServerContext = {
    vaultRoot: '/vault',
    index: new MiniSearch<IndexedNote>({ fields: ['title', 'body'] }),
    notes: new Map(),
    generation: 0,
    backlinks: new Map(),
    attachments: buildAttachmentIndex([]),
    unresolved: new Map(),
    policy: PERMISSIVE_POLICY,
  };
  for (const [path, raw] of Object.entries(files)) upsertDoc(ctx, buildDoc(path, raw));
  for (const [path, raw] of Object.entries(files)) addNoteBacklinks(ctx, path, raw);
  ctx.generation = 0;
  return ctx;
}

describe('cachedByGeneration', () => {
  it('builds once per generation and rebuilds after a bump', () => {
    const ctx: Generational = { generation: 0 };
    const build = vi.fn(() => ({ n: ctx.generation }));
    const first = cachedByGeneration(ctx, 'k', build);
    expect(cachedByGeneration(ctx, 'k', build)).toBe(first);
    expect(build).toHaveBeenCalledTimes(1);
    bumpGeneration(ctx);
    expect(cachedByGeneration(ctx, 'k', build)).toEqual({ n: 1 });
    expect(build).toHaveBeenCalledTimes(2);
  });

  it('keeps keys and contexts apart', () => {
    const a: Generational = { generation: 0 };
    const b: Generational = { generation: 0 };
    expect(cachedByGeneration(a, 'x', () => 'a-x')).toBe('a-x');
    expect(cachedByGeneration(a, 'y', () => 'a-y')).toBe('a-y');
    expect(cachedByGeneration(b, 'x', () => 'b-x')).toBe('b-x');
    expect(cachedByGeneration(a, 'x', () => 'other')).toBe('a-x');
  });

  it('shares one set of resolve maps until the index changes', () => {
    const ctx = ctxWith({ 'a.md': 'x', 'b.md': 'y' });
    const maps = cachedResolveMaps(ctx);
    expect(cachedResolveMaps(ctx)).toBe(maps);
    upsertDoc(ctx, buildDoc('c.md', 'z'));
    const next = cachedResolveMaps(ctx);
    expect(next).not.toBe(maps);
    expect(next.byBasename.get('c')).toEqual(['c.md']);
  });
});

describe('every index helper bumps the generation', () => {
  const cases: Array<[string, (ctx: ServerContext) => void]> = [
    ['upsertDoc (new note)', (ctx) => upsertDoc(ctx, buildDoc('new.md', 'hi'))],
    ['upsertDoc (existing note)', (ctx) => upsertDoc(ctx, buildDoc('a.md', '#tag'))],
    ['replaceDoc', (ctx) => replaceDoc(ctx, 'a.md', 'no links')],
    ['removeDoc', (ctx) => removeDoc(ctx, 'b.md')],
    ['removeDoc without parking', (ctx) => removeDoc(ctx, 'b.md', { parkInbound: false })],
    [
      'refreshCachedNote (append)',
      (ctx) => refreshCachedNote(ctx, 'b.md', 'y\nmore', { keepsLinks: true }),
    ],
    [
      'refreshCachedNote (alias change)',
      (ctx) => refreshCachedNote(ctx, 'b.md', '---\naliases: [B2]\n---\ny'),
    ],
    ['addNoteBacklinks', (ctx) => addNoteBacklinks(ctx, 'b.md', '[[a]]')],
    ['removeNoteBacklinks', (ctx) => removeNoteBacklinks(ctx, 'a.md')],
    ['clearInboundBacklinks', (ctx) => clearInboundBacklinks(ctx, 'b.md')],
  ];
  for (const [name, mutate] of cases) {
    it(name, () => {
      const ctx = ctxWith({ 'a.md': 'see [[b]]', 'b.md': 'y' });
      const before = ctx.generation;
      mutate(ctx);
      expect(ctx.generation).toBeGreaterThan(before);
    });
  }

  it('leaves the generation alone when nothing changes', () => {
    const ctx = ctxWith({ 'a.md': 'no links', 'b.md': 'y' });
    removeDoc(ctx, 'missing.md');
    removeNoteBacklinks(ctx, 'a.md');
    addNoteBacklinks(ctx, 'a.md', 'no links');
    clearInboundBacklinks(ctx, 'nobody-links-here.md');
    refreshCachedNote(ctx, 'missing.md', 'x');
    expect(ctx.generation).toBe(0);
  });
});

describe('cached tools see in-place updates', () => {
  it('list_tags and vault_stats pick up a tag added by refreshCachedNote', () => {
    const ctx = ctxWith({ 'a.md': '#one', 'b.md': 'y' });
    expect(listTags(ctx, { sort: 'count' }).tags.map((t) => t.tag)).toEqual(['one']);
    expect(vaultStats(ctx).tags).toEqual({ unique: 1, tagged: 1 });
    refreshCachedNote(ctx, 'b.md', 'y #two', { keepsLinks: true });
    expect(listTags(ctx, { sort: 'name' }).tags.map((t) => t.tag)).toEqual(['one', 'two']);
    expect(vaultStats(ctx).tags).toEqual({ unique: 2, tagged: 2 });
  });
});
