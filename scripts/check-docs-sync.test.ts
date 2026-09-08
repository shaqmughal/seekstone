import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkNumbers, figureCount, fmtBytesShort, fmtMsCell } from './benchmarks-guard.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const bench = JSON.parse(readFileSync(join(root, 'benchmarks.json'), 'utf8'));
const real = (p: string) => readFileSync(join(root, p), 'utf8');
const withReadme = (readme: string) => (p: string) => (p === 'README.md' ? readme : real(p));

describe('benchmarks guard (docs-sync check 4)', () => {
  it('the committed docs match benchmarks.json', () => {
    expect(checkNumbers(bench, real)).toEqual([]);
    expect(figureCount(bench)).toBeGreaterThan(50);
  });

  it('fails on a deliberately perturbed README number', () => {
    const readme = real('README.md');
    const target = '| Warm search latency @ 10k notes | **5.2 ms** |';
    expect(readme).toContain(target);
    const errs = checkNumbers(
      bench,
      withReadme(readme.replace(target, target.replace('5.2', '6.2'))),
    );
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(
      /^README\.md:\d+ "comparison table latency row" says 6\.2 but benchmarks\.json says 5\.2$/,
    );
  });

  it('fails on a perturbed table cell, naming the row', () => {
    const readme = real('README.md');
    const target = '| obsidian-tc | 263 | 1,253 | 2,667 | ~514× slower |';
    expect(readme).toContain(target);
    const errs = checkNumbers(
      bench,
      withReadme(readme.replace(target, target.replace('~514×', '~440×'))),
    );
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(
      /latency table row "obsidian-tc" says ~440× slower but benchmarks\.json says ~514× slower/,
    );
  });

  it('fails loudly when an anchored sentence is rewritten away', () => {
    const readme = real('README.md').replace(
      'up to a **~47,000× reduction**',
      'up to a huge reduction',
    );
    const errs = checkNumbers(bench, withReadme(readme));
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(/README\.md: pattern for "context bullet" not found/);
  });

  it('formats cells the way the README tables do', () => {
    expect(fmtBytesShort(1636)).toBe('1.6 KB');
    expect(fmtBytesShort(47729)).toBe('47 KB');
    expect(fmtBytesShort(10254323)).toBe('9.8 MB');
    expect(fmtBytesShort(99144477)).toBe('95 MB');
    expect(fmtMsCell(5.2)).toBe('5.2');
    expect(fmtMsCell(1550.4)).toBe('1,550');
  });
});
