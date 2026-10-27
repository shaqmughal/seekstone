import { type ChildProcess, spawn } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';

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

export interface McpToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/** The `initialize` result fields the harness reads (the rest is ignored). */
export interface McpInitializeResult {
  serverInfo?: { name?: string; version?: string };
  instructions?: string;
}

/**
 * Shared MCP JSON-RPC stdio subprocess handler.
 * Spawns a process, performs the initialize handshake, and provides
 * callTool() for all three competitor adapters to share.
 */
export class McpSubprocess {
  private nextId = 1;
  /** What the server answered to `initialize` (serverInfo, instructions). */
  initializeResult: McpInitializeResult = {};
  private readonly pending = new Map<
    number,
    {
      resolve: (v: JsonRpcResponse) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  private constructor(
    private readonly proc: ChildProcess,
    private readonly rl: Interface,
    private readonly stdin_: NodeJS.WritableStream,
    private readonly serverName: string,
  ) {}

  static async connect(
    serverName: string,
    cmd: string[],
    // replaceEnv: use `env` as the child's whole environment instead of
    // layering it over process.env (so nothing from the caller's shell leaks in).
    opts: { env?: Record<string, string>; initTimeout?: number; replaceEnv?: boolean } = {},
  ): Promise<McpSubprocess> {
    const [bin, ...args] = cmd;
    const proc = spawn(bin ?? '', args, {
      stdio: ['pipe', 'pipe', 'ignore'],
      env: opts.replaceEnv ? { ...opts.env } : { ...process.env, ...opts.env },
    });

    const rl = createInterface({ input: proc.stdout as NodeJS.ReadableStream });
    const sub = new McpSubprocess(proc, rl, proc.stdin as NodeJS.WritableStream, serverName);

    rl.on('line', (line) => {
      if (!line.trim()) return;
      let msg: JsonRpcResponse;
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }
      if (msg.id == null) return;
      const waiter = sub.pending.get(msg.id as number);
      if (!waiter) return;
      sub.pending.delete(msg.id as number);
      clearTimeout(waiter.timer);
      if (msg.error) {
        waiter.reject(new Error(`${serverName} ${msg.error.code}: ${msg.error.message}`));
      } else {
        waiter.resolve(msg);
      }
    });

    // Some servers index the whole vault synchronously during initialize, which
    // is slow on large vaults. SEEKSTONE_MCP_INIT_TIMEOUT (ms) overrides the
    // per-adapter default so the scaling run can give slow servers more headroom.
    const initTimeout =
      Number(process.env.SEEKSTONE_MCP_INIT_TIMEOUT) || opts.initTimeout || 30_000;
    const init = await sub.rpc(
      'initialize',
      {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'seekstone-harness', version: '1.0' },
      },
      initTimeout,
    );
    sub.initializeResult = (init.result ?? {}) as McpInitializeResult;
    sub.notify('notifications/initialized', {});
    return sub;
  }

  /** Every tool the server serves, following `nextCursor` pagination. */
  async listTools(timeout = 60_000): Promise<Array<Record<string, unknown>>> {
    const tools: Array<Record<string, unknown>> = [];
    let cursor: string | undefined;
    do {
      const resp = await this.rpc('tools/list', cursor ? { cursor } : {}, timeout);
      const page = resp.result as { tools?: Array<Record<string, unknown>>; nextCursor?: string };
      tools.push(...(page?.tools ?? []));
      cursor = page?.nextCursor;
    } while (cursor);
    return tools;
  }

  async callTool(name: string, args: Record<string, unknown>, timeout = 60_000): Promise<string> {
    const resp = await this.rpc('tools/call', { name, arguments: args }, timeout);
    const tool = resp.result as McpToolResult;
    if (tool?.isError) {
      throw new Error(`${this.serverName} ${name}: ${tool.content?.[0]?.text ?? 'error'}`);
    }
    return tool?.content?.[0]?.text ?? '';
  }

  async close(): Promise<void> {
    for (const [, w] of this.pending) {
      clearTimeout(w.timer);
      w.reject(new Error('closed'));
    }
    this.pending.clear();
    this.rl.close();
    this.proc.kill();
    await new Promise<void>((res) => this.proc.once('exit', res));
  }

  private rpc(method: string, params: unknown, timeout = 60_000): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${this.serverName} timeout: ${method}`));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.stdin_.write(
        `${JSON.stringify({ jsonrpc: '2.0', id, method, params } as JsonRpcRequest)}\n`,
      );
    });
  }

  private notify(method: string, params: unknown): void {
    this.stdin_.write(`${JSON.stringify({ jsonrpc: '2.0', method, params } as JsonRpcRequest)}\n`);
  }
}
