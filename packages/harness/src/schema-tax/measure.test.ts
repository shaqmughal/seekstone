import { describe, expect, it } from 'vitest';
import { countTokens } from '../bench/timer.js';
import { buildReport, diffReports, measureSurface, TOKENIZER } from './measure.js';

const small = { name: 'list', description: 'List.', inputSchema: { type: 'object' } };
const big = {
  name: 'search',
  description: 'Full-text search across the vault, returning ranked excerpts.',
  inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
};

describe('measureSurface', () => {
  it('measures the compact-JSON tools array and each tool, most expensive first', () => {
    const m = measureSurface('read-write', { tools: [small, big] });
    const totalText = JSON.stringify([small, big]);
    expect(m.mode).toBe('read-write');
    expect(m.toolCount).toBe(2);
    expect(m.totalBytes).toBe(Buffer.byteLength(totalText));
    expect(m.totalTokens).toBe(countTokens(totalText, 0));
    expect(m.perTool.map((t) => t.name)).toEqual(['search', 'list']);
    expect(m.perTool[0]?.bytes).toBe(Buffer.byteLength(JSON.stringify(big)));
    expect(m.instructionsBytes).toBe(0);
    expect(m.instructionsTokens).toBe(0);
  });

  it('counts multi-byte characters as UTF-8 bytes', () => {
    const tool = { name: 'dash', description: 'a — b' };
    const m = measureSurface('read-write', { tools: [tool] });
    expect(m.perTool[0]?.bytes).toBe(JSON.stringify(tool).length + 2);
  });

  it('breaks equal-cost ties by name so the order is deterministic', () => {
    const m = measureSurface('read-only', { tools: [{ name: 'b' }, { name: 'a' }] });
    expect(m.perTool.map((t) => t.name)).toEqual(['a', 'b']);
  });

  it('measures the instructions string when the server sends one', () => {
    const m = measureSurface('read-write', { tools: [small], instructions: 'Prefer search.' });
    expect(m.instructionsBytes).toBe(14);
    expect(m.instructionsTokens).toBe(countTokens('Prefer search.', 14));
  });

  it('rejects a tool without a name', () => {
    expect(() => measureSurface('read-write', { tools: [small, { description: 'x' }] })).toThrow(
      'tools/list entry 1 has no name',
    );
  });
});

describe('buildReport', () => {
  it('names the tokenizer and method', () => {
    const r = buildReport('seekstone', [measureSurface('read-write', { tools: [small] })]);
    expect(r.schemaVersion).toBe(1);
    expect(r.backend).toBe('seekstone');
    expect(r.tokenizer).toBe(TOKENIZER);
    expect(r.method).toContain('tools/list');
  });
});

describe('diffReports', () => {
  const report = (tools: Array<Record<string, unknown>>, ro = tools) =>
    buildReport('seekstone', [
      measureSurface('read-write', { tools }),
      measureSurface('read-only', { tools: ro }),
    ]);

  it('is empty when the reports match', () => {
    expect(diffReports(report([small, big]), report([small, big]))).toEqual([]);
  });

  it('names a tool whose schema grew, plus the new totals', () => {
    const grown = { ...big, description: `${big.description} Supports fuzzy matching too.` };
    const drift = diffReports(report([small, grown]), report([small, big]));
    expect(drift.some((d) => /^read-write: \d+ → \d+ tokens/.test(d))).toBe(true);
    expect(drift.some((d) => d.startsWith('read-write: search '))).toBe(true);
    expect(drift.some((d) => d.startsWith('read-only: search '))).toBe(true);
  });

  it('reports added and removed tools and the count change', () => {
    const drift = diffReports(report([small, { name: 'extra' }]), report([small, big]));
    expect(drift.some((d) => /^read-write: new tool extra \(\d+ tokens\)$/.test(d))).toBe(true);
    expect(drift).toContain('read-write: removed tool search');
    expect(diffReports(report([small, big, { name: 'x' }]), report([small, big]))).toContain(
      'read-write: 2 → 3 tools',
    );
  });

  it('reports a mode present on only one side', () => {
    const one = buildReport('seekstone', [measureSurface('read-write', { tools: [small] })]);
    const ro = buildReport('seekstone', [measureSurface('read-only', { tools: [small] })]);
    const drift = diffReports(ro, one);
    expect(drift).toContain('read-only: not in the baseline');
    expect(drift).toContain('read-write: missing from the run');
  });

  it('falls back to a metadata message when only non-figure fields differ', () => {
    const a = report([small]);
    expect(diffReports({ ...a, method: 'changed' }, a)).toEqual([
      'report metadata differs from the baseline',
    ]);
  });
});
