import type { Backend, BackendResponse, ListEntry, SearchHit } from '../backend.js';
import { McpSubprocess } from './mcp-subprocess.js';

/**
 * Adapter for obsidian-mcp-server by cyanheads.
 * https://github.com/cyanheads/obsidian-mcp-server
 *
 * TypeScript, REST API architecture — requires Obsidian running with the
 * Local REST API plugin. Spawned via `npx obsidian-mcp-server` with
 * OBSIDIAN_API_KEY and OBSIDIAN_BASE_URL env vars.
 *
 * Tool mapping:
 *   obsidian_search_notes → search(query)
 *   obsidian_get_note     → read(path)
 *   obsidian_write_note   → write(path, content)
 *   obsidian_list_notes   → list(path?)
 */

export interface ObsidianMcpServerAdapterOptions {
  /** Bearer token from Obsidian Local REST API plugin settings. */
  apiKey: string;
  /**
   * Obsidian REST API base URL.
   * Defaults to https://127.0.0.1:27124 (the Local REST API plugin default).
   */
  baseUrl?: string;
  /** Override the spawn command. Defaults to ['npx', '--yes', 'obsidian-mcp-server']. */
  cmd?: string[];
}

export class ObsidianMcpServerAdapter implements Backend {
  readonly name = 'obsidian-mcp-server';
  readonly description = 'obsidian-mcp-server (cyanheads, REST API, requires Obsidian running)';

  private constructor(private readonly mcp: McpSubprocess) {}

  static async build(opts: ObsidianMcpServerAdapterOptions): Promise<ObsidianMcpServerAdapter> {
    const cmd = opts.cmd ??
      process.env.SEEKSTONE_OBSIDIAN_MCP_SERVER_CMD?.split(' ') ?? [
        'npx',
        '--yes',
        'obsidian-mcp-server',
      ];
    const env: Record<string, string> = {
      OBSIDIAN_API_KEY: opts.apiKey,
      OBSIDIAN_BASE_URL: opts.baseUrl ?? 'https://127.0.0.1:27124',
      OBSIDIAN_VERIFY_SSL: 'false',
      MCP_TRANSPORT_TYPE: 'stdio',
    };
    const mcp = await McpSubprocess.connect('obsidian-mcp-server', cmd, {
      env,
      initTimeout: 60_000,
    });
    return new ObsidianMcpServerAdapter(mcp);
  }

  async close(): Promise<void> {
    return this.mcp.close();
  }

  async search(query: string): Promise<BackendResponse<SearchHit[]>> {
    const text = await this.mcp.callTool('obsidian_search_notes', {
      mode: 'text',
      query,
      contextLength: 200,
    });
    let hits: SearchHit[] = [];
    try {
      // Response: { result: { mode, hits: [{ path, score, matches: [{ context }] }], totalCount } }
      const parsed = JSON.parse(text) as {
        result?: {
          hits?: Array<{
            path?: string;
            score?: number;
            matches?: Array<{ context?: string }>;
          }>;
        };
      };
      const rawHits = parsed.result?.hits ?? [];
      hits = rawHits.map((h) => ({
        path: h.path ?? '',
        score: h.score,
        snippet: h.matches?.[0]?.context,
      }));
    } catch {
      /* non-JSON response */
    }
    return { result: hits, payloadBytes: Buffer.byteLength(text, 'utf8'), payloadText: text };
  }

  async read(path: string): Promise<BackendResponse<string>> {
    const text = await this.mcp.callTool('obsidian_get_note', {
      format: 'content',
      target: { type: 'path', path },
    });
    return { result: text, payloadBytes: Buffer.byteLength(text, 'utf8'), payloadText: text };
  }

  async write(path: string, content: string): Promise<BackendResponse<void>> {
    await this.mcp.callTool('obsidian_write_note', {
      target: { type: 'path', path },
      content,
      overwrite: true,
    });
    return { result: undefined, payloadBytes: Buffer.byteLength(content, 'utf8') };
  }

  async list(path?: string): Promise<BackendResponse<ListEntry[]>> {
    const text = await this.mcp.callTool('obsidian_list_notes', {
      ...(path ? { path } : {}),
      depth: 1,
    });
    let entries: ListEntry[] = [];
    try {
      // Response: { result: { notes: [{ path, ... }] } } or flat array
      const parsed = JSON.parse(text) as
        | { result?: { notes?: Array<{ path?: string; isDirectory?: boolean }> } }
        | Array<{ path?: string; isDirectory?: boolean }>;
      const notes = Array.isArray(parsed) ? parsed : (parsed.result?.notes ?? []);
      entries = (notes as Array<{ path?: string; isDirectory?: boolean }>).map((n) => ({
        path: n.path ?? '',
        isDirectory: n.isDirectory ?? false,
      }));
    } catch {
      /* ignore */
    }
    return { result: entries, payloadBytes: Buffer.byteLength(text, 'utf8'), payloadText: text };
  }
}
