import { describe, expect, it } from 'vitest';
import { HANDLED_TOOLS, WRITE_TOOLS } from './dispatch.js';
import { PERMISSIVE_POLICY } from './policy.js';
import { ALL_TOOLS, visibleTools } from './tool-list.js';

describe('ALL_TOOLS', () => {
  it('matches HANDLED_TOOLS exactly (names and count)', () => {
    const listed = ALL_TOOLS.map((t) => t.name).sort();
    expect(listed).toEqual([...HANDLED_TOOLS].sort());
  });
  it('every WRITE_TOOLS entry is a real tool', () => {
    const names = new Set(ALL_TOOLS.map((t) => t.name));
    for (const w of WRITE_TOOLS) expect(names.has(w)).toBe(true);
  });
  it('advertises conservative safety annotations for every tool', () => {
    const annotations = Object.fromEntries(ALL_TOOLS.map((tool) => [tool.name, tool.annotations]));

    for (const name of [
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
    ]) {
      expect(annotations[name]).toEqual({ readOnlyHint: true, openWorldHint: false });
    }

    for (const name of ['append_note', 'append_periodic_note']) {
      expect(annotations[name]).toEqual({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      });
    }

    for (const name of [
      'create_note',
      'delete_note',
      'move_note',
      'rename_heading',
      'patch_note',
      'replace_in_note',
      'undo_write',
    ]) {
      expect(annotations[name]).toEqual({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      });
    }

    expect(annotations.patch_frontmatter).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(annotations.get_periodic_note).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    });
  });
});

describe('visibleTools', () => {
  it('returns all 21 tools under a permissive policy', () => {
    expect(visibleTools(PERMISSIVE_POLICY)).toHaveLength(21);
  });
  it('unregisters the 10 write tools in read-only mode', () => {
    const visible = visibleTools({ readOnly: true });
    expect(visible).toHaveLength(11);
    // list_writes is a read tool and stays visible; undo_write is a write.
    expect(visible.map((t) => t.name)).toContain('list_writes');
    expect(visible.map((t) => t.name)).not.toContain('undo_write');
    for (const t of visible) expect(WRITE_TOOLS.has(t.name)).toBe(false);
    // get_periodic_note stays listed — it is a read tool; its createIfMissing
    // side-effect is neutralized at dispatch.
    expect(visible.map((t) => t.name)).toContain('get_periodic_note');
  });
  it('write-path scoping alone hides nothing', () => {
    expect(visibleTools({ readOnly: false, writeGlobs: ['journal/**'] })).toHaveLength(21);
  });
});
