import { describe, expect, it } from 'vitest';
import { formatFailures, LOG_LINES, prMarkdown, tailLog } from './ci-failure.mjs';

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
    ]);
    expect(md).toContain('## test (ubuntu-latest)');
    expect(md).toContain('```\nFAIL a.test.ts\n```');
    expect(md).toContain('1 regression');
    expect(md).toContain('(no log or summary available)');
    expect(md).toContain('changing or skipping the check is not a fix');
  });
});

describe('prMarkdown', () => {
  it('puts the title first and drops the model marker', () => {
    expect(prMarkdown('fix: x', 'Body\n\n<!-- factory-model sonnet -->\n')).toBe('fix: x\nBody\n');
    expect(prMarkdown('fix: x', null)).toBe('fix: x\n\n');
  });
});
