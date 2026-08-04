import type { ScenarioSummary, TaskResult } from './scenarios.js';

/**
 * Renderers for the tokens-per-task scenario benchmark (SHA-274).
 *
 * `renderScenarioMarkdown` is the per-backend report; the comparison renderer
 * is the headline artifact — the "tokens per answered question" table meant
 * for the README and the public leaderboard.
 */

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
function fmtTokens(n: number): string {
  return n.toLocaleString('en-US');
}

const ENCODER_FOOTNOTE =
  '> Token counts are encoder-approximate: tiktoken `cl100k_base` (an OpenAI encoder) on the raw payload text; per-model tokenizers differ in absolute counts but the cross-adapter ratios hold. Steps without raw text fall back to bytes÷4.';

const NO_HITS_FOOTNOTE =
  '> † Search returned no hits — the task went unanswered. The payload is the cost of the failed attempt, not of an answer; a low number here is a retrieval failure, not a win.';

/** A search-read sequence that never got to a read found nothing to answer with. */
function noHits(t: TaskResult): boolean {
  return t.strategy === 'search-read' && !t.steps.some((s) => s.op === 'read');
}

export function renderScenarioMarkdown(s: ScenarioSummary): string {
  const out: string[] = [];
  const push = (line = '') => out.push(line);

  push(`# Scenarios — ${s.label}`);
  push();
  push(`- **Adapter:** ${s.backend.description}`);
  push(`- **Snapshot:** ${s.snapshotDate}`);
  push(`- **Runs per task:** ${s.runs} (cold = run 1; warm = runs 2..N)`);
  push(
    `- **Machine:** ${s.machine.platform}/${s.machine.arch}, Node ${s.machine.node}, ${s.machine.cpus} logical CPUs`,
  );
  push();
  push(
    'Each task is one question an agent must gather context to answer. Payload and tokens are summed across every call in the sequence — the context tax per answered question.',
  );
  push();

  push('| Task | Strategy | Calls | Payload | Tokens (approx) | Cold | Warm p50 |');
  push('| --- | --- | ---: | ---: | ---: | ---: | ---: |');
  for (const t of s.tasks) {
    const mark = noHits(t) ? '†' : '';
    push(
      `| ${t.id}${mark} | ${t.strategy} | ${t.calls} | ${fmtBytes(t.totalPayloadBytes)} | ${fmtTokens(t.totalPayloadTokens)} | ${fmtMs(t.latency.coldMs)} | ${fmtMs(t.latency.warm.median)} |`,
    );
  }
  push();
  if (s.tasks.some(noHits)) {
    push(NO_HITS_FOOTNOTE);
    push();
  }
  const unstable = s.tasks.filter((t) => !t.payloadStable);
  if (unstable.length > 0) {
    push(
      `> **Payload not byte-stable across runs** for: ${unstable.map((t) => `\`${t.id}\``).join(', ')}. Totals above are from run 1.`,
    );
    push();
  }
  push(ENCODER_FOOTNOTE);
  push();

  push('## Step breakdown (run 1)');
  push();
  for (const t of s.tasks) {
    push(`### ${t.id}`);
    push();
    push(`> ${t.question}`);
    push();
    push('| # | Call | Target | Payload | Tokens (approx) |');
    push('| ---: | --- | --- | ---: | ---: |');
    t.steps.forEach((step, i) => {
      push(
        `| ${i + 1} | \`${step.op}\` | \`${mdCellEscape(step.target)}\` | ${fmtBytes(step.payloadBytes)} | ${fmtTokens(step.payloadTokens)} |`,
      );
    });
    push();
  }

  return out.join('\n');
}

