import type { Backend, BackendResponse, ListEntry, SearchHit } from '../backend.js';
import { McpSubprocess } from './mcp-subprocess.js';

/**
 * Adapter for obsidian-mcp-pro by rps321321.
 * https://github.com/rps321321/obsidian-mcp-pro
 *
 * TypeScript, filesystem-direct — does NOT require Obsidian running.
 * Vault path passed via OBSIDIAN_VAULT_PATH env var.
 *
 * Tool mapping:
 *   search_notes → search(query)
 *   get_note     → read(path)
 *   create_note  → write(path, content)
 *   list_notes   → list(path?)
 */

export interface ObsidianMcpProAdapterOptions {
  /** Absolute path to the vault root. */
  vaultRoot: string;
  /** Override the spawn command. Defaults to ['npx', '-y', 'obsidian-mcp-pro']. */
  cmd?: string[];
}

export class ObsidianMcpProAdapter implements Backend {
  readonly name = 'obsidian-mcp-pro';
  readonly description = 'obsidian-mcp-pro (rps321321, filesystem-direct, no Obsidian required)';

  private constructor(private readonly mcp: McpSubprocess) {}

  static async build(opts: ObsidianMcpProAdapterOptions): Promise<ObsidianMcpProAdapter> {
    const cmd = opts.cmd ??
      process.env.SEEKSTONE_OBSIDIAN_MCP_PRO_CMD?.split(' ') ?? ['npx', '-y', 'obsidian-mcp-pro'];
    const env: Record<string, string> = {
      OBSIDIAN_VAULT_PATH: opts.vaultRoot,
    };
    const mcp = await McpSubprocess.connect('obsidian-mcp-pro', cmd, {
      env,
      initTimeout: 60_000,
    });
    return new ObsidianMcpProAdapter(mcp);
  }

  async close(): Promise<void> {
    return this.mcp.close();
  }

  async search(query: string): Promise<BackendResponse<SearchHit[]>> {
    const text = await this.mcp.callTool('search_notes', {
      query,
      maxResults: 10,
    });
    let hits: SearchHit[] = [];
    try {
      type RawHit = {
        path?: string;
        score?: number;
        excerpt?: string;
        snippet?: string;
        matches?: Array<{ context?: string }>;
      };
      const parsed = JSON.parse(text) as Array<RawHit> | { results?: Array<RawHit> };
      const raw = Array.isArray(parsed) ? parsed : (parsed.results ?? []);
      hits = raw.map((h) => ({
        path: h.path ?? '',
        score: h.score,
        snippet: h.excerpt ?? h.snippet ?? h.matches?.[0]?.context,
      }));
    } catch {
      /* plain-text response */
    }
    return { result: hits, payloadBytes: Buffer.byteLength(text, 'utf8'), payloadText: text };
  }

  async read(path: string): Promise<BackendResponse<string>> {
    const text = await this.mcp.callTool('get_note', { path });
    return { result: text, payloadBytes: Buffer.byteLength(text, 'utf8'), payloadText: text };
  }

  async write(path: string, content: string): Promise<BackendResponse<void>> {
    await this.mcp.callTool('create_note', { path, content });
    return { result: undefined, payloadBytes: Buffer.byteLength(content, 'utf8') };
  }

  async list(path?: string): Promise<BackendResponse<ListEntry[]>> {
    const args: Record<string, unknown> = { limit: 500 };
    if (path) args.folder = path;
    const text = await this.mcp.callTool('list_notes', args);
    let entries: ListEntry[] = [];
    try {
      const parsed = JSON.parse(text) as
        | Array<{ path?: string; isDirectory?: boolean }>
        | { notes?: Array<{ path?: string }>; paths?: string[] };
      if (Array.isArray(parsed)) {
        entries = parsed.map((n) => ({ path: n.path ?? '', isDirectory: n.isDirectory ?? false }));
      } else if (parsed.notes) {
        entries = parsed.notes.map((n) => ({ path: n.path ?? '', isDirectory: false }));
      } else if (parsed.paths) {
        entries = parsed.paths.map((p) => ({ path: p, isDirectory: false }));
      }
    } catch {
      /* plain-text path listing */
      entries = text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((p) => ({ path: p, isDirectory: false }));
    }
    return { result: entries, payloadBytes: Buffer.byteLength(text, 'utf8'), payloadText: text };
  }
}
