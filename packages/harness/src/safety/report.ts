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
  push(`| Op | Pass | Fail | Skipped | Verdict |`);
  push(`| --- | ---: | ---: | ---: | --- |`);
  for (const [op, r] of Object.entries(s.passByOp)) {
    const verdict = opVerdict(r.pass, r.fail, r.skipped, s.notes, op);
    push(`| ${op} | ${r.pass} | ${r.fail} | ${r.skipped} | ${verdict} |`);
  }
  push();
  push(
    `> Skipped = the adapter does not expose the capability (delete/create/CAS), or the op does not apply to a note's shape. Skips are the capability matrix, not failures.`,
  );
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

  const failed = s.notes.filter((n) => n.ops.some((o) => o.status === 'fail'));
  if (failed.length === 0) {
    push(`✅ No failures across ${s.sampleSize} sampled notes.`);
    push();
    return out.join('\n');
  }

  push(`## Failing notes`);
  push();
  push(`| Note | Op | Reason |`);
  push(`| --- | --- | --- |`);
  for (const n of failed) {
    for (const o of n.ops) {
      if (o.status === 'fail')
        push(`| \`${n.relPath}\` | ${o.op} | ${mdCellEscape(o.reason ?? '—')} |`);
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
 * Skipped results are ignored — an absent capability is not a failure.
 */
function detectSystemicFailures(s: SafetySummary): SystemicFinding[] {
  const findings: SystemicFinding[] = [];

  for (const [op, r] of Object.entries(s.passByOp)) {
    const attempted = r.pass + r.fail;
    if (attempted === 0 || r.fail === 0) continue;

    const pct = Math.round((r.fail / attempted) * 100);
    if (pct < 100) continue; // not systemic — skip, table covers it

    // All attempted notes failed this op. Determine the likely cause from the first failure reason.
    const firstFail = s.notes
      .flatMap((n) => n.ops)
      .find((o): o is SafetyOpResult => o.op === op && o.status === 'fail');

    const reason = firstFail?.reason ?? 'unknown';

    // The REST-plugin silent-data-loss narrative only applies when writes
    // REPORT success but the bytes never land. A refused write (e.g. an
    // adapter whose only write tool rejects existing paths) is a different,
    // far less dangerous failure mode — use the generic call-out.
    if (op === 'body-append' && !reason.startsWith('write call errored')) {
      findings.push({
        title: `Silent data loss on body-append (${r.fail}/${attempted} notes, 100%)`,
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
        title: `Systemic failure on ${op} (${r.fail}/${attempted} notes, 100%)`,
        body: [`First failure reason: \`${mdCellEscape(reason)}\``],
      });
    }
  }

  return findings;
}

function opVerdict(
  pass: number,
  fail: number,
  skipped: number,
  notes: SafetySummary['notes'],
  op: string,
): string {
  const attempted = pass + fail;
  if (attempted === 0) {
    if (skipped === 0) return '—';
    const firstSkip = notes
      .flatMap((n) => n.ops)
      .find((o) => o.op === op && o.status === 'skipped');
    return firstSkip?.reason?.startsWith('backend does not support')
      ? '— n/a (unsupported by adapter)'
      : '— n/a';
  }
  if (fail === 0) return '✅ Pass';
  if (pass === 0) return `❌ **Fail — all ${attempted} attempted notes** (systemic)`;
  return `⚠️ Partial — ${fail}/${attempted} failed`;
}

function mdCellEscape(s: string): string {
  return s.replaceAll('|', '\\|').replaceAll('\n', ' ');
}
