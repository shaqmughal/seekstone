import type { BenchmarkSummary } from './runner.js';

const KB = 1024;
const MB = 1024 * 1024;

function fmtBytes(n: number): string {
  if (n >= MB) return `${(n / MB).toFixed(2)} MB`;
  if (n >= KB) return `${(n / KB).toFixed(1)} KB`;
  return `${Math.round(n)} B`;
}
function fmtMs(n: number): string {
  return `${n.toFixed(2)} ms`;
}

/**
 * Render benchmark.md. Tables are flat and re-runnable — the README
 * documents how to regenerate so the article-grade numbers stay reproducible.
 */
export function renderBenchmarkMarkdown(s: BenchmarkSummary): string {
  const out: string[] = [];
  const push = (line = '') => out.push(line);

  push(`# Benchmark — ${s.backend.name}`);
  push();
  push(`- **Adapter:** ${s.backend.description}`);
  push(`- **Snapshot:** ${s.snapshotDate}`);
  push(`- **Runs per measurement:** ${s.runs} (cold = run 1; warm = runs 2..N)`);
  push(
    `- **Machine:** ${s.machine.platform}/${s.machine.arch}, Node ${s.machine.node}, ${s.machine.cpus} logical CPUs`,
  );
  push(
    `- **Process RSS:** before ${fmtBytes(s.rssBefore)}, peak ${fmtBytes(s.rssPeak)} (Δ ${fmtBytes(s.rssPeak - s.rssBefore)})`,
  );
  push();

  push(`## Search`);
  push();
  push(`| Query | Kind | Cold | Warm p50 | Warm p95 | Payload | Tokens | Hits (run 1) |`);
  push(`| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |`);
  for (const q of s.search) {
    push(
      `| \`${mdCellEscape(q.query)}\` | ${q.kind} | ${fmtMs(q.stats.coldMs)} | ${fmtMs(q.stats.warm.median)} | ${fmtMs(q.stats.warm.p90)} | ${fmtBytes(q.stats.payloadBytesMean)} | ${q.stats.payloadTokensMean.toLocaleString()} | ${q.firstRunHitCount} |`,
    );
  }
  push();
  push(
    `> **Context tax.** Payload is the raw bytes returned for the query. Token count uses tiktoken \`cl100k_base\`.`,
  );
  push();

  push(`## Read`);
  push();
  push(`| Sample | Path | Cold | Warm p50 | Warm p95 | Payload |`);
  push(`| --- | --- | ---: | ---: | ---: | ---: |`);
  for (const [sample, entry] of [
    ['small', s.read.small],
    ['large', s.read.large],
  ] as const) {
    if (!entry) {
      push(`| ${sample} | — | — | — | — | — |`);
      continue;
    }
    push(
      `| ${sample} | \`${entry.path}\` | ${fmtMs(entry.stats.coldMs)} | ${fmtMs(entry.stats.warm.median)} | ${fmtMs(entry.stats.warm.p95)} | ${fmtBytes(entry.stats.payloadBytesMean)} |`,
    );
  }
  push();
  push(`## Methodology notes`);
  push();
  push(
    `- Time-to-first-result equals total response time for any non-streaming adapter (the REST plugin returns the full hit list in one shot). Streaming adapters should override and report TTFR separately.`,
  );
  push(
    `- Cold-start / index build time is recorded as the cold value of the first benchmark. Filesystem-direct adapters that build an index should expose a dedicated \`warmUp()\` measurement — TODO.`,
  );
  push(`- RSS is process-level and includes the harness itself, not only the adapter.`);
  push();

  return out.join('\n');
}

function mdCellEscape(s: string): string {
  return s.replaceAll('|', '\\|');
}
