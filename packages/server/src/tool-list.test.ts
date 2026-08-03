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
});

describe('visibleTools', () => {
  it('returns all 17 tools under a permissive policy', () => {
    expect(visibleTools(PERMISSIVE_POLICY)).toHaveLength(17);
  });
  it('unregisters the 8 write tools in read-only mode', () => {
    const visible = visibleTools({ readOnly: true });
    expect(visible).toHaveLength(9);
    for (const t of visible) expect(WRITE_TOOLS.has(t.name)).toBe(false);
    // get_periodic_note stays listed — it is a read tool; its createIfMissing
    // side-effect is neutralized at dispatch.
    expect(visible.map((t) => t.name)).toContain('get_periodic_note');
  });
  it('write-path scoping alone hides nothing', () => {
    expect(visibleTools({ readOnly: false, writeGlobs: ['journal/**'] })).toHaveLength(17);
  });
});
