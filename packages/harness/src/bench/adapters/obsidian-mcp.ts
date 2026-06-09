import type { Backend, BackendResponse, ListEntry, SearchHit } from '../backend.js';
import { McpSubprocess } from './mcp-subprocess.js';

/**
 * Adapter for obsidian-mcp by StevenStavrakis.
 * https://github.com/StevenStavrakis/obsidian-mcp
 *
 * TypeScript, filesystem-direct — does NOT require Obsidian running.
 * Vault path is passed as a positional CLI argument.
 * All tools include a `vault` parameter using a sanitized vault name
 * derived from the last path component.
 *
 * Tool mapping:
 *   search-vault          → search(query)
 *   read-note             → read(path)
 *   edit-note             → write(path, content)
 *   list-available-vaults → list(path?)
 */

export interface ObsidianMcpAdapterOptions {
  /** Absolute path to the vault root. Passed as a positional CLI argument. */
  vaultRoot: string;
  /** Override the spawn command. Vault path is appended automatically. */
  cmd?: string[];
}

function sanitizeVaultName(vaultRoot: string): string {
  const last = vaultRoot.split('/').filter(Boolean).at(-1) ?? 'vault';
  // obsidian-mcp lowercases and converts spaces/special chars to hyphens
  return last
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function splitPath(path: string): { filename: string; folder?: string } {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === -1) return { filename: path };
  return { filename: path.slice(lastSlash + 1), folder: path.slice(0, lastSlash) };
}

export class ObsidianMcpAdapter implements Backend {
  readonly name = 'obsidian-mcp';
  readonly description = 'obsidian-mcp (StevenStavrakis, filesystem-direct, no Obsidian required)';

  private constructor(
    private readonly mcp: McpSubprocess,
    private readonly vaultName: string,
  ) {}

  static async build(opts: ObsidianMcpAdapterOptions): Promise<ObsidianMcpAdapter> {
    const baseParts = opts.cmd ??
      process.env.SEEKSTONE_OBSIDIAN_MCP_CMD?.split(' ') ?? ['npx', '--yes', 'obsidian-mcp'];
    const cmd = [...baseParts, opts.vaultRoot];
    const vaultName = sanitizeVaultName(opts.vaultRoot);
    const mcp = await McpSubprocess.connect('obsidian-mcp', cmd, { initTimeout: 60_000 });
    return new ObsidianMcpAdapter(mcp, vaultName);
  }

  async close(): Promise<void> {
    return this.mcp.close();
  }

  async search(query: string): Promise<BackendResponse<SearchHit[]>> {
    const text = await this.mcp.callTool('search-vault', {
      vault: this.vaultName,
      query,
      searchType: 'content',
    });
    const hits: SearchHit[] = [];
    try {
      // Response may be JSON array or formatted text; best-effort parse
      const raw = JSON.parse(text) as Array<{
        path?: string;
        filename?: string;
        excerpt?: string;
        context?: string;
        score?: number;
      }>;
      if (Array.isArray(raw)) {
        for (const r of raw) {
          hits.push({
            path: r.path ?? r.filename ?? '',
            score: r.score,
            snippet: r.excerpt ?? r.context,
          });
        }
      }
    } catch {
      /* plain-text response — hits stay empty; payload bytes still measured */
    }
    return { result: hits, payloadBytes: Buffer.byteLength(text, 'utf8'), payloadText: text };
  }

  async read(path: string): Promise<BackendResponse<string>> {
    const { filename, folder } = splitPath(path);
    const args: Record<string, unknown> = { vault: this.vaultName, filename };
    if (folder) args.folder = folder;
    const text = await this.mcp.callTool('read-note', args);
    return { result: text, payloadBytes: Buffer.byteLength(text, 'utf8'), payloadText: text };
  }

  async write(path: string, content: string): Promise<BackendResponse<void>> {
    const { filename, folder } = splitPath(path);
    const args: Record<string, unknown> = {
      vault: this.vaultName,
      filename,
      operation: 'replace',
      content,
    };
    if (folder) args.folder = folder;
    await this.mcp.callTool('edit-note', args);
    return { result: undefined, payloadBytes: Buffer.byteLength(content, 'utf8') };
  }

  async list(_path?: string): Promise<BackendResponse<ListEntry[]>> {
    const text = await this.mcp.callTool('list-available-vaults', {});
    // This server only exposes vault-level metadata, not a note listing —
    // payload is the raw response; entries reflect what the tool actually returns.
    let entries: ListEntry[] = [];
    try {
      const raw = JSON.parse(text) as
        | Array<{ name?: string; path?: string }>
        | { vaults?: Array<{ name?: string; path?: string }> };
      const vaults = Array.isArray(raw) ? raw : (raw.vaults ?? []);
      entries = vaults.map((v) => ({
        path: v.path ?? v.name ?? '',
        isDirectory: true,
      }));
    } catch {
      /* single vault entry fallback */
      entries = [{ path: this.vaultName, isDirectory: true }];
    }
    return { result: entries, payloadBytes: Buffer.byteLength(text, 'utf8'), payloadText: text };
  }
}
