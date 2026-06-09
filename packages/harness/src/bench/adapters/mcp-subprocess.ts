import { type ChildProcess, spawn } from 'node:child_process';
import { type Interface, createInterface } from 'node:readline';

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

/**
 * Shared MCP JSON-RPC stdio subprocess handler.
 * Spawns a process, performs the initialize handshake, and provides
 * callTool() for all three competitor adapters to share.
 */
export class McpSubprocess {
  private nextId = 1;
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
    opts: { env?: Record<string, string>; initTimeout?: number } = {},
  ): Promise<McpSubprocess> {
    const [bin, ...args] = cmd;
    const proc = spawn(bin ?? '', args, {
      stdio: ['pipe', 'pipe', 'ignore'],
      env: { ...process.env, ...opts.env },
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

    await sub.rpc(
      'initialize',
      {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'seekstone-harness', version: '1.0' },
      },
      opts.initTimeout ?? 30_000,
    );
    sub.notify('notifications/initialized', {});
    return sub;
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
