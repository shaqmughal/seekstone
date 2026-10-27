import { countTokens } from '../bench/timer.js';

/**
 * Schema tax (SHA-341): the context a client loads at session start, before
 * the first tool call — every served tool's name, description and input
 * schema, plus the server's `instructions` string if it sends one.
 *
 * Sizes are taken from the tool list exactly as the server returned it over
 * MCP (`tools/list`), compact-JSON serialized the way it crossed the wire.
 * Clients reformat tool definitions before handing them to a model, so the
 * absolute token count is encoder-approximate; the cross-server ratios hold.
 */

export const TOKENIZER = 'tiktoken cl100k_base';

export const METHOD =
  'Tool list as served over MCP stdio (tools/list, all pages), each tool compact-JSON serialized; ' +
  'totalBytes/totalTokens cover the whole tools array, perTool covers each tool on its own ' +
  '(per-tool tokens do not sum exactly to the total). Tokens: tiktoken cl100k_base.';

export type SchemaTaxMode = 'read-write' | 'read-only';

/** What a server serves at session start. */
export interface ServedSurface {
  tools: Array<Record<string, unknown>>;
  instructions?: string;
}

export interface ToolCost {
  name: string;
  bytes: number;
  tokens: number;
}

export interface ModeCost {
  mode: SchemaTaxMode;
  toolCount: number;
  totalBytes: number;
  totalTokens: number;
  /** Size of the `initialize` instructions string (0 when the server sends none). */
  instructionsBytes: number;
  instructionsTokens: number;
  /** Most expensive first; ties broken by name so the order is deterministic. */
  perTool: ToolCost[];
}

export interface SchemaTaxReport {
  schemaVersion: 1;
  backend: string;
  tokenizer: string;
  method: string;
  modes: ModeCost[];
}

function cost(text: string): { bytes: number; tokens: number } {
  const bytes = Buffer.byteLength(text, 'utf8');
  return { bytes, tokens: countTokens(text, bytes) };
}

export function measureSurface(mode: SchemaTaxMode, surface: ServedSurface): ModeCost {
  const perTool = surface.tools.map((tool, i) => {
    if (typeof tool.name !== 'string' || tool.name === '') {
      throw new Error(`tools/list entry ${i} has no name`);
    }
    return { name: tool.name, ...cost(JSON.stringify(tool)) };
  });
  perTool.sort((a, b) => b.tokens - a.tokens || b.bytes - a.bytes || a.name.localeCompare(b.name));
  const total = cost(JSON.stringify(surface.tools));
  const instructions = surface.instructions ? cost(surface.instructions) : { bytes: 0, tokens: 0 };
  return {
    mode,
    toolCount: perTool.length,
    totalBytes: total.bytes,
    totalTokens: total.tokens,
    instructionsBytes: instructions.bytes,
    instructionsTokens: instructions.tokens,
    perTool,
  };
}

export function buildReport(backend: string, modes: ModeCost[]): SchemaTaxReport {
  return { schemaVersion: 1, backend, tokenizer: TOKENIZER, method: METHOD, modes };
}

/**
 * Human-readable differences between a fresh measurement and the committed
 * baseline: empty when they match exactly.
 */
export function diffReports(fresh: SchemaTaxReport, baseline: SchemaTaxReport): string[] {
  if (JSON.stringify(fresh) === JSON.stringify(baseline)) return [];
  const out: string[] = [];
  for (const f of fresh.modes) {
    const b = baseline.modes.find((m) => m.mode === f.mode);
    if (!b) {
      out.push(`${f.mode}: not in the baseline`);
      continue;
    }
    if (f.toolCount !== b.toolCount) out.push(`${f.mode}: ${b.toolCount} → ${f.toolCount} tools`);
    if (f.totalTokens !== b.totalTokens || f.totalBytes !== b.totalBytes) {
      out.push(
        `${f.mode}: ${b.totalTokens} → ${f.totalTokens} tokens (${b.totalBytes} → ${f.totalBytes} bytes)`,
      );
    }
    const before = new Map(b.perTool.map((t) => [t.name, t]));
    for (const t of f.perTool) {
      const prior = before.get(t.name);
      if (!prior) out.push(`${f.mode}: new tool ${t.name} (${t.tokens} tokens)`);
      else if (prior.bytes !== t.bytes) {
        out.push(`${f.mode}: ${t.name} ${prior.tokens} → ${t.tokens} tokens`);
      }
      before.delete(t.name);
    }
    for (const name of before.keys()) out.push(`${f.mode}: removed tool ${name}`);
  }
  for (const b of baseline.modes) {
    if (!fresh.modes.some((m) => m.mode === b.mode)) out.push(`${b.mode}: missing from the run`);
  }
  // Same numbers but different bytes elsewhere (method text, ordering, backend).
  if (out.length === 0) out.push('report metadata differs from the baseline');
  return out;
}
