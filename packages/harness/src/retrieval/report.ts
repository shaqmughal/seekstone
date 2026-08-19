import type { Distribution } from '@seekstone/core/percentiles';
import type { RetrievalSummary } from './runner.js';

const ms = (n: number) => `${n.toFixed(2)} ms`;
const pct = (n: number) => `${n.toFixed(1)}%`;

function latencyRow(condition: string, warm: Distribution): string {
  return `| ${condition} | ${ms(warm.median)} | ${ms(warm.p90)} | ${ms(warm.p95)} | ${ms(warm.p99)} |`;
}

export function renderRetrievalMarkdown(s: RetrievalSummary): string {
  const lines: string[] = [];
  lines.push('# Retrieval-quality eval (SHA-257 spike)');
  lines.push('');
  lines.push(`- **Snapshot:** ${s.snapshotDate}`);
  lines.push(
    `- **Machine:** ${s.machine.platform}/${s.machine.arch}, node ${s.machine.node}, ${s.machine.cpus} cpus`,
  );
  lines.push(`- **Vault:** ${s.vaultRoot} (${s.noteCount} notes)`);
  lines.push(
    `- **Query set:** ${s.querySet.total} queries (${s.querySet.semantic} semantic, ${s.querySet.lexical} lexical, ${s.querySet.topical} topical), ${s.runs} latency runs/query`,
  );
  lines.push(`- **Lexical index build:** ${ms(s.lexicalBuildMs)}`);
  for (const m of s.models) {
    lines.push(
      `- **${m.modelId}:** dim ${m.dim}, ${m.chunkCount} chunks, index build ${ms(m.indexBuildMs)}, model load ${ms(m.loadMs)}`,
    );
  }
  lines.push('');

  lines.push('## Retrieval quality');
  lines.push('');
  lines.push('| Condition | Subset | hit@5 | MRR@10 | n |');
  lines.push('| --- | --- | ---: | ---: | ---: |');
  for (const c of s.conditions) {
    for (const subset of ['overall', 'semantic', 'lexical', 'topical'] as const) {
      const m = c.metrics[subset];
      lines.push(
        `| ${c.condition} | ${subset} | ${pct(m.hit5)} | ${m.mrr10.toFixed(3)} | ${m.n} |`,
      );
    }
  }
  lines.push('');

  lines.push('## Query latency (warm)');
  lines.push('');
  lines.push('| Condition | p50 | p90 | p95 | p99 |');
  lines.push('| --- | ---: | ---: | ---: | ---: |');
  for (const c of s.conditions) {
    lines.push(latencyRow(c.condition, c.latency.warm));
  }
  lines.push('');

  const missed = s.perQuery.filter((p) =>
    Object.entries(p.conditions).some(([cond, r]) => cond.startsWith('hybrid-rrf:') && !r.hit5),
  );
  lines.push('## Hybrid misses at 5 (error-analysis material)');
  lines.push('');
  if (missed.length === 0) {
    lines.push('None — every query had an expected path in the hybrid top 5.');
  } else {
    for (const p of missed) {
      lines.push(`- **${p.id}** (${p.kind}): "${p.query}" → expected ${p.expected.join(', ')}`);
      for (const [cond, r] of Object.entries(p.conditions)) {
        if (!cond.startsWith('hybrid-rrf:') || r.hit5) continue;
        lines.push(`  - ${cond} top 5: ${r.top10.slice(0, 5).join(', ')}`);
      }
    }
  }
  lines.push('');

  lines.push('## Gate verdict');
  lines.push('');
  lines.push(
    '> **Pre-registered gate:** hybrid RRF must beat lexical-only by ≥10 points hit@5 on the semantic subset, regress ≤2 points on the exact-term subset, and warm end-to-end semantic query (embed + scan) p95 ≤ 15 ms at 10k notes. +5..+10 points = discuss zone. Model choice = smallest model passing.',
  );
  lines.push('');
  for (const m of s.gate.perModel) {
    lines.push(`### ${m.model} — ${m.verdict.toUpperCase()}`);
    lines.push('');
    for (const r of m.reasons) lines.push(`- ${r}`);
    lines.push('');
  }
  lines.push(
    `**Overall: ${s.gate.verdict.toUpperCase()}**${s.gate.chosenModel ? ` — chosen model: ${s.gate.chosenModel}` : ''}`,
  );
  lines.push('');
  return lines.join('\n');
}
