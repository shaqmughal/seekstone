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
  capabilities?: { tools?: unknown; prompts?: unknown; resources?: unknown };
}

/**
 * How long after the child exits to keep reading replies it wrote just before
 * exiting, when stdout stays open because a helper process still holds it.
 */
const EXIT_DRAIN_MS = 250;

/**
 * Shared MCP JSON-RPC stdio subprocess handler.
 * Spawns a process, performs the initialize handshake, and provides
 * callTool() for all three competitor adapters to share.
 */
export class McpSubprocess {
  private nextId = 1;
  /** What the server answered to `initialize` (serverInfo, instructions). */
  initializeResult: McpInitializeResult = {};
  /** Set once the child has exited or failed to start. */
  private exited: Error | undefined;
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

    // Without these, a child that dies leaves every request waiting out its
    // timeout, and a spawn failure (ENOENT) crashes the harness. `close` fires
    // after stdout has drained, so replies sent just before exit still land.
    // But `close` never fires while a helper process (an npx/uvx wrapper's
    // child, say) still holds stdout, so `exit` also fails the requests after
    // a short drain period.
    proc.on('error', (err) =>
      sub.fail(new Error(`${serverName} failed to start \`${cmd.join(' ')}\`: ${err.message}`)),
    );
    const exitError = (code: number | null, signal: NodeJS.Signals | null) =>
      new Error(`${serverName} exited with ${signal ? `signal ${signal}` : `code ${code}`}`);
    let drain: ReturnType<typeof setTimeout> | undefined;
    proc.on('exit', (code, signal) => {
      drain = setTimeout(() => sub.fail(exitError(code, signal)), EXIT_DRAIN_MS);
      drain.unref();
    });
    proc.on('close', (code, signal) => {
      clearTimeout(drain);
      sub.fail(exitError(code, signal));
    });
    // Writes to a dead child fail with EPIPE; the close handler reports the exit.
    proc.stdin?.on('error', () => {});

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
  listTools(timeout = 60_000): Promise<Array<Record<string, unknown>>> {
    return this.listAll('tools/list', 'tools', timeout);
  }

  /**
   * Every item of a paginated MCP list (`tools/list`, `prompts/list`,
   * `resources/list`, `resources/templates/list`), following `nextCursor`.
   */
  async listAll(
    method: string,
    key: string,
    timeout = 60_000,
  ): Promise<Array<Record<string, unknown>>> {
    const items: Array<Record<string, unknown>> = [];
    let cursor: string | undefined;
    do {
      const resp = await this.rpc(method, cursor ? { cursor } : {}, timeout);
      const page = resp.result as Record<string, unknown> | undefined;
      const batch = page?.[key];
      if (Array.isArray(batch)) items.push(...batch);
      cursor = typeof page?.nextCursor === 'string' ? page.nextCursor : undefined;
    } while (cursor);
    return items;
  }

  async callTool(name: string, args: Record<string, unknown>, timeout = 60_000): Promise<string> {
    const resp = await this.rpc('tools/call', { name, arguments: args }, timeout);
    const tool = resp.result as McpToolResult;
    if (tool?.isError) {
      throw new Error(`${this.serverName} ${name}: ${tool.content?.[0]?.text ?? 'error'}`);
    }
    return tool?.content?.[0]?.text ?? '';
  }

  /**
   * Call a tool and return its text whether or not it is an `isError` result.
   * A JSON-RPC error reply (e.g. unknown tool) still rejects, as in `callTool`.
   */
  async callToolRaw(
    name: string,
    args: Record<string, unknown>,
    timeout = 60_000,
  ): Promise<{ text: string; isError: boolean }> {
    const resp = await this.rpc('tools/call', { name, arguments: args }, timeout);
    const tool = resp.result as McpToolResult | undefined;
    // rpc() rejects on an `error` reply, so no result here means the reply
    // carried neither `result` nor `error`.
    if (!tool) return { text: '{}', isError: true };
    const text = (tool.content ?? []).map((c) => c.text ?? '').join('\n');
    return { text, isError: tool.isError === true };
  }

  async close(): Promise<void> {
    for (const [, w] of this.pending) {
      clearTimeout(w.timer);
      w.reject(new Error('closed'));
    }
    this.pending.clear();
    this.rl.close();
    if (this.exited || this.proc.exitCode !== null || this.proc.signalCode !== null) return;
    this.proc.kill();
    await new Promise<void>((res) => this.proc.once('exit', res));
  }

  /** The child is gone: reject everything pending and every later request. */
  private fail(err: Error): void {
    if (this.exited) return;
    this.exited = err;
    for (const [, w] of this.pending) {
      clearTimeout(w.timer);
      w.reject(err);
    }
    this.pending.clear();
  }

  private rpc(method: string, params: unknown, timeout = 60_000): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      if (this.exited) {
        reject(this.exited);
        return;
      }
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
