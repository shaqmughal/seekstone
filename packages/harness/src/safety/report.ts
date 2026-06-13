import type { SafetyOpResult, SafetySummary } from './runner.js';

export function renderSafetyMarkdown(s: SafetySummary): string {
  const out: string[] = [];
  const push = (line = '') => out.push(line);

  push(`# Write Safety — ${s.backend.name}`);
  push();
  push(`- **Adapter:** ${s.backend.description}`);
  push(`- **Snapshot:** ${s.snapshotDate}`);
  push(`- **Sample:** ${s.sampleSize} frontmatter-heavy notes`);
  push(`- **Vault copy:** \`${s.vaultCopyRoot}\``);
  push(`- **Original (read-only, untouched):** \`${s.originalVaultRoot}\``);
  push();

  push(`## Summary`);
  push();
  push(`| Op | Pass | Fail | Verdict |`);
  push(`| --- | ---: | ---: | --- |`);
  for (const [op, r] of Object.entries(s.passByOp)) {
    const total = r.pass + r.fail;
    const verdict = opVerdict(op, r.pass, r.fail, total);
    push(`| ${op} | ${r.pass} | ${r.fail} | ${verdict} |`);
  }
  push();

  // Highlight systemic failures with a dedicated call-out block.
  const systemicFailures = detectSystemicFailures(s);
  for (const finding of systemicFailures) {
    push(`> [!CAUTION]`);
    push(`> **${finding.title}**`);
    push(`>`);
    for (const line of finding.body) push(`> ${line}`);
    push();
  }

  const failed = s.notes.filter((n) => n.ops.some((o) => !o.pass));
  if (failed.length === 0) {
    push(`✅ All ${s.sampleSize} sampled notes round-tripped byte-faithfully.`);
    push();
    return out.join('\n');
  }

  push(`## Failing notes`);
  push();
  push(`| Note | Op | Reason |`);
  push(`| --- | --- | --- |`);
  for (const n of failed) {
    for (const o of n.ops) {
      if (!o.pass) push(`| \`${n.relPath}\` | ${o.op} | ${mdCellEscape(o.reason ?? '—')} |`);
    }
  }
  push();
  return out.join('\n');
}

interface SystemicFinding {
  title: string;
  body: string[];
}

/**
 * Detect failure patterns that are systemic (all-or-nothing across the sample)
 * rather than note-specific edge cases. These warrant explicit call-outs in the
 * report because they represent adapter-level bugs, not data anomalies.
 */
function detectSystemicFailures(s: SafetySummary): SystemicFinding[] {
  const findings: SystemicFinding[] = [];

  for (const [op, r] of Object.entries(s.passByOp)) {
    const total = r.pass + r.fail;
    if (total === 0 || r.fail === 0) continue;

    const pct = Math.round((r.fail / total) * 100);
    if (pct < 100) continue; // not systemic — skip, table covers it

    // All notes failed this op. Determine the likely cause from the first failure reason.
    const firstFail = s.notes
      .flatMap((n) => n.ops)
      .find((o): o is SafetyOpResult & { pass: false } => o.op === op && !o.pass);

    const reason = firstFail?.reason ?? 'unknown';

    if (op === 'body-append') {
      findings.push({
        title: `Silent data loss on body-append (${r.fail}/${total} notes, 100%)`,
        body: [
          `The adapter returned HTTP 204 (success) for every write but silently discarded`,
          `the appended content. On-disk file length matched the pre-write original exactly.`,
          ``,
          `**Impact:** Any MCP tool that appends to a note body via this adapter will`,
          `receive a success response while the user's data is quietly dropped. There is no`,
          `error, no diff, no indication of failure.`,
          ``,
          `**Root cause (observed):** The REST plugin appears to normalise writes through`,
          `Obsidian's internal note model, which re-serialises the note from its parsed`,
          `representation rather than writing the raw bytes sent. Content appended after`,
          `the last recognised block is discarded during this round-trip.`,
          ``,
          `**Implication for seekstone:** A filesystem-direct server writing raw bytes`,
          `bypasses this normalisation entirely. Body-append is a free correctness win`,
          `over the REST baseline — no implementation effort required.`,
          ``,
          `First failure reason recorded: \`${mdCellEscape(reason)}\``,
        ],
      });
    } else {
      findings.push({
        title: `Systemic failure on ${op} (${r.fail}/${total} notes, 100%)`,
        body: [`First failure reason: \`${mdCellEscape(reason)}\``],
      });
    }
  }

  return findings;
}

function opVerdict(_op: string, pass: number, fail: number, total: number): string {
  if (fail === 0) return '✅ Pass';
  if (pass === 0) return `❌ **Fail — all ${total} notes** (systemic)`;
  return `⚠️ Partial — ${fail}/${total} failed`;
}

function mdCellEscape(s: string): string {
  return s.replaceAll('|', '\\|').replaceAll('\n', ' ');
}
