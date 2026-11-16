import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Command that launches the stub MCP server (adapters append their own args). */
export const STUB_CMD = [
  process.execPath,
  join(dirname(fileURLToPath(import.meta.url)), 'stub-mcp-server.mjs'),
];

export type Canned = Record<string, { text: string | string[]; isError?: boolean }>;

export interface StubSession {
  /** The tools/call requests the stub has received, in order. */
  calls(): Array<{ name: string; arguments: Record<string, unknown> }>;
  /** Restore the environment and delete the call log. */
  dispose(): void;
}

/**
 * Point the next spawned stub at a set of canned tool responses and a call
 * log. Children inherit process.env, so this works for every adapter.
 */
export function useStub(canned: Canned): StubSession {
  const dir = mkdtempSync(join(tmpdir(), 'seekstone-stub-'));
  const log = join(dir, 'calls.jsonl');
  process.env.STUB_CANNED = JSON.stringify(canned);
  process.env.STUB_CALL_LOG = log;
  return {
    calls() {
      let text = '';
      try {
        text = readFileSync(log, 'utf8').trim();
      } catch {
        // no tools/call reached the stub yet
      }
      return text ? text.split('\n').map((l) => JSON.parse(l)) : [];
    },
    dispose() {
      delete process.env.STUB_CANNED;
      delete process.env.STUB_CALL_LOG;
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
