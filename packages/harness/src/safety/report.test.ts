import { describe, expect, it } from 'vitest';
import { renderSafetyMarkdown } from './report.js';
import type { SafetySummary } from './runner.js';

const allPassSummary: SafetySummary = {
  snapshotDate: '2026-05-29T00:00:00.000Z',
  backend: { name: 'fs', description: 'Filesystem-direct' },
  vaultCopyRoot: '/tmp/copy',
  originalVaultRoot: '/tmp/orig',
  sampleSize: 2,
  passByOp: {
    identity: { pass: 2, fail: 0 },
    'body-append': { pass: 2, fail: 0 },
    'fm-edit': { pass: 2, fail: 0 },
  },
  notes: [
    {
      relPath: 'a.md',
      fmKeys: ['title'],
      ops: [
        { op: 'identity', pass: true, change: 'x' },
        { op: 'body-append', pass: true, change: 'x' },
        { op: 'fm-edit', pass: true, change: 'x' },
      ],
    },
    {
      relPath: 'b.md',
      fmKeys: ['title'],
      ops: [
        { op: 'identity', pass: true, change: 'x' },
        { op: 'body-append', pass: true, change: 'x' },
        { op: 'fm-edit', pass: true, change: 'x' },
      ],
    },
  ],
};

const bodyAppendFailSummary: SafetySummary = {
  snapshotDate: '2026-05-29T00:00:00.000Z',
  backend: { name: 'rest', description: 'REST adapter' },
  vaultCopyRoot: '/tmp/copy',
  originalVaultRoot: '/tmp/orig',
  sampleSize: 1,
  passByOp: {
    identity: { pass: 1, fail: 0 },
    'body-append': { pass: 0, fail: 1 },
    'fm-edit': { pass: 1, fail: 0 },
  },
  notes: [
    {
      relPath: 'a.md',
      fmKeys: ['title'],
      ops: [
        { op: 'identity', pass: true, change: 'x' },
        { op: 'body-append', pass: false, reason: 'post-write bytes differ', change: 'append' },
        { op: 'fm-edit', pass: true, change: 'x' },
      ],
    },
  ],
};

describe('renderSafetyMarkdown', () => {
  it('output starts with "# Write Safety — fs"', () => {
    const md = renderSafetyMarkdown(allPassSummary);
    expect(md.startsWith('# Write Safety — fs')).toBe(true);
  });

  it('all-pass output contains "✅ All 2 sampled notes"', () => {
    const md = renderSafetyMarkdown(allPassSummary);
    expect(md).toContain('✅ All 2 sampled notes');
  });

  it('all-pass output contains "✅ Pass" for each op row', () => {
    const md = renderSafetyMarkdown(allPassSummary);
    const passCount = (md.match(/✅ Pass/g) ?? []).length;
    // identity, body-append, fm-edit all pass → 3 rows
    expect(passCount).toBe(3);
  });

  it('all-pass output does NOT contain "CAUTION"', () => {
    const md = renderSafetyMarkdown(allPassSummary);
    expect(md).not.toContain('CAUTION');
  });

  it('failure output contains "❌" for body-append row', () => {
    const md = renderSafetyMarkdown(bodyAppendFailSummary);
    // The verdict cell for a fully failing op includes ❌
    expect(md).toContain('❌');
  });

  it('failure output contains failing note path in table', () => {
    const md = renderSafetyMarkdown(bodyAppendFailSummary);
    expect(md).toContain('a.md');
  });

  it('systemic body-append failure (100%) contains "[!CAUTION]" call-out block', () => {
    const md = renderSafetyMarkdown(bodyAppendFailSummary);
    expect(md).toContain('[!CAUTION]');
  });

  it('failure output starts with "# Write Safety — rest"', () => {
    const md = renderSafetyMarkdown(bodyAppendFailSummary);
    expect(md.startsWith('# Write Safety — rest')).toBe(true);
  });
});