export function renderScenarioComparisonMarkdown(summaries: ScenarioSummary[]): string {
  const first = summaries[0];
  if (!first) return '# Scenario Comparison\n\nNo data.\n';

  // Stable label ordering: seekstone first, its ablation right after, then the
  // filesystem-direct field, then the rest — same story-order as scaling.ts.
  const order = [
    'seekstone',
    'seekstone-multicall',
    'fs',
    'mcpvault',
    'obsidian-mcp-pro',
    'obsidian-mcp',
    'obsidian-mcp-rs',
    'obsidian-tc',
    'obsidian-tc-facade',
    'rest',
    'obsidian-mcp-server',
    'mcp-obsidian',
  ];
  const sorted = [...summaries].sort((a, b) => {
    const ia = order.indexOf(a.label);
    const ib = order.indexOf(b.label);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const taskIds = [...new Set(sorted.flatMap((s) => s.tasks.map((t) => t.id)))];
  const get = (s: ScenarioSummary, id: string): TaskResult | undefined =>
    s.tasks.find((t) => t.id === id);

  const L: string[] = [];
  L.push('# Tokens per answered question — scenario comparison');
  L.push('');
  L.push(
    `> Generated ${first.snapshotDate.slice(0, 10)} · ${first.runs} runs per task · ${first.machine.platform}/${first.machine.arch} · Node ${first.machine.node}`,
  );
  L.push('');
  L.push(
    'Total context an agent consumes to answer each question: one `context_pack` call on backends that support it, versus search → read ×K → backlinks everywhere else. Lower is better.',
  );
  L.push('');

  const header = (lead: string) => {
    L.push(`| ${lead} | ${sorted.map((s) => s.label).join(' | ')} |`);
    L.push(`| --- | ${sorted.map(() => '---:').join(' | ')} |`);
  };

  const anyNoHits = sorted.some((s) => s.tasks.some(noHits));

  L.push('## Tokens (approx) per task');
  L.push('');
  header('Task');
  for (const id of taskIds) {
    const cells = sorted.map((s) => {
      const t = get(s, id);
      return t ? `${fmtTokens(t.totalPayloadTokens)}${noHits(t) ? '†' : ''}` : '—';
    });
    L.push(`| ${id} | ${cells.join(' | ')} |`);
  }
  L.push('');
  L.push(ENCODER_FOOTNOTE);
  L.push('');
  if (anyNoHits) {
    L.push(NO_HITS_FOOTNOTE);
    L.push('');
  }

  L.push('## Payload bytes per task');
  L.push('');
  header('Task');
  for (const id of taskIds) {
    const cells = sorted.map((s) => {
      const t = get(s, id);
      return t ? fmtBytes(t.totalPayloadBytes) : '—';
    });
    L.push(`| ${id} | ${cells.join(' | ')} |`);
  }
  L.push('');

  L.push('## Calls per task');
  L.push('');
  header('Task');
  for (const id of taskIds) {
    const cells = sorted.map((s) => {
      const t = get(s, id);
      return t ? `${t.calls}` : '—';
    });
    L.push(`| ${id} | ${cells.join(' | ')} |`);
  }
  L.push('');

  // ── Multiplier vs seekstone ────────────────────────────────────────────────
  const baseline = sorted.find((s) => s.label === 'seekstone');
  if (baseline) {
    const others = sorted.filter((s) => s !== baseline);
    if (others.length > 0) {
      L.push('## Context multiplier vs seekstone (tokens)');
      L.push('');
      header('Task');
      for (const id of taskIds) {
        const base = get(baseline, id);
        const cells = sorted.map((s) => {
          if (s === baseline) return '1.0×';
          const t = get(s, id);
          if (!t || !base || base.totalPayloadTokens === 0) return '—';
          // A no-hit run has no answer to price — a multiplier would read as a win.
          if (noHits(t)) return '—†';
          return `${(t.totalPayloadTokens / base.totalPayloadTokens).toFixed(1)}×`;
        });
        L.push(`| ${id} | ${cells.join(' | ')} |`);
      }
      L.push('');
    }
  }

  L.push('## Adapters');
  L.push('');
  for (const s of sorted) {
    const suffix = s.label.endsWith('-multicall')
      ? ' — ablation: context_pack disabled, forced down the search→read path'
      : '';
    L.push(`- **${s.label}**: ${s.backend.description}${suffix}`);
  }
  L.push('');

  return L.join('\n');
}

function mdCellEscape(s: string): string {
  return s.replaceAll('|', '\\|');
}
