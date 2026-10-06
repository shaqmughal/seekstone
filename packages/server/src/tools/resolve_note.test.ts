import MiniSearch from 'minisearch';
import { describe, expect, it } from 'vitest';
import type { ServerContext } from '../context.js';
import { resolveLink } from '../index/resolve.js';
import type { IndexedNote } from '../index/types.js';
import { PERMISSIVE_POLICY } from '../policy.js';
import { ResolveNoteInput, resolveNote } from './resolve_note.js';

function buildCtx(
  notes: Array<{ id: string; fm?: Record<string, unknown> | null }>,
): ServerContext {
  const index = new MiniSearch<IndexedNote>({ idField: 'id', fields: ['title', 'body'] });
  const notesMap = new Map<string, IndexedNote>();
  for (const n of notes) {
    const title = n.id.replace(/\.md$/i, '').split('/').pop() ?? n.id;
    notesMap.set(n.id, {
      id: n.id,
      title,
      body: '',
      tags: '',
      fmKeys: '',
      fm: n.fm ?? null,
      raw: '',
      sizeBytes: 0,
      mtimeMs: 0,
    });
  }
  return {
    vaultRoot: '/tmp/x',
    index,
    notes: notesMap,
    backlinks: new Map(),
    policy: PERMISSIVE_POLICY,
  };
}

const CTX = buildCtx([
  { id: 'Projects/Core.md' },
  { id: 'Home.md' },
  { id: 'People/Robert.md', fm: { aliases: ['Bob', 'Robert Smith'] } },
]);

describe('resolveNote', () => {
  it('resolves an exact basename to the matching note', () => {
    const r = resolveNote(CTX, ResolveNoteInput.parse({ reference: 'Core' }));
    expect(r).toEqual({
      reference: 'Core',
      matches: [{ path: 'Projects/Core.md', via: 'basename' }],
      ambiguous: false,
    });
  });

  it('resolves a frontmatter alias to its owning note, reporting the alias verbatim', () => {
    const r = resolveNote(CTX, ResolveNoteInput.parse({ reference: 'bob' }));
    expect(r.matches).toEqual([{ path: 'People/Robert.md', via: 'alias', alias: 'Bob' }]);
    expect(r.ambiguous).toBe(false);
  });

  it('lists both notes sharing a basename with ambiguous: true', () => {
    const ctx = buildCtx([{ id: 'a/Note.md' }, { id: 'z/Note.md' }]);
    const r = resolveNote(ctx, ResolveNoteInput.parse({ reference: 'Note' }));
    expect(r.matches).toEqual([
      { path: 'a/Note.md', via: 'basename' },
      { path: 'z/Note.md', via: 'basename' },
    ]);
    expect(r.ambiguous).toBe(true);
  });

  it('matches[0] is exactly what the link index resolves (no divergent resolvers)', () => {
    for (const reference of [
      'Projects/Core.md',
      'Projects/Core',
      'Core',
      'core',
      'projects/core',
      'Bob',
      'Robert Smith',
      'Home',
      'Missing',
    ]) {
      const r = resolveNote(CTX, ResolveNoteInput.parse({ reference }));
      expect(r.matches[0]?.path).toBe(resolveLink(reference, CTX.notes));
    }
  });

  it('exact path reports via "path"; a case-variant path dedupes to its basename tier', () => {
    expect(resolveNote(CTX, { reference: 'Projects/Core.md' }).matches).toEqual([
      { path: 'Projects/Core.md', via: 'path' },
    ]);
    // Any path-without-extension match is also a basename match, and dedupe
    // keeps the higher tier — mirroring the resolver's "basename beats
    // path-no-ext" precedence.
    expect(resolveNote(CTX, { reference: 'projects/core' }).matches).toEqual([
      { path: 'Projects/Core.md', via: 'basename' },
    ]);
  });

  it('returns empty matches for an unresolvable reference, not an error', () => {
    const r = resolveNote(CTX, ResolveNoteInput.parse({ reference: 'zzz-no-such-note-zzz' }));
    expect(r.matches).toEqual([]);
    expect(r.ambiguous).toBe(false);
    expect(r.didYouMean).toBeUndefined();
  });

  it('suggests close basenames and aliases on a typo', () => {
    expect(resolveNote(CTX, { reference: 'Cora' }).didYouMean).toEqual(['Core']);
    expect(resolveNote(CTX, { reference: 'Bbo' }).didYouMean).toContain('Bob');
  });

  it('omits didYouMean when matches exist', () => {
    const r = resolveNote(CTX, { reference: 'Core' });
    expect(r.didYouMean).toBeUndefined();
  });

  it('ordering is deterministic regardless of notes-map insertion order', () => {
    const forward = buildCtx([{ id: 'a/Note.md' }, { id: 'z/Note.md' }]);
    const reverse = buildCtx([{ id: 'z/Note.md' }, { id: 'a/Note.md' }]);
    expect(resolveNote(forward, { reference: 'Note' })).toEqual(
      resolveNote(reverse, { reference: 'Note' }),
    );
  });

  it('rejects an empty reference at the schema boundary', () => {
    expect(() => ResolveNoteInput.parse({ reference: '' })).toThrow();
  });
});
