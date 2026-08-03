import type { Backend, BackendResponse, ListEntry, SearchHit } from '../backend.js';
import { McpSubprocess } from './mcp-subprocess.js';

/**
 * Adapter for obsidian-mcp-rs.
 * https://github.com/richardanaya/obsidian-mcp-rs
 *
 * Rust, filesystem-direct — does NOT require Obsidian running. Search is a
 * per-query parallel scan (rayon walk + on-the-fly BM25); there is no
 * persistent index, so repeated queries pay the walk every time.
 *
 * Vault path is passed as a positional CLI argument; every tool takes a
 * `vault` name derived from the path's last component. The adapter reads the
 * registered name back from `list-available-vaults` at build time rather than
 * re-implementing the server's name derivation.
 *
 * Tool mapping (verified against 0.7.1 via tools/list):
 *   search-vault          → search(query)   — JSON {results:[{path,score,snippets}]}
 *   read-note             → read(path)      — raw note content, PAGINATED: the
 *                           server returns 400 lines per call and appends a
 *                           "[showed lines X-Y of N. Call read-note again with
 *                           offset=…]" banner. read() follows the banner until
 *                           the note is complete, so latency and payloadBytes
 *                           reflect the full-note cost every other adapter
 *                           reports (a small note is still a single call).
 *   edit-note (replace)   → write(path, content)
 *   list-available-vaults → list(path?)     — vault-level metadata only; the
 *                           server has no note-listing tool (same gap as
 *                           obsidian-mcp, mapped identically)
 */

export interface ObsidianMcpRsAdapterOptions {
  /** Absolute path to the vault root. Passed as a positional CLI argument. */
  vaultRoot: string;
  /** Override the spawn command. Vault path is appended automatically. */
  cmd?: string[];
}

interface RsSearchResponse {
  results?: Array<{
    path?: string;
    score?: number;
    snippets?: Array<{ line?: number; text?: string }>;
  }>;
}

/** Parse a `search-vault` JSON response into SearchHits (empty on non-JSON). */
export function parseRsSearchHits(text: string): SearchHit[] {
  try {
    const raw = JSON.parse(text) as RsSearchResponse;
    return (raw.results ?? []).map((r) => ({
      path: r.path ?? '',
      score: r.score,
      snippet: r.snippets?.[0]?.text,
    }));
  } catch {
    return [];
  }
}

/**
 * Parse the plain-text `list-available-vaults` response
 * (`- name → /abs/path` lines) into entries.
 */
export function parseRsVaultList(text: string): Array<{ name: string; path: string }> {
  const vaults: Array<{ name: string; path: string }> = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^-\s+(.+?)\s+→\s+(.+)$/);
    if (m?.[1] && m[2]) vaults.push({ name: m[1].trim(), path: m[2].trim() });
  }
  return vaults;
}

const PAGE_BANNER = /\n?\[showed lines (\d+)-(\d+) of (\d+)\.[^\]]*\]\n?$/;

export interface RsReadPage {
  /** Page content with the pagination banner stripped. */
  content: string;
  /** Last line number this page covered (from the banner), if paginated. */
  showedEnd?: number;
  /** Total line count of the note (from the banner), if paginated. */
  totalLines?: number;
}

/**
 * Split a `read-note` page into content + pagination banner metadata.
 * Unpaginated responses (small notes) have no banner.
 */
export function parseRsReadPage(text: string): RsReadPage {
  const m = text.match(PAGE_BANNER);
  if (!m || m.index === undefined) return { content: text };
  return {
    content: text.slice(0, m.index),
    showedEnd: Number(m[2]),
    totalLines: Number(m[3]),
  };
}

function splitPath(path: string): { filename: string; folder?: string } {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === -1) return { filename: path };
  return { filename: path.slice(lastSlash + 1), folder: path.slice(0, lastSlash) };
}

export class ObsidianMcpRsAdapter implements Backend {
  readonly name = 'obsidian-mcp-rs';
  readonly description =
    'obsidian-mcp-rs (Rust, filesystem-direct, per-query scan, no Obsidian required)';

  private constructor(
    private readonly mcp: McpSubprocess,
    private readonly vaultName: string,
  ) {}

  static async build(opts: ObsidianMcpRsAdapterOptions): Promise<ObsidianMcpRsAdapter> {
    const baseParts = opts.cmd ??
      process.env.SEEKSTONE_OBSIDIAN_MCP_RS_CMD?.split(' ') ?? ['npx', '-y', 'obsidian-mcp-rs'];
    const cmd = [...baseParts, opts.vaultRoot];
    const mcp = await McpSubprocess.connect('obsidian-mcp-rs', cmd, { initTimeout: 60_000 });
    // Discover the registered vault name instead of guessing the server's
    // basename sanitization.
    const listText = await mcp.callTool('list-available-vaults', {});
    const vaults = parseRsVaultList(listText);
    const match = vaults.find((v) => v.path === opts.vaultRoot) ?? vaults[0];
    const fallback = opts.vaultRoot.split('/').filter(Boolean).at(-1) ?? 'vault';
    return new ObsidianMcpRsAdapter(mcp, match?.name ?? fallback);
  }

  async close(): Promise<void> {
    return this.mcp.close();
  }

  async search(query: string): Promise<BackendResponse<SearchHit[]>> {
    const text = await this.mcp.callTool('search-vault', { vault: this.vaultName, query });
    return {
      result: parseRsSearchHits(text),
      payloadBytes: Buffer.byteLength(text, 'utf8'),
      payloadText: text,
    };
  }

  async read(path: string): Promise<BackendResponse<string>> {
    const { filename, folder } = splitPath(path);
    const base: Record<string, unknown> = { vault: this.vaultName, filename };
    if (folder) base.folder = folder;

    const contentParts: string[] = [];
    const rawParts: string[] = [];
    let offset: number | undefined;
    for (;;) {
      const args = offset === undefined ? base : { ...base, offset };
      const text = await this.mcp.callTool('read-note', args);
      rawParts.push(text);
      const page = parseRsReadPage(text);
      contentParts.push(page.content);
      if (page.showedEnd === undefined || page.totalLines === undefined) break;
      if (page.showedEnd >= page.totalLines) break;
      offset = page.showedEnd + 1;
    }
    // payload = every byte the server actually sent, banners included; result
    // = the reassembled note content.
    const raw = rawParts.join('');
    return {
      result: contentParts.join(''),
      payloadBytes: Buffer.byteLength(raw, 'utf8'),
      payloadText: raw,
    };
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
    const entries: ListEntry[] = parseRsVaultList(text).map((v) => ({
      path: v.path,
      isDirectory: true,
    }));
    return { result: entries, payloadBytes: Buffer.byteLength(text, 'utf8'), payloadText: text };
  }
}
