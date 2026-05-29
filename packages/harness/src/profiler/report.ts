import type { VaultStats } from './index.js';

const KB = 1024;
const MB = 1024 * 1024;

function fmtBytes(n: number): string {
  if (n >= MB) return `${(n / MB).toFixed(2)} MB`;
  if (n >= KB) return `${(n / KB).toFixed(1)} KB`;
  return `${n} B`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

/**
 * Render a human-readable markdown summary. The companion `vault-stats.json`
 * remains the source of truth; this report is for skim-reading and for paste
 * into the Vault Profile note.
 */
export function renderVaultStatsMarkdown(stats: VaultStats): string {
  const s: string[] = [];
  const push = (line = '') => s.push(line);

  push(`# Vault Stats`);
  push();
  push(`- **Vault:** \`${stats.vaultRoot}\``);
  push(`- **Snapshot:** ${stats.snapshotDate}`);
  push(
    `- **Machine:** ${stats.machine.platform}/${stats.machine.arch}, Node ${stats.machine.node}, ${stats.machine.cpus} logical CPUs`,
  );
  push();

  push(`## Counts`);
  push();
  push(`- Total files: **${stats.counts.totalFiles.toLocaleString()}**`);
  push(`- Markdown notes: **${stats.counts.notes.toLocaleString()}**`);
  push(`- By kind:`);
  for (const [kind, n] of Object.entries(stats.counts.attachmentsByKind)) {
    if (n === 0) continue;
    push(`  - ${kind}: ${n.toLocaleString()}`);
  }
  push();
  push(`### Notes per top-level folder`);
  push();
  const topDirs = Object.entries(stats.counts.notesByTopDir).sort((a, b) => b[1] - a[1]);
  push(`| Folder | Notes |`);
  push(`| --- | ---: |`);
  for (const [dir, n] of topDirs) push(`| \`${dir || '(root)'}\` | ${n.toLocaleString()} |`);
  push();

  push(`## Size`);
  push();
  push(`- Total bytes: **${fmtBytes(stats.size.totalBytes)}**`);
  push(`- Notes: ${fmtBytes(stats.size.notesBytes)}`);
  push(`- Attachments: ${fmtBytes(stats.size.attachmentsBytes)}`);
  push();
  const d = stats.size.noteSizeDistribution;
  push(`### Note size distribution`);
  push();
  push(`| Min | Median | p90 | p99 | Max | Mean |`);
  push(`| ---: | ---: | ---: | ---: | ---: | ---: |`);
  push(
    `| ${fmtBytes(d.min)} | ${fmtBytes(d.median)} | ${fmtBytes(d.p90)} | ${fmtBytes(d.p99)} | ${fmtBytes(d.max)} | ${fmtBytes(Math.round(d.mean))} |`,
  );
  push();
  push(`### Largest notes`);
  push();
  for (const n of stats.size.largestNotes) {
    push(`- \`${n.relPath}\` — ${fmtBytes(n.sizeBytes)}`);
  }
  push();

  push(`## Links`);
  push();
  push(`- Total wikilinks: **${stats.links.totalWikilinks.toLocaleString()}**`);
  push(`- Unresolved wikilinks: ${stats.links.unresolvedWikilinks.toLocaleString()}`);
  push(`- External URLs: ${stats.links.totalExternalUrls.toLocaleString()}`);
  const ol = stats.links.outboundPerNote;
  push(`- Outbound per note — median ${ol.median}, p90 ${ol.p90}, max ${ol.max}`);
  push();
  push(`### Most-linked notes`);
  push();
  for (const m of stats.links.mostLinkedNotes) {
    push(`- \`${m.target}\` — ${m.incoming.toLocaleString()} incoming`);
  }
  push();

  push(`## Frontmatter`);
  push();
  push(
    `- Notes with frontmatter: **${stats.frontmatter.notesWithFrontmatter.toLocaleString()}** (${fmtPct(stats.frontmatter.pctNotesWithFrontmatter)})`,
  );
  push(`- Malformed frontmatter: ${stats.frontmatter.malformedNotes.length}`);
  push();
  push(`### Top frontmatter keys`);
  push();
  push(`| Key | Count |`);
  push(`| --- | ---: |`);
  for (const k of stats.frontmatter.keyFrequency.slice(0, 25)) {
    push(`| \`${k.key}\` | ${k.count.toLocaleString()} |`);
  }
  if (stats.frontmatter.malformedNotes.length > 0) {
    push();
    push(`### Malformed notes (write-safety blast radius)`);
    push();
    for (const p of stats.frontmatter.malformedNotes.slice(0, 50)) push(`- \`${p}\``);
    if (stats.frontmatter.malformedNotes.length > 50) {
      push(`- … and ${stats.frontmatter.malformedNotes.length - 50} more`);
    }
  }
  push();

  push(`## Tags`);
  push();
  push(`- Distinct tags: **${stats.tags.distinctTags.toLocaleString()}**`);
  push(`- Inline tag occurrences: ${stats.tags.inlineTagOccurrences.toLocaleString()}`);
  push(`- Frontmatter tag occurrences: ${stats.tags.frontmatterTagOccurrences.toLocaleString()}`);
  push();
  push(`### Top tags`);
  push();
  push(`| Tag | Count |`);
  push(`| --- | ---: |`);
  for (const t of stats.tags.topTags.slice(0, 25)) {
    push(`| \`#${t.tag}\` | ${t.count.toLocaleString()} |`);
  }
  push();

  push(`## Freshness`);
  push();
  push(`- Modified last 7 days: ${stats.freshness.modifiedLast7Days.toLocaleString()}`);
  push(`- Modified last 30 days: ${stats.freshness.modifiedLast30Days.toLocaleString()}`);
  push(`- Modified last 90 days: ${stats.freshness.modifiedLast90Days.toLocaleString()}`);
  push();

  return s.join('\n');
}
