// Stub MCP server for mcp-subprocess.test.ts. Speaks newline-delimited
// JSON-RPC on stdio and answers with fixed responses. Tool names pick the
// behaviour: "echo", "fail" (isError result), "empty" (reply with no result
// and no error), "silent" (no reply), "exit" (process exits with code 7),
// "orphan" (spawns a detached helper that inherits stdout, writes its pid to
// `arguments.pidFile`, then exits with code 5 while the helper keeps stdout
// open). Any other tool gets a JSON-RPC error.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const PAGES = {
  '': { tools: [{ name: 'a' }, { name: 'b' }], nextCursor: 'p2' },
  p2: { tools: [{ name: 'c' }], nextCursor: 'p3' },
  p3: { tools: [{ name: 'd' }] },
};

function send(msg) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);
}

function handle({ id, method, params }) {
  if (id == null) return;
  if (method === 'initialize') {
    send({
      id,
      result: { serverInfo: { name: 'stub', version: '9.9' }, instructions: 'stub instructions' },
    });
    return;
  }
  if (method === 'tools/list') {
    send({ id, result: PAGES[params?.cursor ?? ''] ?? { tools: [] } });
    return;
  }
  if (method === 'tools/call') {
    switch (params?.name) {
      case 'echo':
        send({
          id,
          result: {
            content: [
              { type: 'text', text: 'first' },
              { type: 'text', text: 'second' },
            ],
          },
        });
        return;
      case 'fail':
        send({ id, result: { content: [{ type: 'text', text: 'boom' }], isError: true } });
        return;
      case 'empty':
        send({ id });
        return;
      case 'silent':
        return;
      case 'exit':
        process.exit(7);
        return;
      case 'orphan': {
        const helper = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], {
          detached: true,
          stdio: ['ignore', 'inherit', 'ignore'],
        });
        helper.unref();
        writeFileSync(params.arguments.pidFile, String(helper.pid));
        process.exit(5);
        return;
      }
      default:
        send({ id, error: { code: -32601, message: 'unknown tool' } });
        return;
    }
  }
  send({ id, error: { code: -32601, message: 'unknown method' } });
}

createInterface({ input: process.stdin }).on('line', (line) => {
  if (line.trim()) handle(JSON.parse(line));
});
