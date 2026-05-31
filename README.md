<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/seekstone-wordmark-dark.svg" />
    <img src="brand/seekstone-wordmark-light.svg" width="320" alt="Seekstone" />
  </picture>
</p>

<p align="center"><em>An Obsidian MCP server — filesystem-direct, low context-tax.</em></p>

<p align="center">
  <a href="https://www.npmjs.com/package/seekstone"><img src="https://img.shields.io/npm/v/seekstone?color=cb3837&logo=npm" alt="npm" /></a>
  <a href="https://github.com/shaqmughal/seekstone/actions/workflows/ci.yml"><img src="https://github.com/shaqmughal/seekstone/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/Node.js-%E2%89%A522-339933?logo=node.js&logoColor=white" alt="Node.js ≥ 22" />
  <img src="https://img.shields.io/badge/platform-macOS%20%C2%B7%20Linux%20%C2%B7%20Windows-lightgrey" alt="Platforms" />
</p>

Seekstone reads your Obsidian vault **directly from disk** instead of routing through the Obsidian Local REST API plugin. The practical difference: a search that returns ~1.75 MB and ~459,000 tokens via the REST plugin returns **~3 KB and ~800 tokens** via seekstone — a **~575× reduction**. The payoff is that Claude can search and read notes without burning most of its context window on a single tool call.

It runs as a standard [MCP](https://modelcontextprotocol.io) stdio server. No Obsidian app and no plugins required — just point it at a vault folder.

## Install

**Claude Desktop** — add to `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "seekstone": {
      "command": "npx",
      "args": ["-y", "seekstone"],
      "env": { "SEEKSTONE_VAULT": "/absolute/path/to/your/vault" }
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add seekstone --env SEEKSTONE_VAULT=/absolute/path/to/your/vault -- npx -y seekstone
```

Restart the client. On startup seekstone walks the vault and builds an in-memory full-text index (a couple of seconds for a few thousand notes), then keeps it in sync as notes change. The eight tools below are then available to Claude.

Requires [Node.js](https://nodejs.org) ≥ 22. Works on macOS, Linux, and Windows.

To confirm the package is reachable before wiring it into a client, run `npx -y seekstone --version` (prints the version and exits) or `npx -y seekstone --help`.

### Guided setup

Prefer not to hand-edit JSON? `seekstone init` validates your vault and prints the exact config to paste — or patches the Claude Desktop config for you:

```bash
# Validate the vault and print the config block to copy
npx -y seekstone init --vault "/absolute/path/to/your/vault"

# Or patch the Claude Desktop config in place (backs it up first, never
# touches your other MCP servers)
npx -y seekstone init --vault "/absolute/path/to/your/vault" --write

# Print the Claude Code command instead
npx -y seekstone init --vault "/absolute/path/to/your/vault" --client code
```

## Tools

| Tool | Description |
|---|---|
| `search` | Full-text search. Returns ranked ~200-char excerpts, not full notes. Fuzzy, prefix, and phrase queries. |
| `read_note` | Read the full content of a note by vault-relative path. |
| `list_notes` | List notes, optionally filtered by folder prefix or tag. |
| `create_note` | Create a note (optional frontmatter + body); parent directories are created automatically. |
| `delete_note` | Permanently delete a note. **Irreversible.** |
| `move_note` | Move or rename a note; destination directories are created automatically. |
| `append_note` | Append text to a note body without touching frontmatter. |
| `patch_frontmatter` | Set, update, or delete frontmatter keys without reordering existing keys or changing quote style. |

## Configuration

| Variable | Required | Description |
|---|---|---|
| `SEEKSTONE_VAULT` | Yes | Absolute path to your Obsidian vault. |
| `SEEKSTONE_LOG_LEVEL` | No | `error` \| `warn` \| `info` (default) \| `debug`. |
| `SEEKSTONE_LOG_FILE` | No | Absolute path; when set, JSON-line logs are appended here (size-rotated). |
| `SEEKSTONE_WATCH_POLL` | No | Set to `1` to stat-poll for changes instead of native OS events — slower but reliable on network drives, WSL, and some containers. |

## How it works

Seekstone walks the vault with `fast-glob`, parses each note's frontmatter (byte-aware, so writes can prove the frontmatter region is byte-identical), and builds a [MiniSearch](https://github.com/lucaong/minisearch) full-text index in memory. Search returns short ranked excerpts rather than whole notes — that excerpt-not-document design is where the context-tax win comes from. A cross-platform file watcher ([chokidar](https://github.com/paulmillr/chokidar)) keeps the index current as you edit.

Writes are conservative by design: `append_note` never touches frontmatter, and `patch_frontmatter` preserves key order, quote style, and comments (it edits the YAML document in place rather than re-serializing it).

## Security & privacy

Seekstone reads — and, via the write tools, modifies — files under `SEEKSTONE_VAULT` on your local disk. It makes **no network calls** and sends **no telemetry**. Logs are metadata-only by default (note contents appear only at `debug`). Nothing is written outside the vault except an optional log file you configure. Note that `delete_note` is irreversible.

---

## Contributing & development

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) if present, otherwise:

```bash
npm install        # install all workspace deps
npm test           # run all tests
npm run lint       # biome
npm run build -w seekstone   # build the publishable server (tsup → dist/)

npx vitest run packages/server/src/tools/search.test.ts   # a single test file
npx vitest run -t 'parses a typical frontmatter'          # a single test by name
npx tsc -p packages/server/tsconfig.json --noEmit         # typecheck
```

### Repository layout

| Package | Purpose |
|---|---|
| `packages/server` | The published `seekstone` MCP server (8 tools, stdio, MiniSearch index, chokidar watcher). |
| `packages/core` | Shared vault primitives — walk, frontmatter parser, link/tag extractor, percentiles. Bundled into the server build. |
| `packages/harness` | Profiler + benchmark + write-safety harness (REST vs filesystem) that produced the payload numbers above. Dev-only; not published. |

The server has a real build (tsup → `dist/`) and is published to npm. The harness is run from source via `tsx` and is not published. Releases are automated — see [docs/RELEASING.md](docs/RELEASING.md).

### The harness

The harness measures the thing the server is designed around: payload size. It needs the Local REST API plugin for the `rest` backend.

```bash
export SEEKSTONE_VAULT="/absolute/path/to/your/vault"

# Profile vault shape
npx tsx packages/harness/src/cli.ts profile --vault "$SEEKSTONE_VAULT"

# Benchmark adapters (filesystem vs REST)
npx tsx packages/harness/src/cli.ts bench \
  --queries packages/harness/queries/default.json \
  --stats reports/vault-stats.json

# Write-safety suite
npx tsx packages/harness/src/cli.ts safety --vault "$SEEKSTONE_VAULT"
```

Harness-specific env vars: `SEEKSTONE_REST_API_KEY` (required for the `rest` backend, from the Local REST API plugin) and `SEEKSTONE_REST_URL` (defaults to `https://127.0.0.1:27124`).

## License

MIT © Shaq Mughal
