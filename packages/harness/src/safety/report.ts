import type { SafetySummary } from './runner.js';

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
  push(`| Op | Pass | Fail |`);
  push(`| --- | ---: | ---: |`);
  for (const [op, r] of Object.entries(s.passByOp)) {
    push(`| ${op} | ${r.pass} | ${r.fail} |`);
  }
  push();

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

function mdCellEscape(s: string): string {
  return s.replaceAll('|', '\\|').replaceAll('\n', ' ');
}
