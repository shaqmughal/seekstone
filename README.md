<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/seekstone-wordmark-dark.svg" />
    <img src="brand/seekstone-wordmark-light.svg" width="320" alt="Seekstone" />
  </picture>
</p>

<p align="center"><strong>The MCP server that connects Claude to your Obsidian vault.</strong></p>
<p align="center"><em>Filesystem-direct · No plugins · No context waste · macOS · Linux · Windows</em></p>

<p align="center">
  <a href="https://www.npmjs.com/package/obsidian-mcp-seekstone"><img src="https://img.shields.io/npm/v/obsidian-mcp-seekstone?color=cb3837&logo=npm&label=obsidian-mcp-seekstone" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/seekstone"><img src="https://img.shields.io/npm/v/seekstone?color=cb3837&logo=npm&label=seekstone" alt="npm (seekstone)" /></a>
  <a href="https://github.com/shaqmughal/seekstone/actions/workflows/ci.yml"><img src="https://github.com/shaqmughal/seekstone/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/Node.js-%E2%89%A522-339933?logo=node.js&logoColor=white" alt="Node.js ≥ 22" />
</p>

---

## What is Seekstone?

**Seekstone is an Obsidian MCP server** — it gives Claude (and any [Model Context Protocol](https://modelcontextprotocol.io) client) direct read and write access to your Obsidian vault. No Obsidian app needs to be open, no plugins are required, and nothing leaves your machine.

It reads your vault **directly from disk** rather than routing through the Obsidian Local REST API plugin. The practical difference: a search that returns ~1.75 MB and ~459,000 tokens via the REST plugin returns **~3 KB and ~800 tokens** via Seekstone — a **~575× reduction**. Claude can search and read your entire note library without burning most of its context window on a single tool call.

**Two npm names, one server** — published under both for discoverability:

| Package | Install command |
|---|---|
| [`obsidian-mcp-seekstone`](https://www.npmjs.com/package/obsidian-mcp-seekstone) | `npx -y obsidian-mcp-seekstone` |
| [`seekstone`](https://www.npmjs.com/package/seekstone) | `npx -y seekstone` |

---

## Install

**One-click (Claude Desktop)** — download `seekstone.mcpb` from [GitHub Releases](https://github.com/shaqmughal/seekstone/releases/latest), double-click it in Claude Desktop, and pick your vault folder. No terminal, no JSON editing required.

**Claude Desktop** — add to `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "seekstone": {
      "command": "npx",
      "args": ["-y", "obsidian-mcp-seekstone"],
      "env": { "SEEKSTONE_VAULT": "/absolute/path/to/your/vault" }
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add seekstone --env SEEKSTONE_VAULT=/absolute/path/to/your/vault -- npx -y obsidian-mcp-seekstone
```

Restart the client. On startup Seekstone walks the vault, builds an in-memory full-text index (a few seconds for thousands of notes), and keeps it live as you edit. The eight tools below are then available to Claude.

Requires [Node.js](https://nodejs.org) ≥ 22.

### Guided setup

Prefer not to hand-edit JSON? `seekstone init` validates your vault and either prints the config block or patches the Claude Desktop config in place (with a backup, leaving your other MCP servers untouched):

```bash
# Print the config block to copy-paste
npx -y obsidian-mcp-seekstone init --vault "/absolute/path/to/your/vault"

# Patch the Claude Desktop config directly
npx -y obsidian-mcp-seekstone init --vault "/absolute/path/to/your/vault" --write

# Print the Claude Code command instead
npx -y obsidian-mcp-seekstone init --vault "/absolute/path/to/your/vault" --client code
```

---

## What can Claude do with your vault?

Once Seekstone is connected, you can ask Claude things like:

- **"Search my notes for everything about [topic] and give me a summary"** — uses `search`, returns ranked excerpts, not full files
- **"Find all notes tagged #project and list their titles"** — uses `list_notes` with a tag filter
- **"Read my note on [topic] and suggest improvements"** — uses `read_note`
- **"Create a new meeting note for today with a standard template"** — uses `create_note`
- **"Add a summary section to the bottom of [note]"** — uses `append_note`, never touches frontmatter
- **"Move all notes in /inbox to /archive/[year]"** — uses `move_note`
- **"Update the status field in this note's frontmatter to 'done'"** — uses `patch_frontmatter`, preserves key order and quote style
- **"Delete the scratch note at [path]"** — uses `delete_note`

Claude never sees your full vault at once — it searches and reads selectively, so even large vaults (10k+ notes) stay within context budget.

---

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

---

## Configuration

| Variable | Required | Description |
|---|---|---|
| `SEEKSTONE_VAULT` | Yes | Absolute path to your Obsidian vault. |
| `SEEKSTONE_LOG_LEVEL` | No | `error` \| `warn` \| `info` (default) \| `debug`. |
| `SEEKSTONE_LOG_FILE` | No | Absolute path; when set, JSON-line logs are appended here (size-rotated). |
| `SEEKSTONE_WATCH_POLL` | No | Set to `1` to stat-poll for changes instead of native OS events — slower but reliable on network drives, WSL, and some containers. |

---

## How it works

Seekstone walks the vault with `fast-glob`, parses each note's frontmatter (byte-aware, so writes can prove the frontmatter region is byte-identical pre- and post-write), and builds a [MiniSearch](https://github.com/lucaong/minisearch) full-text index in memory. Search returns short ranked excerpts rather than whole notes — that excerpt-not-document design is where the context-tax win comes from. A cross-platform file watcher ([chokidar](https://github.com/paulmillr/chokidar)) keeps the index current as you edit in Obsidian.

Writes are conservative by design: `append_note` never touches frontmatter, and `patch_frontmatter` edits the YAML document in place rather than re-serializing it, preserving key order, quote style, and comments.

---

## Security & privacy

Seekstone reads — and, via the write tools, modifies — files under `SEEKSTONE_VAULT` on your local disk. It makes **no network calls** and sends **no telemetry**. Logs are metadata-only by default (note contents only appear at `debug` level). Nothing is written outside the vault except an optional log file you configure.

---

## Frequently asked questions

**Does the Obsidian app need to be running?**
No. Seekstone reads the vault folder directly from disk. Obsidian can be open or closed.

**Do I need the Local REST API plugin?**
No. Seekstone bypasses it entirely — that's the source of the 575× payload reduction. No plugins are required.

**Which AI clients does it support?**
Any client that supports the [Model Context Protocol](https://modelcontextprotocol.io) (MCP) over stdio — Claude Desktop, Claude Code, Cursor, Windsurf, Continue, and others.

**Is it safe to use on my vault?**
Seekstone never modifies files except when you explicitly invoke a write tool (`create_note`, `append_note`, `patch_frontmatter`, `move_note`, `delete_note`). It makes no network requests. The vault path is sandboxed — no tool can read or write outside it.

**Does it work on Windows?**
Yes. Seekstone is tested on macOS, Linux, and Windows in CI on every commit.

**What Obsidian vault sizes does it handle?**
Seekstone has been profiled against vaults with thousands of notes. The in-memory index is small (a few MB for a typical vault) and starts in a few seconds.

---

## Contributing & development

Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, or jump straight in:

```bash
npm install                                          # install all workspace deps
npm test                                             # run all tests
npm run lint                                         # biome check
npm run build -w seekstone                           # tsup → dist/

npx vitest run packages/server/src/tools/search.test.ts  # single test file
npx vitest run -t 'parses a typical frontmatter'         # single test by name
npx tsc -p packages/server/tsconfig.json --noEmit        # typecheck
```

### Repository layout

| Package | Purpose |
|---|---|
| `packages/server` | The published `seekstone` MCP server (8 tools, stdio, MiniSearch index, chokidar watcher). |
| `packages/core` | Shared vault primitives — walk, frontmatter parser, link/tag extractor, percentiles. Bundled into the server build. |
| `packages/harness` | Profiler + benchmark + write-safety harness (REST vs filesystem) that produced the payload numbers above. Dev-only; not published. |

The server has a real build (tsup → `dist/`) and is published to npm. The harness is run from source via `tsx`. Releases are automated — see [docs/RELEASING.md](docs/RELEASING.md).

### The measurement harness

The harness exists to reproduce the benchmark numbers that motivated the filesystem-direct design. It needs the Local REST API plugin for the `rest` backend.

```bash
export SEEKSTONE_VAULT="/absolute/path/to/your/vault"

npx tsx packages/harness/src/cli.ts profile --vault "$SEEKSTONE_VAULT"
npx tsx packages/harness/src/cli.ts bench \
  --queries packages/harness/queries/default.json \
  --stats reports/vault-stats.json
npx tsx packages/harness/src/cli.ts safety --vault "$SEEKSTONE_VAULT"
```

Harness env vars: `SEEKSTONE_REST_API_KEY` (from the Local REST API plugin) and `SEEKSTONE_REST_URL` (defaults to `https://127.0.0.1:27124`).

---

## License

MIT © Shaq Mughal
