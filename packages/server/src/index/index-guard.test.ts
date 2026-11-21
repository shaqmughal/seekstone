import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Static guard for the index generation (SHA-461). list_tags, vault_stats and
 * get_links cache by ctx.generation, so a change to ctx.notes or
 * ctx.backlinks that skips the bump serves stale results. Only the helpers in
 * index/doc.ts (notes) and index/backlinks.ts (refs) may change them; every
 * other file goes through those helpers.
 */
const srcRoot = join(import.meta.dirname, '..');
const ALLOWED: Record<string, string[]> = {
  notes: ['index/doc.ts'],
  backlinks: ['index/doc.ts', 'index/backlinks.ts'],
};
// `this.notes` in semantic/store.ts is the embedding store's own map.
const MUTATION = /(?<!\bthis)\.(notes|backlinks)\.(set|delete|clear)\(/g;

function sources(): Array<{ file: string; src: string }> {
  return (readdirSync(srcRoot, { recursive: true }) as string[])
    .map((f) => f.split('\\').join('/'))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.bench.ts'))
    .map((f) => ({ file: f, src: readFileSync(join(srcRoot, f), 'utf8') }));
}

function offenders(files: Array<{ file: string; src: string }>): string[] {
  const out: string[] = [];
  for (const { file, src } of files) {
    for (const m of src.matchAll(MUTATION)) {
      const field = m[1] as string;
      if (ALLOWED[field]?.includes(file)) continue;
      const line = src.slice(0, m.index).split('\n').length;
      out.push(`${file}:${line} ${m[0]}`);
    }
  }
  return out;
}

describe('index guard', () => {
  it('finds the source files', () => {
    const files = sources().map((s) => s.file);
    expect(files).toContain('index/doc.ts');
    expect(files).toContain('tools/move_note.ts');
  });

  it('only the index/doc.ts and index/backlinks.ts helpers change ctx.notes or ctx.backlinks', () => {
    expect(offenders(sources())).toEqual([]);
  });

  it('flags a direct change anywhere else', () => {
    const planted = [
      { file: 'tools/x.ts', src: 'ctx.notes.set(p, doc);\nctx.notes.delete(p);' },
      { file: 'tools/y.ts', src: 'ctx.backlinks.delete(p);\nc.notes.clear();' },
      { file: 'semantic/store.ts', src: 'this.notes.set(p, v);' },
      { file: 'index/backlinks.ts', src: 'ctx.notes.set(p, doc);' },
    ];
    expect(offenders(planted)).toEqual([
      'tools/x.ts:1 .notes.set(',
      'tools/x.ts:2 .notes.delete(',
      'tools/y.ts:1 .backlinks.delete(',
      'tools/y.ts:2 .notes.clear(',
      'index/backlinks.ts:1 .notes.set(',
    ]);
  });
});
