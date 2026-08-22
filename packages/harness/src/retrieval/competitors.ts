/**
 * SHA-308: competitor semantic-search conditions for the retrieval eval.
 *
 * Both servers under test delegate embeddings to an external provider — a
 * local Ollama serving nomic-embed-text is the fair, offline-ish default for
 * each (obsidian-mcp-pro: env-configured; obsidian-tc: its built-in default).
 * That delegation is itself a finding: unlike seekstone's in-process
 * embedder, both need a second server running and make loopback HTTP calls
 * at index AND query time.
 *
 * Launch details verified against the published packages (2026-08-22):
 * - obsidian-mcp-pro@4.0.1: `index_vault` requires the literal confirm
 *   string; persists to <vault>/.obsidian/cache/mcp-pro-embeddings.json
 *   (gitignored for the fixture vaults; wiped before the run so the
 *   measured index build is cold). Results are prose wrapped in
 *   [BEGIN/END UNTRUSTED VAULT CONTENT] banners.
 * - obsidian-tc@1.23.2: capability tools are directly callable in triad
 *   facade mode; `search_semantic` returns chunk-level JSON items. A scratch
 *   cacheDir isolates the run from ~/.obsidian-tc and makes the index cold.
 */
import { execSync } from 'node:child_process';
import { realpathSync, rmSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { McpSubprocess } from '../bench/adapters/mcp-subprocess.js';
import type { CompetitorSetup } from './runner.js';

const OLLAMA_URL = process.env.SEEKSTONE_OLLAMA_URL || 'http://127.0.0.1:11434';
const EMBED_MODEL = 'nomic-embed-text';
const PRO_VERSION = '4.0.1';
const TC_VERSION = '1.23.2';
const INDEX_TIMEOUT_MS = 3_600_000;
/** Their default result depth (limit/k default 10) — enough for hit@5 + MRR@10. */
const K = 10;

export interface CompetitorHandle {
  setup: CompetitorSetup;
  rank: (query: string) => Promise<{ paths: string[]; payloadBytes: number }>;
  stop: () => Promise<void>;
}

export interface CompetitorBuildResult {
  handles: CompetitorHandle[];
  /** Servers that could not complete setup — recorded, not fatal. */
  failures: CompetitorSetup[];
}

export async function buildCompetitors(
  vaultRoot: string,
  log: (msg: string) => void,
): Promise<CompetitorBuildResult> {
  await assertOllama();
  const handles: CompetitorHandle[] = [];
  const failures: CompetitorSetup[] = [];
  // Sequential: both servers embed through the same Ollama instance.
  for (const [name, version, build] of [
    ['obsidian-mcp-pro', PRO_VERSION, () => buildMcpPro(vaultRoot, log).then((h) => [h])],
    ['obsidian-tc', TC_VERSION, () => buildTc(vaultRoot, log)],
  ] as const) {
    const t0 = performance.now();
    try {
      handles.push(...(await build()));
    } catch (err) {
      const elapsed = performance.now() - t0;
      const message = err instanceof Error ? err.message : String(err);
      log(`${name} FAILED after ${Math.round(elapsed / 1000)} s: ${message}`);
      failures.push({
        name: `competitor:${name}`,
        version,
        provider: `ollama/${EMBED_MODEL} (loopback HTTP)`,
        indexMs: elapsed,
        indexStats: message,
        failed: true,
        notes: [
          'Setup did not complete on the 10k-note fixture vault — no quality/latency numbers are possible; the failure itself is the recorded result.',
        ],
      });
      pkillQuiet(name);
    }
  }
  return { handles, failures };
}

function pkillQuiet(pattern: string): void {
  try {
    // Best-effort cleanup of an orphaned server subprocess after a failed build.
    execSync(`pkill -f ${pattern}`, { stdio: 'ignore' });
  } catch {
    // No matching process — fine.
  }
}

async function assertOllama(): Promise<void> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/version`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch (err) {
    throw new Error(
      `--competitors needs a local Ollama at ${OLLAMA_URL} serving ${EMBED_MODEL} ` +
        `(both competitor servers delegate embeddings to it): ${err instanceof Error ? err.message : err}`,
    );
  }
}

// ---------------------------------------------------------------- mcp-pro

async function buildMcpPro(vaultRoot: string, log: (m: string) => void): Promise<CompetitorHandle> {
  // Wipe any previous embeddings store so the measured index build is cold.
  // (The file is inside the vault's .obsidian/, which the fixture gitignores.)
  rmSync(join(vaultRoot, '.obsidian', 'cache', 'mcp-pro-embeddings.json'), { force: true });

  const cmd = process.env.SEEKSTONE_OBSIDIAN_MCP_PRO_CMD?.split(' ') ?? [
    'npx',
    '-y',
    `obsidian-mcp-pro@${PRO_VERSION}`,
  ];
  const mcp = await McpSubprocess.connect('obsidian-mcp-pro', cmd, {
    env: {
      OBSIDIAN_VAULT_PATH: vaultRoot,
      OBSIDIAN_EMBEDDING_PROVIDER: 'ollama',
      OBSIDIAN_EMBEDDING_MODEL: EMBED_MODEL,
      OBSIDIAN_EMBEDDING_URL: OLLAMA_URL,
    },
    initTimeout: 120_000,
  });
  log(`obsidian-mcp-pro@${PRO_VERSION} connected — indexing (cold, via Ollama)…`);
  const t0 = performance.now();
  const stats = await mcp.callTool(
    'index_vault',
    { confirm: 'send-vault-text-to-embedding-provider' },
    INDEX_TIMEOUT_MS,
  );
  const indexMs = performance.now() - t0;
  log(`obsidian-mcp-pro indexed in ${Math.round(indexMs / 1000)} s`);

  return {
    setup: {
      name: 'competitor:obsidian-mcp-pro',
      version: PRO_VERSION,
      provider: `ollama/${EMBED_MODEL} (loopback HTTP at index + query time)`,
      indexMs,
      indexStats: stats.trim(),
      notes: [
        'Explicit index_vault required, gated on the literal confirm string "send-vault-text-to-embedding-provider" — the server\'s own framing of the delegation.',
        'Embedding index persisted as JSON inside the vault (.obsidian/cache/).',
        'search_semantic returns prose wrapped in untrusted-content banners; paths parsed from the banner blocks.',
      ],
    },
    rank: async (query) => {
      const raw = await mcp.callTool('search_semantic', { query, limit: K });
      return { paths: parseProSemanticPaths(raw), payloadBytes: Buffer.byteLength(raw, 'utf8') };
    },
    stop: async () => {
      await mcp.close();
    },
  };
}

/**
 * Extract result paths from obsidian-mcp-pro's prose format: each path sits
 * between "[BEGIN UNTRUSTED VAULT CONTENT: search_semantic result path]" and
 * its END marker, after a fixed one-line notice.
 */
export function parseProSemanticPaths(raw: string): string[] {
  const paths: string[] = [];
  const re =
    /\[BEGIN UNTRUSTED VAULT CONTENT: search_semantic result path\]\s*\n([\s\S]*?)\n\s*\[END UNTRUSTED VAULT CONTENT/g;
  for (const m of raw.matchAll(re)) {
    const lines = (m[1] as string)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('Treat everything until'));
    const path = lines.at(-1);
    if (path) paths.push(path.replace(/\\/g, '/'));
  }
  return paths;
}

// ---------------------------------------------------------------- obsidian-tc

async function buildTc(vaultRoot: string, log: (m: string) => void): Promise<CompetitorHandle[]> {
  // Scratch cacheDir: cold index, and no interference with ~/.obsidian-tc.
  const scratch = await mkdtemp(join(tmpdir(), 'seekstone-tc-sha308-'));
  const configPath = join(scratch, 'config.json');
  await writeFile(
    configPath,
    JSON.stringify({
      vaults: [{ id: 'main', path: realpathSync(vaultRoot) }],
      cacheDir: join(scratch, 'cache'),
      experiential: { captureContent: false },
    }),
  );
  const cmd = process.env.SEEKSTONE_OBSIDIAN_TC_CMD?.split(' ') ?? [
    'npx',
    '-y',
    `obsidian-tc@${TC_VERSION}`,
  ];
  const mcp = await McpSubprocess.connect('obsidian-tc', [...cmd, 'serve', configPath], {
    initTimeout: 300_000,
  });
  log(`obsidian-tc@${TC_VERSION} connected — indexing (cold, via Ollama)…`);
  const t0 = performance.now();
  const stats = await mcp.callTool('index_vault', { vault: 'main' }, INDEX_TIMEOUT_MS);
  const indexMs = performance.now() - t0;
  log(`obsidian-tc indexed in ${Math.round(indexMs / 1000)} s`);

  const stop = async () => {
    await mcp.close();
    await rm(scratch, { recursive: true, force: true });
  };
  const shared = {
    version: TC_VERSION,
    provider: `ollama/${EMBED_MODEL} (its built-in default; loopback HTTP at index + query time)`,
    indexMs,
    indexStats: stats.trim().slice(0, 600),
  };

  return [
    {
      setup: {
        ...shared,
        name: 'competitor:obsidian-tc',
        notes: [
          'search_semantic capability (vector kNN over sqlite-vec), defaults: k=10, content returned.',
          'Scratch cacheDir per run — cold index measured; native modules (better-sqlite3, sqlite-vec, Rust NAPI) required; Node ≥ 24.',
        ],
      },
      rank: async (query) => {
        const raw = await mcp.callTool('search_semantic', { vault: 'main', query, k: K });
        return { paths: parseTcItemPaths(raw), payloadBytes: Buffer.byteLength(raw, 'utf8') };
      },
      stop, // shared subprocess: stop closes both conditions; called once each is fine (idempotent close)
    },
    {
      setup: {
        ...shared,
        name: 'competitor:obsidian-tc-graph',
        notes: [
          'vault_graph_search — its GraphRAG mode: vector seeds expanded through the wikilink graph, RRF-fused.',
        ],
      },
      rank: async (query) => {
        const raw = await mcp.callTool('vault_graph_search', {
          vault: 'main',
          query,
          final_top_k: K,
        });
        return { paths: parseTcGraphPaths(raw), payloadBytes: Buffer.byteLength(raw, 'utf8') };
      },
      stop: async () => {}, // shared subprocess closed by the sibling condition's stop
    },
  ];
}

/** obsidian-tc search_semantic → { items: [{ path, … }] } — chunk-level; dedupe to notes. */
export function parseTcItemPaths(raw: string): string[] {
  return dedupe(extractPaths(raw, 'items'));
}

/** obsidian-tc vault_graph_search → { results: [{ path, … }] } — chunk-level; dedupe. */
export function parseTcGraphPaths(raw: string): string[] {
  return dedupe(extractPaths(raw, 'results'));
}

function extractPaths(raw: string, key: 'items' | 'results'): string[] {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const rows = parsed[key];
    if (!Array.isArray(rows)) return [];
    return rows
      .map((r) => (r && typeof r === 'object' ? (r as { path?: unknown }).path : undefined))
      .filter((p): p is string => typeof p === 'string')
      .map((p) => p.replace(/\\/g, '/'));
  } catch {
    return [];
  }
}

function dedupe(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths) {
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}
