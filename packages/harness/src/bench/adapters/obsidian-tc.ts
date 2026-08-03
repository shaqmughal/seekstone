import { mkdtemp, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Backend, BackendResponse, ListEntry, SearchHit } from '../backend.js';
import { McpSubprocess } from './mcp-subprocess.js';

/**
 * Adapter for obsidian-tc.
 * https://www.npmjs.com/package/obsidian-tc
 *
 * TypeScript governance platform (SQLite FTS5 + optional embeddings + ACL
 * pipeline) — does NOT require Obsidian running. Requires Node >= 24. Keeps
 * its index in ~/.obsidian-tc/ (cache.db), NOT inside the vault, so benching
 * against the committed fixture vault is safe. Delete ~/.obsidian-tc between
 * runs for a true cold start.
 *
 * Vault path is a positional CLI argument; the single vault registers as
 * `main`. tools/list exposes only the 3-tool meta facade
 * (find/describe/call_capability), but every underlying tool remains directly
 * callable by name (verified against 1.15.0) — direct calls are what this
 * adapter benches. Set SEEKSTONE_OBSIDIAN_TC_FACADE=1 to route the same ops
 * through `call_capability` instead (reported as `obsidian-tc-facade`) to
 * measure the facade tax.
 *
 * Tool mapping (verified against 1.15.0 via describe_capability):
 *   search_text → search(query)  — FTS5/BM25; deliberately NOT `search_vault`,
 *                 whose mode router can fall through to the semantic/embeddings
 *                 path and time out without a local runner
 *   read_note   → read(path)     — JSON envelope {content, frontmatter, body,
 *                 content_hash, stat}; result is .content, payload is the full
 *                 envelope (that's what an agent actually receives)
 *   write_note  → write(path, content) — mode `upsert`. Overwriting a non-empty
 *                 note triggers MCP elicitation ("human confirmation required")
 *                 on the default trusted-local profile, even with a correct
 *                 prev_hash CAS — so the safety suite cannot run against this
 *                 server non-interactively. Bench never calls write().
 *   list_notes  → list(path?)
 *
 * One deliberate deviation from server defaults: the governor caps responses
 * at 1 MB (`governor.maxResponseBytes`), and because the read_note envelope
 * carries the note text twice (`content` + `body`), any note over ~500 KB is
 * refused outright ("response exceeds byte budget"). The adapter boots the
 * server from a generated config file that raises the cap to 100 MB so the
 * read-large measurement benchmarks a served response rather than an error.
 * Everything else (auth, ACL, profile) stays at defaults. The 2× envelope tax
 * still shows up fully in payloadBytes — that part is the honest number.
 */

export interface ObsidianTcAdapterOptions {
  /** Absolute path to the vault root. Passed as a positional CLI argument. */
  vaultRoot: string;
  /** Override the spawn command. Vault path is appended automatically. */
  cmd?: string[];
  /** Route ops through the call_capability facade instead of direct calls. */
  facade?: boolean;
}

/** The single positional vault always registers under this name. */
const VAULT = 'main';

interface TcSearchResponse {
  items?: Array<{ path?: string; score?: number; snippet?: string }>;
}

interface TcListResponse {
  notes?: Array<{ path?: string }>;
}

/** Parse a `search_text` JSON response into SearchHits (empty on non-JSON). */
export function parseTcSearchHits(text: string): SearchHit[] {
  try {
    const raw = JSON.parse(text) as TcSearchResponse;
    return (raw.items ?? []).map((i) => ({
      path: i.path ?? '',
      score: i.score,
      snippet: i.snippet,
    }));
  } catch {
    return [];
  }
}

/** Extract raw note content from a `read_note` JSON envelope. */
export function parseTcNoteContent(text: string): string {
  try {
    const raw = JSON.parse(text) as { content?: string };
    return raw.content ?? text;
  } catch {
    return text;
  }
}

/** Parse a `list_notes` JSON response into ListEntries (empty on non-JSON). */
export function parseTcListEntries(text: string): ListEntry[] {
  try {
    const raw = JSON.parse(text) as TcListResponse;
    return (raw.notes ?? []).map((n) => ({ path: n.path ?? '', isDirectory: false }));
  } catch {
    return [];
  }
}

export class ObsidianTcAdapter implements Backend {
  readonly name: string;
  readonly description: string;

  private constructor(
    private readonly mcp: McpSubprocess,
    private readonly facade: boolean,
  ) {
    this.name = facade ? 'obsidian-tc-facade' : 'obsidian-tc';
    this.description = facade
      ? 'obsidian-tc via call_capability facade (SQLite governance platform, no Obsidian required)'
      : 'obsidian-tc (SQLite governance platform, direct tool calls, no Obsidian required)';
  }

  static async build(opts: ObsidianTcAdapterOptions): Promise<ObsidianTcAdapter> {
    const baseParts = opts.cmd ??
      process.env.SEEKSTONE_OBSIDIAN_TC_CMD?.split(' ') ?? ['npx', '-y', 'obsidian-tc'];
    // Boot from a config file instead of the bare vault path — see the header
    // note on governor.maxResponseBytes.
    const configPath = join(await mkdtemp(join(tmpdir(), 'seekstone-tc-config-')), 'config.json');
    await writeFile(
      configPath,
      JSON.stringify({
        // tc refuses symlinked path components (e.g. macOS /var → /private/var)
        vaults: [{ id: VAULT, path: await realpath(opts.vaultRoot), kind: 'private' }],
        governor: { maxResponseBytes: 104_857_600 },
      }),
      'utf8',
    );
    const cmd = [...baseParts, configPath];
    const facade = opts.facade ?? process.env.SEEKSTONE_OBSIDIAN_TC_FACADE === '1';
    // SQLite index builds during startup — slow on large vaults.
    const mcp = await McpSubprocess.connect('obsidian-tc', cmd, { initTimeout: 120_000 });
    return new ObsidianTcAdapter(mcp, facade);
  }

  async close(): Promise<void> {
    return this.mcp.close();
  }

  private call(name: string, args: Record<string, unknown>): Promise<string> {
    if (this.facade) return this.mcp.callTool('call_capability', { name, args });
    return this.mcp.callTool(name, args);
  }

  async search(query: string): Promise<BackendResponse<SearchHit[]>> {
    // case_sensitive / whole_word / verbosity have defaults but are listed as
    // required in the input schema — pass them explicitly.
    const text = await this.call('search_text', {
      vault: VAULT,
      query,
      case_sensitive: false,
      whole_word: false,
      verbosity: 'full',
    });
    return {
      result: parseTcSearchHits(text),
      payloadBytes: Buffer.byteLength(text, 'utf8'),
      payloadText: text,
    };
  }

  async read(path: string): Promise<BackendResponse<string>> {
    const text = await this.call('read_note', { vault: VAULT, path });
    return {
      result: parseTcNoteContent(text),
      payloadBytes: Buffer.byteLength(text, 'utf8'),
      payloadText: text,
    };
  }

  async write(path: string, content: string): Promise<BackendResponse<void>> {
    await this.call('write_note', { vault: VAULT, path, content, mode: 'upsert' });
    return { result: undefined, payloadBytes: Buffer.byteLength(content, 'utf8') };
  }

  async list(path?: string): Promise<BackendResponse<ListEntry[]>> {
    const args: Record<string, unknown> = { vault: VAULT, recursive: true };
    if (path) args.folder = path;
    const text = await this.call('list_notes', args);
    return {
      result: parseTcListEntries(text),
      payloadBytes: Buffer.byteLength(text, 'utf8'),
      payloadText: text,
    };
  }
}
