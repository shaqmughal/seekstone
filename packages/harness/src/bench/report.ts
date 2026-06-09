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
  push(
    `| Query | Kind | Cold | Warm p50 | Warm p95 | TTFR cold | TTFR p50 | Payload | Tokens | Hits (run 1) |`,
  );
  push(`| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`);
  for (const q of s.search) {
    const ttfrCold = q.ttfr ? fmtMs(q.ttfr.coldTtfrMs) : '—';
    const ttfrP50 = q.ttfr ? fmtMs(q.ttfr.warmTtfr.median) : '—';
    push(
      `| \`${mdCellEscape(q.query)}\` | ${q.kind} | ${fmtMs(q.stats.coldMs)} | ${fmtMs(q.stats.warm.median)} | ${fmtMs(q.stats.warm.p90)} | ${ttfrCold} | ${ttfrP50} | ${fmtBytes(q.stats.payloadBytesMean)} | ${q.stats.payloadTokensMean.toLocaleString()} | ${q.firstRunHitCount} |`,
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

  // ── Extended tool table ──────────────────────────────────────────────────────
  if (s.tools) {
    const t = s.tools;
    const hasAny =
      t.list || t.listTags || t.outline || t.getBacklinks || t.getLinks || t.getPeriodicNote;

    if (hasAny) {
      push(`## Tools`);
      push();
      push(
        `Latency for tools beyond search/read. Cold = first call; Warm p50 = median of subsequent calls.`,
      );
      push();
      push(`| Tool | Target | Cold | Warm p50 | Warm p95 | Payload |`);
      push(`| --- | --- | ---: | ---: | ---: | ---: |`);

      const toolRow = (name: string, target: string, stats: import('./timer.js').RunStats) =>
        `| \`${name}\` | ${target} | ${fmtMs(stats.coldMs)} | ${fmtMs(stats.warm.median)} | ${fmtMs(stats.warm.p95)} | ${fmtBytes(stats.payloadBytesMean)} |`;

      if (t.list) push(toolRow('list_notes', 'vault root', t.list));
      if (t.listTags) push(toolRow('list_tags', 'all tags', t.listTags));
      if (t.outline) push(toolRow('outline_note', `\`${t.outline.path}\``, t.outline.stats));
      if (t.getBacklinks)
        push(toolRow('get_backlinks', `\`${t.getBacklinks.path}\``, t.getBacklinks.stats));
      if (t.getLinks) push(toolRow('get_links', `\`${t.getLinks.path}\``, t.getLinks.stats));
      if (t.getPeriodicNote) push(toolRow('get_periodic_note', 'today (daily)', t.getPeriodicNote));

      push();

      // Support matrix for tools not benchmarked
      const unsupported: string[] = [];
      if (!t.list) unsupported.push('list_notes');
      if (!t.listTags) unsupported.push('list_tags');
      if (!t.outline) unsupported.push('outline_note');
      if (!t.getBacklinks) unsupported.push('get_backlinks');
      if (!t.getLinks) unsupported.push('get_links');
      if (!t.getPeriodicNote) unsupported.push('get_periodic_note');
      if (unsupported.length > 0) {
        push(
          `> **Not supported by this backend:** ${unsupported.map((t) => `\`${t}\``).join(', ')}.`,
        );
        push();
      }
    }
  }

  push(`## Methodology notes`);
  push();
  push(
    `- **TTFR** (time-to-first-result) is measured via \`searchStream\`. Backends that return all results at once (e.g. REST) show \`—\` — their TTFR equals total latency and adding a separate column would be misleading. For MiniSearch the gap between TTFR and total latency is negligible since search is synchronous.`,
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
