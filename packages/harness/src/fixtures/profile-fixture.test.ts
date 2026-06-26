import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { profileVault } from '../profiler/index.js';

/**
 * Drift guard for the committed benchmark vault (PRD SHA-188).
 *
 * Profiling is deterministic from file contents, so a fixed vault must produce
 * fixed stats. This snapshots the *content-derived* fields only — everything
 * that varies by machine or wall-clock (snapshotDate, machine, vaultRoot, and
 * mtime-based freshness) is stripped. If the vault is regenerated and its shape
 * changes, this test fails and the snapshot must be updated with `vitest -u`,
 * which makes the change reviewable in the diff.
 */
const VAULT = fileURLToPath(new URL('../../fixtures/vault', import.meta.url));

describe('benchmark vault profile (golden)', () => {
  it('produces the committed deterministic shape', async () => {
    const stats = await profileVault({ vaultRoot: VAULT });

    // Hard invariants worth asserting explicitly (independent of the snapshot).
    expect(stats.counts.notes).toBe(10_000);
    expect(stats.frontmatter.malformedNotes).toEqual([]);

    const stable = {
      counts: stats.counts,
      noteSizeDistribution: stats.size.noteSizeDistribution,
      largestNotes: stats.size.largestNotes.slice(0, 10),
      medianNote: stats.size.medianNote,
      links: {
        totalWikilinks: stats.links.totalWikilinks,
        unresolvedWikilinks: stats.links.unresolvedWikilinks,
        totalExternalUrls: stats.links.totalExternalUrls,
        outboundPerNote: stats.links.outboundPerNote,
        mostLinkedNotes: stats.links.mostLinkedNotes.slice(0, 10),
      },
      frontmatter: {
        notesWithFrontmatter: stats.frontmatter.notesWithFrontmatter,
        pctNotesWithFrontmatter: Number(stats.frontmatter.pctNotesWithFrontmatter.toFixed(2)),
        keyFrequency: stats.frontmatter.keyFrequency,
        malformedNotes: stats.frontmatter.malformedNotes,
      },
      tags: {
        distinctTags: stats.tags.distinctTags,
        inlineTagOccurrences: stats.tags.inlineTagOccurrences,
        frontmatterTagOccurrences: stats.tags.frontmatterTagOccurrences,
        topTags: stats.tags.topTags.slice(0, 25),
      },
    };

    expect(stable).toMatchSnapshot();
  });
});
