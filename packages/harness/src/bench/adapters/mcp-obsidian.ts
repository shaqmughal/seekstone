import type { Backend, BackendResponse, ListEntry, SearchHit } from '../backend.js';
import { McpSubprocess } from './mcp-subprocess.js';

/**
 * Adapter for mcp-obsidian by MarkusPfundstein.
 * https://github.com/MarkusPfundstein/mcp-obsidian
 *
 * Python-based, REST API architecture — requires Obsidian running with the
 * Local REST API plugin. Spawned via `uvx mcp-obsidian`.
 *
 * Tool mapping:
 *   obsidian_simple_search      → search(query)
 *   obsidian_get_file_contents  → read(path)
 *   obsidian_put_content        → write(path, content)
 *   obsidian_list_files_in_vault / obsidian_list_files_in_dir → list(path?)
 */

export interface McpObsidianAdapterOptions {
  /** Bearer token from Obsidian Local REST API plugin settings. */
  apiKey: string;
  /** Obsidian REST API host. Defaults to 127.0.0.1. */
  host?: string;
  /** Obsidian REST API port. Defaults to 27124. */
  port?: number;
  /** Protocol, 'https' or 'http'. Defaults to 'https'. */
  protocol?: string;
  /** Override the spawn command. Defaults to ['uvx', 'mcp-obsidian']. */
  cmd?: string[];
}

export class McpObsidianAdapter implements Backend {
  readonly name = 'mcp-obsidian';
  readonly description = 'mcp-obsidian (MarkusPfundstein, REST API, requires Obsidian running)';

  private constructor(private readonly mcp: McpSubprocess) {}

  static async build(opts: McpObsidianAdapterOptions): Promise<McpObsidianAdapter> {
    const cmd = opts.cmd ??
      process.env.SEEKSTONE_MCP_OBSIDIAN_CMD?.split(' ') ?? ['uvx', 'mcp-obsidian'];
    const env: Record<string, string> = {
      OBSIDIAN_API_KEY: opts.apiKey,
      OBSIDIAN_HOST: opts.host ?? '127.0.0.1',
      OBSIDIAN_PORT: String(opts.port ?? 27124),
      OBSIDIAN_PROTOCOL: opts.protocol ?? 'https',
    };
    const mcp = await McpSubprocess.connect('mcp-obsidian', cmd, { env, initTimeout: 60_000 });
    return new McpObsidianAdapter(mcp);
  }

  async close(): Promise<void> {
    return this.mcp.close();
  }

  async search(query: string): Promise<BackendResponse<SearchHit[]>> {
    const text = await this.mcp.callTool('obsidian_simple_search', {
      query,
      context_length: 200,
    });
    let hits: SearchHit[] = [];
    try {
      // Obsidian REST /search/simple/ → [{ filename, result: { score, matches: [{ context }] } }]
      const raw = JSON.parse(text) as Array<{
        filename?: string;
        result?: { score?: number; matches?: Array<{ context?: string }> };
      }>;
      if (Array.isArray(raw)) {
        hits = raw.map((r) => ({
          path: r.filename ?? '',
          score: r.result?.score,
          snippet: r.result?.matches?.[0]?.context,
        }));
      }
    } catch {
      /* non-JSON or empty string */
    }
    return { result: hits, payloadBytes: Buffer.byteLength(text, 'utf8'), payloadText: text };
  }

  async read(path: string): Promise<BackendResponse<string>> {
    const text = await this.mcp.callTool('obsidian_get_file_contents', { filepath: path });
    return { result: text, payloadBytes: Buffer.byteLength(text, 'utf8'), payloadText: text };
  }

  async write(path: string, content: string): Promise<BackendResponse<void>> {
    await this.mcp.callTool('obsidian_put_content', { filepath: path, content });
    return { result: undefined, payloadBytes: Buffer.byteLength(content, 'utf8') };
  }

  async list(path?: string): Promise<BackendResponse<ListEntry[]>> {
    const text = path
      ? await this.mcp.callTool('obsidian_list_files_in_dir', { dirpath: path })
      : await this.mcp.callTool('obsidian_list_files_in_vault', {});
    let entries: ListEntry[] = [];
    try {
      // Obsidian REST /vault/ → { files: ["dir/", "note.md", ...] }
      const raw = JSON.parse(text) as { files?: string[] } | string[];
      const files = Array.isArray(raw) ? raw : (raw.files ?? []);
      entries = (files as string[]).map((f) => ({
        path: f.endsWith('/') ? f.slice(0, -1) : f,
        isDirectory: f.endsWith('/'),
      }));
    } catch {
      /* ignore */
    }
    return { result: entries, payloadBytes: Buffer.byteLength(text, 'utf8'), payloadText: text };
  }
}
