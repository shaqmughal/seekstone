import { type ChildProcess, spawn } from 'node:child_process';
import { type Interface, createInterface } from 'node:readline';
import type { Backend, BackendResponse, ListEntry, SearchHit } from '../backend.js';

/**
 * Backend adapter for mcpvault by bitbonsai (@bitbonsai/mcpvault).
 *
 * mcpvault is a filesystem-direct MCP server that reads the vault without
 * Obsidian running, making it the closest architectural peer to seekstone.
 * This adapter spawns it as a subprocess and communicates via MCP JSON-RPC
 * over stdio — the same transport Claude uses — so payload bytes reflect
 * exactly what an LLM client would receive.
 *
 * Tool mapping:
 *   search_notes    → search(query)
 *   read_note       → read(path)
 *   write_note      → write(path, content)
 *   list_directory  → list(path?)
 */

export interface McpvaultAdapterOptions {
  /** Absolute path to the vault root. Passed as positional arg to mcpvault. */
  vaultRoot: string;
  /**
   * Command to invoke mcpvault. Defaults to `npx @bitbonsai/mcpvault`.
   * Override via SEEKSTONE_MCPVAULT_CMD env var for a pre-installed binary.
   */
  cmd?: string[];
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

interface McpToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export class McpvaultAdapter implements Backend {
  readonly name = 'mcpvault';
  readonly description = 'mcpvault @bitbonsai (filesystem-direct, MCP stdio subprocess)';

  private readonly proc: ChildProcess;
  private readonly rl: Interface;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (v: JsonRpcResponse) => void; reject: (e: Error) => void }
  >();

  private readonly stdin: NodeJS.WritableStream;

  private constructor(proc: ChildProcess, rl: Interface) {
    this.proc = proc;
    this.rl = rl;
    this.stdin = proc.stdin as NodeJS.WritableStream;
  }

  static async build(opts: McpvaultAdapterOptions): Promise<McpvaultAdapter> {
    const cmdParts = opts.cmd ??
      process.env.SEEKSTONE_MCPVAULT_CMD?.split(' ') ?? ['npx', '--yes', '@bitbonsai/mcpvault'];

    const [bin, ...args] = cmdParts;
    const proc = spawn(bin ?? 'npx', [...args, opts.vaultRoot], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const rl = createInterface({ input: proc.stdout as NodeJS.ReadableStream });
    const adapter = new McpvaultAdapter(proc, rl);

    // Route incoming lines to pending request callbacks.
    rl.on('line', (line) => {
      if (!line.trim()) return;
      let msg: JsonRpcResponse;
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }
      if (msg.id == null) return; // notification, ignore
      const waiter = adapter.pending.get(msg.id as number);
      if (!waiter) return;
      adapter.pending.delete(msg.id as number);
      if (msg.error) {
        waiter.reject(new Error(`mcpvault error ${msg.error.code}: ${msg.error.message}`));
      } else {
        waiter.resolve(msg);
      }
    });

    // MCP initialize handshake.
    await adapter.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'seekstone-harness', version: '1.0' },
    });
    adapter.notify('notifications/initialized', {});

    return adapter;
  }

  async close(): Promise<void> {
    this.rl.close();
    this.proc.kill();
    await new Promise<void>((resolve) => {
      this.proc.once('exit', () => {
        resolve();
      });
    });
  }

  async search(query: string): Promise<BackendResponse<SearchHit[]>> {
    const text = await this.callTool('search_notes', {
      query,
      limit: 10,
      searchContent: true,
      searchFrontmatter: false,
    });

    let hits: SearchHit[] = [];
    try {
      // mcpvault returns minified JSON with abbreviated keys:
      // [{ p: path, t: title, ex: excerpt, mc: matchCount, ln: lineNumber }]
      const raw = JSON.parse(text) as Array<{
        p?: string;
        t?: string;
        ex?: string;
        mc?: number;
        score?: number;
      }>;
      hits = raw.map((h) => ({
        path: h.p ?? '',
        score: h.score,
        snippet: h.ex,
      }));
    } catch {
      // non-JSON response (e.g. "No results found") — empty hits
    }

    return { result: hits, payloadBytes: Buffer.byteLength(text, 'utf8'), payloadText: text };
  }

  async read(path: string): Promise<BackendResponse<string>> {
    const text = await this.callTool('read_note', { path });
    // Response is JSON: { fm: {...}, content: "body text" }
    let content = text;
    try {
      const parsed = JSON.parse(text) as { content?: string; fm?: unknown };
      // Extract just the body for consistency with the fs adapter (raw markdown body).
      // payloadBytes still measures the full response (fm + content) — that's the real context tax.
      content = parsed.content ?? text;
    } catch {
      // plain text fallback
    }
    return { result: content, payloadBytes: Buffer.byteLength(text, 'utf8'), payloadText: text };
  }

  async write(path: string, content: string): Promise<BackendResponse<void>> {
    await this.callTool('write_note', { path, content, mode: 'overwrite' });
    const buf = Buffer.from(content, 'utf8');
    return { result: undefined, payloadBytes: buf.byteLength };
  }

  async list(path = '/'): Promise<BackendResponse<ListEntry[]>> {
    const text = await this.callTool('list_directory', { path });
    let result: ListEntry[] = [];
    try {
      const parsed = JSON.parse(text) as { dirs?: string[]; files?: string[] };
      const prefix = path === '/' ? '' : `${path}/`;
      result = [
        ...(parsed.dirs ?? []).map((d) => ({ path: `${prefix}${d}`, isDirectory: true })),
        ...(parsed.files ?? []).map((f) => ({ path: `${prefix}${f}`, isDirectory: false })),
      ];
    } catch {
      // ignore parse errors
    }
    return { result, payloadBytes: Buffer.byteLength(text, 'utf8'), payloadText: text };
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const resp = await this.request('tools/call', { name, arguments: args });
    const tool = resp.result as McpToolResult;
    if (tool?.isError) {
      throw new Error(`mcpvault tool ${name} error: ${tool.content?.[0]?.text ?? 'unknown'}`);
    }
    return tool?.content?.[0]?.text ?? '';
  }

  private request(method: string, params: unknown): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    const msg: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.stdin.write(`${JSON.stringify(msg)}\n`);
    });
  }

  private notify(method: string, params: unknown): void {
    const msg: JsonRpcRequest = { jsonrpc: '2.0', method, params };
    this.stdin.write(`${JSON.stringify(msg)}\n`);
  }
}
