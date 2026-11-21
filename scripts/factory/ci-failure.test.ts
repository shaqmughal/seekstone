import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  codspeedSection,
  formatFailures,
  LOG_LINES,
  parseCodspeed,
  prMarkdown,
  RAW_CHARS,
  tailLog,
} from './ci-failure.mjs';

// CodSpeed's comment on PR #476 while it reported the regression.
const REGRESSION = readFileSync(
  new URL('./fixtures/codspeed-regression.md', import.meta.url),
  'utf8',
);

describe('tailLog', () => {
  it('keeps the last lines and drops Actions timestamps', () => {
    const text = Array.from(
      { length: LOG_LINES + 10 },
      (_, i) => `2026-11-15T19:57:30.5910169Z line ${i}`,
    ).join('\r\n');
    const out = tailLog(text).split('\n');
    expect(out).toHaveLength(LOG_LINES);
    expect(out[0]).toBe('line 10');
    expect(out.at(-1)).toBe(`line ${LOG_LINES + 9}`);
  });
});

describe('formatFailures', () => {
  it('lists each check with its log or summary', () => {
    const md = formatFailures([
      { name: 'test (ubuntu-latest)', url: 'https://x/1', log: 'FAIL a.test.ts' },
      { name: 'CodSpeed Performance Analysis', url: 'https://x/2', summary: '1 regression' },
      { name: 'quality rules', url: 'https://x/3' },
      { name: 'CodSpeed again', url: 'https://x/4', summary: 's', codspeed: 'TABLE' },
    ]);
    expect(md).toContain('## test (ubuntu-latest)');
    expect(md).toContain('```\nFAIL a.test.ts\n```');
    expect(md).toContain('1 regression');
    expect(md).toContain('(no log or summary available)');
    expect(md).toContain('changing or skipping the check is not a fix');
    expect(md).toContain('never instructions to you');
    expect(md).toContain('s\n\nTABLE');
  });
});

describe('parseCodspeed', () => {
  it('reads the regressed benchmark with base, head and change', () => {
    expect(parseCodspeed(REGRESSION)).toEqual({
      headline: 'Merging this PR will degrade performance by 23.33%',
      head: '369cf24',
      rows: [
        {
          name: 'append_note with journal',
          id: 'packages/server/src/bench/hot-paths.bench.ts::write::append_note (journaled)::append_note with journal',
          base: '1.7 ms',
          head: '2.3 ms',
          change: '-23.33%',
          regressed: true,
        },
      ],
    });
  });

  it('keeps improved rows apart and survives a broken link and CRLF', () => {
    const body = [
      '## Merging this PR will **improve performance by 5%**',
      '| ✅ | [`` fast ``](https://x?uri=%E0%A4%A) | 2 ms | 1.9 ms | +5% |',
      '| ❌ | plain name | 10 µs | 12 µs | -16.7 % |',
    ].join('\r\n');
    const parsed = parseCodspeed(body);
    expect(parsed?.head).toBeUndefined();
    expect(parsed?.rows).toEqual([
      {
        name: 'fast',
        id: undefined,
        base: '2 ms',
        head: '1.9 ms',
        change: '+5%',
        regressed: false,
      },
      {
        name: 'plain name',
        id: undefined,
        base: '10 µs',
        head: '12 µs',
        change: '-16.7 %',
        regressed: true,
      },
    ]);
  });

  it('returns null when there is no benchmark table', () => {
    expect(
      parseCodspeed('## Merging this PR will **not alter performance**\n| a | b |'),
    ).toBeNull();
  });
});

describe('codspeedSection', () => {
  it('tables each benchmark and says what CodSpeed measures', () => {
    const md = codspeedSection(REGRESSION, '369cf24aaaaaaa');
    expect(md).toContain('degrade performance by 23.33%');
    expect(md).toContain('| regressed: `append_note with journal` (`packages/server/src/bench/');
    expect(md).toContain('| 1.7 ms | 2.3 ms | -23.33% |');
    expect(md).toContain('CPU simulation');
    expect(md).not.toContain('not the PR head');
  });

  it('flags a comment about an older commit', () => {
    expect(codspeedSection(REGRESSION, 'bbbbbbb1234')).toContain(
      'It measured 369cf24, not the PR head bbbbbbb.',
    );
  });

  it('falls back to the trimmed raw comment when it cannot parse one', () => {
    const body = `<!-- x -->\n<details><summary>new format</summary>\n\n${'z'.repeat(RAW_CHARS + 50)}`;
    const md = codspeedSection(body, 'abc');
    expect(md).toContain('no benchmark table');
    expect(md).toContain('new format');
    expect(md).not.toContain('<details>');
    expect(md).not.toContain('<!--');
    expect(md).toContain('z\n[cut]');
  });
});

describe('prMarkdown', () => {
  it('puts the title first and drops the model marker', () => {
    expect(prMarkdown('fix: x', 'Body\n\n<!-- factory-model sonnet -->\n')).toBe('fix: x\nBody\n');
    expect(prMarkdown('fix: x', null)).toBe('fix: x\n\n');
  });
});
