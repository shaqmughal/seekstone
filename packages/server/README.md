# seekstone

**The Obsidian MCP server that needs no plugin, no running Obsidian app — and doesn't blow your context window.**

Seekstone is an Obsidian MCP server that gives Claude (and any [Model Context Protocol](https://modelcontextprotocol.io) client) direct read and write access to your Obsidian vault. No Obsidian app needs to be running, no plugins are required, and nothing leaves your machine.

It reads your vault **directly from disk** instead of routing through the Obsidian Local REST API plugin, and holds a warm full-text index in-process. The practical difference: searches return in **single-digit milliseconds** with **~2 KB payloads** that stay flat as your vault grows — a broad query that costs tens of megabytes of context through a REST-proxy server (up to **95 MB** at 10k notes) costs ~2 KB through Seekstone, up to a **~47,000× reduction**. Benchmarked against 7 other Obsidian MCP servers across committed 1k/5k/10k-note vaults — [fully reproducible](https://github.com/shaqmughal/seekstone/tree/main/packages/harness), full results at [seekstone.dev/benchmarks](https://seekstone.dev/benchmarks).

(Previously also published as `obsidian-mcp-seekstone` — that alias is deprecated; existing installs keep working, but install `seekstone` going forward.)

[![Install in Claude Desktop](https://img.shields.io/badge/Install_in-Claude_Desktop-D97757?style=for-the-badge&logo=anthropic&logoColor=white)](https://github.com/shaqmughal/seekstone/releases/latest/download/seekstone.mcpb) [![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=seekstone&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInNlZWtzdG9uZSJdLCJlbnYiOnsiU0VFS1NUT05FX1ZBVUxUIjoiL2Fic29sdXRlL3BhdGgvdG8veW91ci92YXVsdCJ9fQ%3D%3D) [![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Server-0098FF?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://vscode.dev/redirect?url=vscode:mcp/install?%7B%22name%22%3A%22seekstone%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22seekstone%22%5D%2C%22env%22%3A%7B%22SEEKSTONE_VAULT%22%3A%22%2Fabsolute%2Fpath%2Fto%2Fyour%2Fvault%22%7D%7D)

---

## Install

Choose the method that suits you best.

### Using an AI agent? Paste this prompt

If you use Claude Code, Cursor, or another coding agent, paste this prompt and the agent does the install:

> Install the **seekstone** MCP server for this editor. Run `npx -y seekstone init --client code --write` (use `desktop`, `cursor`, or `vscode` for other clients). It auto-detects my Obsidian vault; if it lists several, ask me which one and re-run with `--vault "<path>"`. Relay any errors to me, then tell me to restart this session so the seekstone tools load.

### Option 1 — One-click (Claude Desktop, no terminal needed)

Download `seekstone.mcpb` from [GitHub Releases](https://github.com/shaqmughal/seekstone/releases/latest), double-click it in Claude Desktop, and pick your Obsidian vault folder when prompted. No JSON editing, no terminal, no Node.js setup required.

### Option 2 — Guided setup (recommended for CLI users)

Run the setup helper and let Seekstone find your vault automatically:

```bash
npx -y seekstone init
```

Seekstone reads Obsidian's own vault registry to detect your vault, validates it, and either prints the config to paste or patches the client config directly:

```bash
# Auto-detect vault, print config to paste
npx -y seekstone init

# Auto-detect vault, patch Claude Desktop in place (with backup)
npx -y seekstone init --write

# Specify vault explicitly if you have multiple
npx -y seekstone init --vault "/path/to/vault"

# Auto-configure Claude Code / Cursor / VS Code in one step
npx -y seekstone init --client code --write
npx -y seekstone init --client cursor --write
npx -y seekstone init --client vscode --write
```

### Option 3 — Manual config (Claude Desktop)

Add to `claude_desktop_config.json` (Settings → Developer → Edit Config):

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

### Option 4 — Claude Code

```bash
claude mcp add seekstone --env SEEKSTONE_VAULT=/absolute/path/to/your/vault -- npx -y seekstone
```

### Option 5 — Cursor

One-click via the [Install in Cursor](https://cursor.com/install-mcp?name=seekstone&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInNlZWtzdG9uZSJdLCJlbnYiOnsiU0VFS1NUT05FX1ZBVUxUIjoiL2Fic29sdXRlL3BhdGgvdG8veW91ci92YXVsdCJ9fQ%3D%3D) link above (then set `SEEKSTONE_VAULT` to your vault path), or let the CLI auto-detect your vault:

```bash
npx -y seekstone init --client cursor --write
```

Or add the Option 3 JSON block to `~/.cursor/mcp.json`.

### Option 6 — VS Code

One-click via the [Install in VS Code](https://vscode.dev/redirect?url=vscode:mcp/install?%7B%22name%22%3A%22seekstone%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22seekstone%22%5D%2C%22env%22%3A%7B%22SEEKSTONE_VAULT%22%3A%22%2Fabsolute%2Fpath%2Fto%2Fyour%2Fvault%22%7D%7D) link above (then set `SEEKSTONE_VAULT` to your vault path), or from the terminal:

```bash
code --add-mcp '{"name":"seekstone","command":"npx","args":["-y","seekstone"],"env":{"SEEKSTONE_VAULT":"/absolute/path/to/your/vault"}}'
```

Or auto-detect and write the workspace config:

```bash
npx -y seekstone init --client vscode --write
```

Other MCP clients (Windsurf, Cline, …) take the Option 3 JSON block in their own MCP config file.

---

## Tools

18 tools: 10 read, 8 write.

### Read

| Tool | Description |
|---|---|
| `search` | Full-text search. Returns ranked excerpts (default ~120 chars, tunable via `excerptLength`), not full notes. Fuzzy and prefix matching. |
| `query_notes` | Structured metadata query. Filter by frontmatter key/value predicates (`eq`, `ne`, `contains`, `exists`, `missing`, `gt`/`gte`/`lt`/`lte`), tag, folder, modified time, and size; sort and select the fields you need. Returns compact rows, not note content. |
| `context_pack` | Answer-ready context for a natural-language question in one call, hard-capped at a byte budget (default 2 KB): ranked excerpts, linked neighbor notes with one-line summaries, and follow-up source paths — replaces a search → read → get_backlinks round-trip loop. |
| `read_note` | Read the full content of a note by vault-relative path. Supports returning a single section, block, or line range. |
| `list_notes` | List notes, optionally filtered by folder prefix or tag. |
| `list_tags` | List all tags in the vault sorted by usage count (or alphabetically). |
| `outline_note` | Return a note's heading and block structure without its full content. |
| `get_backlinks` | Find all notes that link to a given note. |
| `get_links` | List all outgoing wikilinks and markdown links from a note. |
| `get_periodic_note` | Read a daily/weekly/monthly/quarterly/yearly note — path resolved from your vault config, no Obsidian required. |

### Write

| Tool | Description |
|---|---|
| `create_note` | Create a note (optional frontmatter + body); parent dirs created automatically. Never clobbers an existing note unless you pass `overwrite: true`. |
| `delete_note` | Move a note to the vault's `.trash/` folder (Obsidian-compatible, restorable). Pass `permanent: true` for an unrecoverable delete. |
| `move_note` | Move/rename a note — wikilinks and markdown links in other notes that point at it are rewritten so nothing breaks; destination dirs created automatically. |
| `append_note` | Append to a note body without touching frontmatter. |
| `patch_frontmatter` | Set/update/delete frontmatter keys without reordering existing keys or changing quote style. |
| `patch_note` | Insert text immediately after a heading without touching frontmatter. |
| `replace_in_note` | Find and replace text in the note body — literal or regex, whole-word, case sensitivity, optional `limit` (replaces **all** occurrences by default), dry-run preview. |
| `append_periodic_note` | Append to today's periodic note, creating it from a template if it doesn't yet exist. |

The content-editing tools (`append_note`, `patch_note`, `patch_frontmatter`, `replace_in_note`, `append_periodic_note`, and `create_note` with `overwrite: true`) support optional **compare-and-swap**: pass the `contentHash` you got from `read_note` as `prevHash` and the write fails cleanly if the note changed underneath you, instead of silently discarding the concurrent edit.

---

## Configuration

| Env var | Required | Description |
|---|---|---|
| `SEEKSTONE_VAULT` | yes | Absolute path to your Obsidian vault. |
| `SEEKSTONE_LOG_LEVEL` | no | `error` \| `warn` \| `info` (default) \| `debug`. |
| `SEEKSTONE_LOG_FILE` | no | Absolute path; when set, JSON-line logs are appended here (size-rotated). |
| `SEEKSTONE_WATCH_POLL` | no | Set to `1` to stat-poll for changes instead of native OS events — reliable on network drives, WSL, containers. |
| `SEEKSTONE_LOG_MAX_SIZE` | no | Log-rotation threshold for `SEEKSTONE_LOG_FILE` (e.g. `10mb`; default 5 MB). |
| `SEEKSTONE_READ_ONLY` | no | Set to `1` to run read-only: the 8 write tools are unregistered entirely (and rejected if called anyway), so the session provably cannot modify your vault. |
| `SEEKSTONE_WRITE_PATHS` | no | Comma-separated vault-relative globs (e.g. `journal/**,inbox/*.md`). Writes are permitted only under matching paths; the rest of the vault stays read-only. |

---

## Write safety

Giving an AI write access to your notes deserves more than "trust us." Seekstone ships the [Write-Safety Contract](https://github.com/shaqmughal/seekstone/blob/main/docs/WRITE-SAFETY.md): **eight named guarantees, each linked to the code that enforces it and the test that proves it**, verified byte-by-byte in CI on every commit and release — zero network, vault sandbox, byte-identical frontmatter on body edits, atomic writes, no-clobber creates, recoverable deletes, optional compare-and-swap, and write scoping / read-only mode.

---

## Frequently asked questions

**Does the Obsidian app need to be running?**
No — Seekstone reads the vault folder from disk directly.

**Do I need the Local REST API plugin?**
No — Seekstone bypasses it entirely (that's the source of the up-to-~47,000× payload reduction).

**How does `seekstone init` find my vault automatically?**
It reads Obsidian's own vault registry (`obsidian.json`) — the same file Obsidian uses to track your known vaults. One vault → auto-selected. Multiple → lists them and asks you to pick with `--vault`.

**What is the `.mcpb` file?**
An MCP Bundle — a zip containing the server and its manifest. Claude Desktop installs it with a double-click, no terminal required.

**Which AI clients does it support?**
Any MCP-over-stdio client: Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, Continue, and others.

**Does it work on Windows?**
Yes — tested on macOS, Linux, and Windows in CI on every commit.

**Is it safe?**
No network calls, no telemetry. The vault path is sandboxed — no tool reads or writes outside it. Writes are covered by the tested Write-Safety Contract above, and `SEEKSTONE_READ_ONLY=1` removes the write tools entirely.

---

## Requirements

- Node.js ≥ 22 (for CLI install options; the `.mcpb` bundle has no external requirements)
- macOS, Linux, or Windows

---

## License

MIT © Shaq Mughal · [seekstone.dev](https://seekstone.dev) · [GitHub](https://github.com/shaqmughal/seekstone) · [Issues](https://github.com/shaqmughal/seekstone/issues)
