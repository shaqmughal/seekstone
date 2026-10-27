import { countTokens } from '../bench/timer.js';

/**
 * Schema tax (SHA-341): the context a client can load at session start,
 * before the first tool call — every served tool's name, description and
 * input schema, the server's `instructions` string if it sends one, and any
 * prompts, resources and resource templates it advertises.
 *
 * Sizes are taken from the lists exactly as the server returned them over
 * MCP, compact-JSON serialized the way they crossed the wire. Clients
 * reformat definitions before handing them to a model, and some defer tool
 * schemas until a tool is needed, so the absolute token count is an
 * encoder-approximate upper bound; the cross-server ratios hold.
 */

export const TOKENIZER = 'tiktoken cl100k_base';

export const METHOD =
  'Tool list as served over MCP stdio (tools/list, all pages), each tool compact-JSON serialized; ' +
  'totalBytes/totalTokens cover the whole tools array, perTool covers each tool on its own ' +
  '(per-tool tokens do not sum exactly to the total). prompts/list, resources/list and ' +
  'resources/templates/list are measured the same way when the server advertises them. ' +
  'Tokens: tiktoken cl100k_base.';

export type SchemaTaxMode = 'read-write' | 'read-only';

type Items = Array<Record<string, unknown>>;

/** What a server serves at session start. */
export interface ServedSurface {
  tools: Items;
  instructions?: string;
  /** Present only when the server advertises the capability. */
  prompts?: Items;
  resources?: Items;
  resourceTemplates?: Items;
}

/** Size of one non-tool list; all zero when the server does not serve it. */
export interface ListCost {
  count: number;
  bytes: number;
  tokens: number;
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
  prompts: ListCost;
  resources: ListCost;
  resourceTemplates: ListCost;
  /** Most expensive first; ties broken by name so the order is deterministic. */
  perTool: ToolCost[];
}

/** The non-tool lists, in report order. */
export const EXTRA_LISTS = ['prompts', 'resources', 'resourceTemplates'] as const;

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
    prompts: listCost(surface.prompts),
    resources: listCost(surface.resources),
    resourceTemplates: listCost(surface.resourceTemplates),
    perTool,
  };
}

function listCost(items: Items | undefined): ListCost {
  if (!items || items.length === 0) return { count: 0, bytes: 0, tokens: 0 };
  return { count: items.length, ...cost(JSON.stringify(items)) };
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
    for (const list of EXTRA_LISTS) {
      const [now, was] = [f[list], b[list]];
      if (now.count !== was.count || now.bytes !== was.bytes) {
        out.push(
          `${f.mode}: ${list} ${was.count} → ${now.count} (${was.tokens} → ${now.tokens} tokens)`,
        );
      }
    }
  }
  for (const b of baseline.modes) {
    if (!fresh.modes.some((m) => m.mode === b.mode)) out.push(`${b.mode}: missing from the run`);
  }
  // Same numbers but different bytes elsewhere (method text, ordering, backend).
  if (out.length === 0) out.push('report metadata differs from the baseline');
  return out;
}
