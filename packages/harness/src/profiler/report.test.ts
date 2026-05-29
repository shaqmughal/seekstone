import { describe, expect, it } from 'vitest';
import type { VaultStats } from './index.js';
import { renderVaultStatsMarkdown } from './report.js';

const minStats: VaultStats = {
  vaultRoot: '/vault',
  snapshotDate: '2026-05-29T00:00:00.000Z',
  machine: { platform: 'darwin', arch: 'arm64', node: 'v22.0.0', cpus: 4 },
  counts: {
    totalFiles: 3,
    notes: 2,
    attachmentsByKind: {
      note: 2,
      image: 1,
      pdf: 0,
      excalidraw: 0,
      canvas: 0,
      video: 0,
      audio: 0,
      other: 0,
    },
    notesByTopDir: { Daily: 2 },
  },
  size: {
    totalBytes: 5000,
    notesBytes: 4000,
    attachmentsBytes: 1000,
    noteSizeDistribution: {
      n: 2,
      min: 1000,
      median: 2000,
      p90: 3000,
      p95: 3500,
      p99: 4000,
      max: 4000,
      mean: 2000,
    },
    largestNotes: [{ relPath: 'big.md', sizeBytes: 4000 }],
    medianNote: { relPath: 'med.md', sizeBytes: 2000 },
  },
  links: {
    totalWikilinks: 10,
    outboundPerNote: { n: 2, min: 2, median: 5, p90: 8, p95: 9, p99: 10, max: 10, mean: 5 },
    unresolvedWikilinks: 2,
    mostLinkedNotes: [{ target: 'Home', incoming: 5 }],
    totalExternalUrls: 3,
  },
  frontmatter: {
    notesWithFrontmatter: 1,
    pctNotesWithFrontmatter: 50,
    keyFrequency: [{ key: 'title', count: 1 }],
    malformedNotes: [],
  },
  tags: {
    distinctTags: 2,
    inlineTagOccurrences: 3,
    frontmatterTagOccurrences: 1,
    topTags: [{ tag: 'work', count: 2 }],
  },
  freshness: {
    modifiedLast7Days: 1,
    modifiedLast30Days: 2,
    modifiedLast90Days: 2,
  },
};

describe('renderVaultStatsMarkdown', () => {
  it('output starts with "# Vault Stats"', () => {
    const md = renderVaultStatsMarkdown(minStats);
    expect(md.startsWith('# Vault Stats')).toBe(true);
  });

  it('contains vault root path "/vault"', () => {
    const md = renderVaultStatsMarkdown(minStats);
    expect(md).toContain('/vault');
  });

  it('contains "Total files: **3**"', () => {
    const md = renderVaultStatsMarkdown(minStats);
    expect(md).toContain('Total files: **3**');
  });

  it('contains "Markdown notes: **2**"', () => {
    const md = renderVaultStatsMarkdown(minStats);
    expect(md).toContain('Markdown notes: **2**');
  });

  it('contains the largest note path "big.md"', () => {
    const md = renderVaultStatsMarkdown(minStats);
    expect(md).toContain('big.md');
  });

  it('contains tag "#work"', () => {
    const md = renderVaultStatsMarkdown(minStats);
    expect(md).toContain('#work');
  });

  it('contains "Modified last 7 days" equivalent text', () => {
    const md = renderVaultStatsMarkdown(minStats);
    expect(md).toContain('Modified last 7 days');
  });

  it('does NOT contain "Malformed notes" section when malformedNotes is empty', () => {
    const md = renderVaultStatsMarkdown(minStats);
    expect(md).not.toContain('Malformed notes');
  });

  it('contains "Malformed notes" section when malformedNotes has entries', () => {
    const statsWithMalformed: VaultStats = {
      ...minStats,
      frontmatter: {
        ...minStats.frontmatter,
        malformedNotes: ['broken.md', 'also-broken.md'],
      },
    };
    const md = renderVaultStatsMarkdown(statsWithMalformed);
    expect(md).toContain('Malformed notes');
    expect(md).toContain('broken.md');
    expect(md).toContain('also-broken.md');
  });
});
