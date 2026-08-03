import { describe, expect, it } from 'vitest';
import { renderSafetyMarkdown } from './report.js';
import type { SafetySummary } from './runner.js';

const zero = { pass: 0, fail: 0, skipped: 0 };

const allPassSummary: SafetySummary = {
  snapshotDate: '2026-05-29T00:00:00.000Z',
  backend: { name: 'fs', description: 'Filesystem-direct' },
  vaultCopyRoot: '/tmp/copy',
  originalVaultRoot: '/tmp/orig',
  sampleSize: 2,
  passByOp: {
    identity: { pass: 2, fail: 0, skipped: 0 },
    'body-append': { pass: 2, fail: 0, skipped: 0 },
    'fm-edit': { pass: 2, fail: 0, skipped: 0 },
    'patch-note': { pass: 2, fail: 0, skipped: 0 },
    'replace-in-note': { pass: 2, fail: 0, skipped: 0 },
    'recoverable-delete': { pass: 2, fail: 0, skipped: 0 },
    'create-no-clobber': { pass: 2, fail: 0, skipped: 0 },
    'cas-conflict': { ...zero, skipped: 2 },
  },
  notes: [
    {
      relPath: 'a.md',
      fmKeys: ['title'],
      ops: [
        { op: 'identity', status: 'pass', change: 'x' },
        { op: 'body-append', status: 'pass', change: 'x' },
        { op: 'fm-edit', status: 'pass', change: 'x' },
        {
          op: 'cas-conflict',
          status: 'skipped',
          reason: 'backend does not support readWithHash/casWrite',
          change: '—',
        },
      ],
    },
    {
      relPath: 'b.md',
      fmKeys: ['title'],
      ops: [
        { op: 'identity', status: 'pass', change: 'x' },
        { op: 'body-append', status: 'pass', change: 'x' },
        { op: 'fm-edit', status: 'pass', change: 'x' },
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
    identity: { pass: 1, fail: 0, skipped: 0 },
    'body-append': { pass: 0, fail: 1, skipped: 0 },
    'fm-edit': { pass: 1, fail: 0, skipped: 0 },
    'patch-note': { pass: 1, fail: 0, skipped: 0 },
    'replace-in-note': { pass: 1, fail: 0, skipped: 0 },
    'recoverable-delete': { ...zero, skipped: 1 },
    'create-no-clobber': { ...zero, skipped: 1 },
    'cas-conflict': { ...zero, skipped: 1 },
  },
  notes: [
    {
      relPath: 'a.md',
      fmKeys: ['title'],
      ops: [
        { op: 'identity', status: 'pass', change: 'x' },
        {
          op: 'body-append',
          status: 'fail',
          reason: 'post-write bytes differ',
          change: 'append',
        },
        { op: 'fm-edit', status: 'pass', change: 'x' },
        {
          op: 'recoverable-delete',
          status: 'skipped',
          reason: 'backend does not support deleteNote',
          change: '—',
        },
      ],
    },
  ],
};

describe('renderSafetyMarkdown', () => {
  it('output starts with "# Write Safety — fs"', () => {
    const md = renderSafetyMarkdown(allPassSummary);
    expect(md.startsWith('# Write Safety — fs')).toBe(true);
  });

  it('all-pass output contains the no-failures line', () => {
    const md = renderSafetyMarkdown(allPassSummary);
    expect(md).toContain('✅ No failures across 2 sampled notes');
  });

  it('all-pass output contains "✅ Pass" for each attempted-and-passing op row', () => {
    const md = renderSafetyMarkdown(allPassSummary);
    const passCount = (md.match(/✅ Pass/g) ?? []).length;
    // 5 byte ops + recoverable-delete + create-no-clobber pass; cas-conflict is skipped
    expect(passCount).toBe(7);
  });

  it('a fully-skipped op renders as n/a (unsupported), not a failure', () => {
    const md = renderSafetyMarkdown(allPassSummary);
    expect(md).toContain('— n/a (unsupported by adapter)');
    expect(md).not.toContain('CAUTION');
  });

  it('renders a Skipped column', () => {
    const md = renderSafetyMarkdown(allPassSummary);
    expect(md).toContain('| Op | Pass | Fail | Skipped | Verdict |');
  });

  it('failure output contains "❌" for body-append row', () => {
    const md = renderSafetyMarkdown(bodyAppendFailSummary);
    expect(md).toContain('❌');
  });

  it('failure output contains failing note path in table', () => {
    const md = renderSafetyMarkdown(bodyAppendFailSummary);
    expect(md).toContain('a.md');
  });

  it('systemic body-append failure (100% of attempted) contains "[!CAUTION]" call-out block', () => {
    const md = renderSafetyMarkdown(bodyAppendFailSummary);
    expect(md).toContain('[!CAUTION]');
  });

  it('skips never trigger systemic call-outs', () => {
    const md = renderSafetyMarkdown(allPassSummary);
    expect(md).not.toContain('[!CAUTION]');
  });

  it('failure output starts with "# Write Safety — rest"', () => {
    const md = renderSafetyMarkdown(bodyAppendFailSummary);
    expect(md.startsWith('# Write Safety — rest')).toBe(true);
  });
});
