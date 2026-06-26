import type { BenchmarkSummary } from './runner.js';

/**
 * Multi-scale showcase renderer (SHA-189).
 *
 * Where `compare.ts` puts adapters side-by-side at a single vault size, this
 * pivots the other way: for each metric, rows are adapters and columns are
 * vault sizes (1k / 5k / 10k). The point it makes visually is the headline of
 * the whole benchmark — **seekstone stays flat as the vault grows while
 * REST-proxy and O(N) servers scale up with it.**
 */
export interface ScaleGroup {
  /** Note count for this vault, e.g. 1000. */
  size: number;
  summaries: BenchmarkSummary[];
}

export function renderScalingMarkdown(groups: ScaleGroup[]): string {
  const sorted = [...groups].sort((a, b) => a.size - b.size);
  const sizes = sorted.map((g) => g.size);
  const sizeLabel = (n: number) => (n >= 1000 ? `${n / 1000}k` : `${n}`);

  // Stable adapter ordering: filesystem-direct first (the story), then the rest.
  const order = [
    'seekstone',
    'fs',
    'mcpvault',
    'obsidian-mcp-pro',
    'obsidian-mcp',
    'rest',
    'obsidian-mcp-server',
    'mcp-obsidian',
  ];
  const adapters = [...new Set(sorted.flatMap((g) => g.summaries.map((s) => s.backend.name)))].sort(
    (a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    },
  );

  const get = (size: number, adapter: string): BenchmarkSummary | undefined =>
    sorted.find((g) => g.size === size)?.summaries.find((s) => s.backend.name === adapter);

  const L: string[] = [];
  const first = sorted[0]?.summaries[0];
  L.push('# Benchmark — scaling across vault sizes');
  L.push('');
  if (first) {
    L.push(
      `> ${first.machine.platform}/${first.machine.arch} · Node ${first.machine.node} · vault sizes: ${sizes.map(sizeLabel).join(' / ')} notes`,
    );
    L.push('');
  }
  L.push(
    'How each adapter behaves as the vault grows. **Lower and flatter is better** — a filesystem-direct, indexed server should barely move; a REST-proxy or full-scan server climbs with vault size.',
  );
  L.push('');

  const header = (lead: string) => {
    L.push(
      `| ${lead} | ${sizes.map(sizeLabel).join(' | ')} | scaling 1k→${sizeLabel(sizes[sizes.length - 1] ?? 0)} |`,
    );
    L.push(`| --- | ${sizes.map(() => '---:').join(' | ')} | ---: |`);
  };
  const scalingFactor = (vals: Array<number | null>): string => {
    const lo = vals[0];
    const hi = vals[vals.length - 1];
    if (lo == null || hi == null || lo === 0) return '—';
    return `${(hi / lo).toFixed(1)}×`;
  };

  // ── Search latency (warm, mean across queries) — the headline metric. ──
  L.push('## Search latency — warm, mean across queries (ms)');
  L.push('');
  header('Adapter');
  for (const a of adapters) {
    const vals = sizes.map((sz) => meanWarmSearchMs(get(sz, a)));
    const cells = vals.map((v) => (v == null ? '—' : v.toFixed(1)));
    L.push(`| **${a}** | ${cells.join(' | ')} | ${scalingFactor(vals)} |`);
  }
  L.push('');

  // ── Search payload (mean across queries). ──
  L.push('## Search payload — mean across queries (context tax)');
  L.push('');
  header('Adapter');
  for (const a of adapters) {
    const vals = sizes.map((sz) => meanSearchPayload(get(sz, a)));
    const cells = vals.map((v) => (v == null ? '—' : formatBytes(v)));
    L.push(`| **${a}** | ${cells.join(' | ')} | ${scalingFactor(vals)} |`);
  }
  L.push('');

  // ── Large-read payload. ──
  L.push('## Large-note read payload');
  L.push('');
  header('Adapter');
  for (const a of adapters) {
    const vals = sizes.map((sz) => get(sz, a)?.read.large?.stats.payloadBytesMean ?? null);
    const cells = vals.map((v) => (v == null ? '—' : formatBytes(v)));
    L.push(`| **${a}** | ${cells.join(' | ')} | ${scalingFactor(vals)} |`);
  }
  L.push('');

  // ── Multiplier vs seekstone at the largest size. ──
  const big = sizes[sizes.length - 1];
  if (big != null) {
    const base = meanWarmSearchMs(get(big, 'seekstone'));
    L.push(`## Search latency vs seekstone at ${sizeLabel(big)} notes`);
    L.push('');
    if (base && base > 0) {
      L.push(`| Adapter | warm search (ms) | × seekstone |`);
      L.push(`| --- | ---: | ---: |`);
      for (const a of adapters) {
        const v = meanWarmSearchMs(get(big, a));
        if (v == null) {
          L.push(`| **${a}** | — | — |`);
        } else {
          L.push(`| **${a}** | ${v.toFixed(1)} | ${(v / base).toFixed(0)}× |`);
        }
      }
    }
    L.push('');
  }

  // ── Partial coverage: adapters present at some sizes but not others. ──
  const missing = adapters.flatMap((a) =>
    sizes.filter((sz) => !get(sz, a)).map((sz) => `${a}@${sizeLabel(sz)}`),
  );
  if (missing.length > 0) {
    L.push('## Partial coverage');
    L.push('');
    L.push(`> Captured at some sizes only: ${missing.map((m) => `\`${m}\``).join(', ')}.`);
    L.push('');
  }

  // ── Adapters not in this run at all, with why. ──
  const KNOWN: Record<string, string> = {
    'obsidian-mcp-pro': 'filesystem-direct; pending adapter read-path fix',
    'obsidian-mcp':
      'filesystem-direct; slow synchronous init at scale (raise `SEEKSTONE_MCP_INIT_TIMEOUT`)',
    rest: 'requires Obsidian running + Local REST API plugin — captured manually',
    'obsidian-mcp-server': 'requires Obsidian running + Local REST API plugin — captured manually',
    'mcp-obsidian': 'requires Obsidian running + Local REST API plugin — captured manually',
  };
  const absent = Object.keys(KNOWN).filter((a) => !adapters.includes(a));
  if (absent.length > 0) {
    L.push('## Not yet captured');
    L.push('');
    for (const a of absent) L.push(`- **${a}** — ${KNOWN[a]}`);
    L.push('');
    L.push('See the harness README for the manual REST-capture procedure.');
    L.push('');
  }

  return `${L.join('\n')}\n`;
}

function meanWarmSearchMs(s: BenchmarkSummary | undefined): number | null {
  if (!s) return null;
  const vals = s.search.map((q) => q.stats.warm.median).filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function meanSearchPayload(s: BenchmarkSummary | undefined): number | null {
  if (!s) return null;
  const vals = s.search.map((q) => q.stats.payloadBytesMean).filter((v) => v > 0);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
