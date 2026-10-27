import type { ModeCost, SchemaTaxReport } from './measure.js';

/** Renderer for the schema-tax report (SHA-341). */

const KB = 1024;

function fmtBytes(n: number): string {
  return n >= KB ? `${(n / KB).toFixed(1)} KB` : `${n} B`;
}
function fmtInt(n: number): string {
  return n.toLocaleString('en-US');
}

function modeLabel(m: ModeCost): string {
  return m.mode === 'read-only' ? 'Read-only (`SEEKSTONE_READ_ONLY=1`)' : 'Read-write (default)';
}

export function renderSchemaTaxMarkdown(r: SchemaTaxReport): string {
  const out: string[] = [];
  const push = (line = '') => out.push(line);

  push(`# Schema tax — ${r.backend}`);
  push();
  push(
    'What a client loads into context when a session starts, before any tool is called: the name, description and input schema of every tool the server offers, plus its instructions string if it sends one.',
  );
  push();
  push('| Mode | Tools | Tool list | Tokens (approx) | Instructions |');
  push('| --- | ---: | ---: | ---: | ---: |');
  for (const m of r.modes) {
    const instr = m.instructionsBytes === 0 ? 'none' : `${fmtInt(m.instructionsTokens)} tokens`;
    push(
      `| ${modeLabel(m)} | ${m.toolCount} | ${fmtBytes(m.totalBytes)} | ${fmtInt(m.totalTokens)} | ${instr} |`,
    );
  }
  push();

  for (const m of r.modes) {
    push(`## Per tool — ${modeLabel(m)}`);
    push();
    push('Most expensive first.');
    push();
    push('| Tool | Bytes | Tokens (approx) | Share |');
    push('| --- | ---: | ---: | ---: |');
    const sum = m.perTool.reduce((a, t) => a + t.tokens, 0);
    for (const t of m.perTool) {
      const share = ((t.tokens / sum) * 100).toFixed(1);
      push(`| \`${t.name}\` | ${fmtInt(t.bytes)} | ${fmtInt(t.tokens)} | ${share}% |`);
    }
    push();
  }

  push(`> **Method.** ${r.method}`);
  push(
    '> Clients reformat tool definitions before passing them to a model, so absolute counts vary by client and model. Comparisons between servers measured the same way still hold.',
  );
  push();
  return out.join('\n');
}
