import { describe, expect, it } from 'vitest';
import { buildReport, measureSurface } from './measure.js';
import { renderSchemaTaxMarkdown } from './report.js';

const tools = [
  { name: 'search', description: 'Full-text search across the vault.' },
  { name: 'list', description: 'List.' },
];

describe('renderSchemaTaxMarkdown', () => {
  const md = renderSchemaTaxMarkdown(
    buildReport('seekstone', [
      measureSurface('read-write', { tools, instructions: 'Prefer search.' }),
      measureSurface('read-only', { tools: tools.slice(1) }),
    ]),
  );

  it('renders a summary row per mode, with instructions or "none"', () => {
    expect(md).toContain('# Schema tax — seekstone');
    expect(md).toMatch(/\| Read-write \(default\) \| 2 \| \d+ B \| \d+ \| \d+ tokens \|/);
    expect(md).toMatch(/\| Read-only \(`SEEKSTONE_READ_ONLY=1`\) \| 1 \| \d+ B \| \d+ \| none \|/);
  });

  it('renders a per-tool table per mode, most expensive first, with shares', () => {
    expect(md).toContain('## Per tool — Read-write (default)');
    expect(md).toContain('## Per tool — Read-only (`SEEKSTONE_READ_ONLY=1`)');
    expect(md.indexOf('| `search` |')).toBeLessThan(md.indexOf('| `list` |'));
    expect(md).toMatch(/\| `list` \| \d+ \| \d+ \| 100\.0% \|/);
  });

  it('ends with the method note', () => {
    expect(md).toContain('> **Method.** Tool list as served over MCP stdio');
  });

  it('switches to KB above 1 KiB and handles an empty tool list', () => {
    const wide = [{ name: 'wide', description: 'x'.repeat(2000) }];
    const out = renderSchemaTaxMarkdown(
      buildReport('fake', [
        measureSurface('read-write', { tools: wide }),
        measureSurface('read-only', { tools: [] }),
      ]),
    );
    expect(out).toMatch(/\| Read-write \(default\) \| 1 \| 2\.0 KB \|/);
    expect(out).toMatch(/\| Read-only \(`SEEKSTONE_READ_ONLY=1`\) \| 0 \| 2 B \|/);
  });
});
