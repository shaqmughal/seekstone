import type { BenchmarkSummary } from './runner.js';

/**
 * Generates a cross-adapter comparison markdown table from multiple
 * BenchmarkSummary objects. Designed to be the "headline" artifact —
 * the table you'd drop into a blog post or README to show seekstone
 * beats the competition on payload bytes and latency.
 */
export function renderComparisonMarkdown(summaries: BenchmarkSummary[]): string {
  const first = summaries[0];
  if (!first) return '# Benchmark Comparison\n\nNo data.\n';

  const lines: string[] = [];
  lines.push('# Obsidian MCP Server Benchmark Comparison');
  lines.push('');
  lines.push(
    `> Generated ${first.snapshotDate.slice(0, 10)} · ${first.runs} runs · ${first.machine.platform}/${first.machine.arch} · Node ${first.machine.node}`,
  );
  lines.push('');

  // ── Payload bytes comparison ──────────────────────────────────────────────
  lines.push('## Payload bytes (context tax)');
  lines.push('');
  lines.push('Bytes returned per operation — what the LLM actually receives. Lower is better.');
  lines.push('');

  // Search payload table
  const allQueryIds = [...new Set(summaries.flatMap((s) => s.search.map((q) => q.id)))];

  lines.push('### Search payload bytes (mean across runs)');
  lines.push('');
  const searchHeader = ['Query', ...summaries.map((s) => s.backend.name)];
  lines.push(`| ${searchHeader.join(' | ')} |`);
  lines.push(`| ${searchHeader.map(() => '---').join(' | ')} |`);

  for (const id of allQueryIds) {
    const cells = summaries.map((s) => {
      const q = s.search.find((sq) => sq.id === id);
      if (!q) return '—';
      return formatBytes(q.stats.payloadBytesMean);
    });
    const qLabel = first.search.find((q) => q.id === id)?.query ?? id;
    lines.push(`| \`${qLabel}\` | ${cells.join(' | ')} |`);
  }
  lines.push('');

  // Read payload table
  const hasSmall = summaries.some((s) => s.read.small != null);
  const hasLarge = summaries.some((s) => s.read.large != null);

  if (hasSmall || hasLarge) {
    lines.push('### Read payload bytes');
    lines.push('');
    lines.push(`| File | ${summaries.map((s) => s.backend.name).join(' | ')} |`);
    lines.push(`| --- | ${summaries.map(() => '---').join(' | ')} |`);

    if (hasSmall) {
      const cells = summaries.map((s) =>
        s.read.small ? formatBytes(s.read.small.stats.payloadBytesMean) : '—',
      );
      const label = summaries.find((s) => s.read.small)?.read.small?.path ?? 'small';
      lines.push(`| \`${truncatePath(label)}\` (small) | ${cells.join(' | ')} |`);
    }

    if (hasLarge) {
      const cells = summaries.map((s) =>
        s.read.large ? formatBytes(s.read.large.stats.payloadBytesMean) : '—',
      );
      const label = summaries.find((s) => s.read.large)?.read.large?.path ?? 'large';
      lines.push(`| \`${truncatePath(label)}\` (large) | ${cells.join(' | ')} |`);
    }
    lines.push('');
  }

  // ── Latency comparison ────────────────────────────────────────────────────
  lines.push('## Latency (ms)');
  lines.push('');
  lines.push('`cold` = first run (index build + first query). `warm` = median of subsequent runs.');
  lines.push('');

  lines.push('### Search latency (ms)');
  lines.push('');
  const latHeader = [
    'Query',
    ...summaries.flatMap((s) => [`${s.backend.name} cold`, `${s.backend.name} warm`]),
  ];
  lines.push(`| ${latHeader.join(' | ')} |`);
  lines.push(`| ${latHeader.map(() => '---').join(' | ')} |`);

  for (const id of allQueryIds) {
    const cells = summaries.flatMap((s) => {
      const q = s.search.find((sq) => sq.id === id);
      if (!q) return ['—', '—'];
      return [
        `${q.stats.coldMs.toFixed(1)}`,
        q.stats.warm.median != null ? `${q.stats.warm.median.toFixed(1)}` : '—',
      ];
    });
    const qLabel = first.search.find((q) => q.id === id)?.query ?? id;
    lines.push(`| \`${qLabel}\` | ${cells.join(' | ')} |`);
  }
  lines.push('');

  if (hasSmall || hasLarge) {
    lines.push('### Read latency (ms)');
    lines.push('');
    lines.push(
      `| File | ${summaries.flatMap((s) => [`${s.backend.name} cold`, `${s.backend.name} warm`]).join(' | ')} |`,
    );
    lines.push(`| --- | ${summaries.flatMap(() => ['---', '---']).join(' | ')} |`);

    if (hasSmall) {
      const cells = summaries.flatMap((s) => {
        if (!s.read.small) return ['—', '—'];
        return [
          `${s.read.small.stats.coldMs.toFixed(1)}`,
          s.read.small.stats.warm?.median != null
            ? `${s.read.small.stats.warm.median.toFixed(1)}`
            : '—',
        ];
      });
      const label = summaries.find((s) => s.read.small)?.read.small?.path ?? 'small';
      lines.push(`| \`${truncatePath(label)}\` (small) | ${cells.join(' | ')} |`);
    }

    if (hasLarge) {
      const cells = summaries.flatMap((s) => {
        if (!s.read.large) return ['—', '—'];
        return [
          `${s.read.large.stats.coldMs.toFixed(1)}`,
          s.read.large.stats.warm?.median != null
            ? `${s.read.large.stats.warm.median.toFixed(1)}`
            : '—',
        ];
      });
      const label = summaries.find((s) => s.read.large)?.read.large?.path ?? 'large';
      lines.push(`| \`${truncatePath(label)}\` (large) | ${cells.join(' | ')} |`);
    }
    lines.push('');
  }

  // ── Multiplier summary ────────────────────────────────────────────────────
  const baseline = summaries.find((s) => s.backend.name === 'fs') ?? first;
  const others = summaries.filter((s) => s !== baseline);

  if (others.length > 0) {
    lines.push('## Payload size multiplier vs seekstone (fs)');
    lines.push('');
    lines.push(`Baseline: **${baseline.backend.name}** (${baseline.backend.description})`);
    lines.push('');
    lines.push(`| Adapter | Search payload (×) | Read small (×) | Read large (×) |`);
    lines.push(`| --- | --- | --- | --- |`);

    const baseSearchMean = avgSearchPayload(baseline);
    const baseSmallMean = baseline.read.small?.stats.payloadBytesMean ?? null;
    const baseLargeMean = baseline.read.large?.stats.payloadBytesMean ?? null;

    for (const s of others) {
      const searchMult =
        baseSearchMean > 0 ? `${(avgSearchPayload(s) / baseSearchMean).toFixed(1)}×` : '—';
      const smallMult =
        baseSmallMean && s.read.small?.stats.payloadBytesMean
          ? `${(s.read.small.stats.payloadBytesMean / baseSmallMean).toFixed(1)}×`
          : '—';
      const largeMult =
        baseLargeMean && s.read.large?.stats.payloadBytesMean
          ? `${(s.read.large.stats.payloadBytesMean / baseLargeMean).toFixed(1)}×`
          : '—';
      lines.push(`| **${s.backend.name}** | ${searchMult} | ${smallMult} | ${largeMult} |`);
    }
    lines.push('');
  }

  // ── Tool support matrix ───────────────────────────────────────────────────
  const toolNames: Array<[string, keyof import('./runner.js').ToolBenchmarks]> = [
    ['list_notes', 'list'],
    ['list_tags', 'listTags'],
    ['outline_note', 'outline'],
    ['get_backlinks', 'getBacklinks'],
    ['get_links', 'getLinks'],
    ['get_periodic_note', 'getPeriodicNote'],
  ];

  const hasToolData = summaries.some((s) => s.tools);
  if (hasToolData) {
    lines.push('## Tool support matrix');
    lines.push('');
    lines.push('✅ = benchmarked · ❌ = not supported · — = benchmark skipped (no sample path)');
    lines.push('');
    lines.push(`| Tool | ${summaries.map((s) => s.backend.name).join(' | ')} |`);
    lines.push(`| --- | ${summaries.map(() => '---').join(' | ')} |`);

    for (const [label, key] of toolNames) {
      const cells = summaries.map((s) => {
        if (!s.tools) return '❌';
        const entry = s.tools[key];
        if (entry === null) return '❌';
        if (entry === undefined) return '—';
        return '✅';
      });
      lines.push(`| \`${label}\` | ${cells.join(' | ')} |`);
    }
    lines.push('');

    // Per-tool latency comparison for tools all adapters share
    const sharedTools = toolNames.filter(([, key]) =>
      summaries.every((s) => s.tools?.[key] != null),
    );
    if (sharedTools.length > 0) {
      lines.push('### Tool latency comparison (ms)');
      lines.push('');
      lines.push(
        `| Tool | ${summaries.flatMap((s) => [`${s.backend.name} cold`, `${s.backend.name} warm p50`]).join(' | ')} |`,
      );
      lines.push(`| --- | ${summaries.flatMap(() => ['---', '---']).join(' | ')} |`);
      for (const [label, key] of sharedTools) {
        const cells = summaries.flatMap((s) => {
          const entry = s.tools?.[key];
          if (!entry) return ['—', '—'];
          const stats = 'stats' in entry ? entry.stats : entry;
          if (!stats || typeof stats !== 'object' || !('coldMs' in stats)) return ['—', '—'];
          return [
            `${(stats as import('./timer.js').RunStats).coldMs.toFixed(1)}`,
            `${(stats as import('./timer.js').RunStats).warm.median.toFixed(1)}`,
          ];
        });
        lines.push(`| \`${label}\` | ${cells.join(' | ')} |`);
      }
      lines.push('');
    }
  }

  // ── Adapter descriptions ──────────────────────────────────────────────────
  lines.push('## Adapters');
  lines.push('');
  for (const s of summaries) {
    lines.push(`- **${s.backend.name}**: ${s.backend.description}`);
  }
  lines.push('');

  return lines.join('\n');
}

function avgSearchPayload(s: BenchmarkSummary): number {
  const means = s.search.map((q) => q.stats.payloadBytesMean).filter((v) => v > 0);
  if (means.length === 0) return 0;
  return means.reduce((a, b) => a + b, 0) / means.length;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function truncatePath(p: string, maxLen = 40): string {
  if (p.length <= maxLen) return p;
  return `…${p.slice(-(maxLen - 1))}`;
}
