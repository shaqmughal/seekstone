# seekstone

**The Obsidian MCP server for Claude — search and edit your vault without burning context.**

Seekstone is an Obsidian MCP server that gives Claude (and any [Model Context Protocol](https://modelcontextprotocol.io) client) direct read and write access to your Obsidian vault. No Obsidian app needs to be running, no plugins are required, and nothing leaves your machine.

It reads your vault **directly from disk** instead of routing through the Obsidian Local REST API plugin. The practical difference: a search that returns ~1.75 MB and ~459,000 tokens via the REST plugin returns **~3 KB and ~800 tokens** via Seekstone — a **~575× reduction**. Claude can search and read your entire note library without burning most of its context window on a single tool call.

(Previously also published as `obsidian-mcp-seekstone` — that alias is deprecated; existing installs keep working, but install `seekstone` going forward.)

---

## Install

Choose the method that suits you best.

### Option 1 — One-click (Claude Desktop, no terminal needed)

Download `seekstone.mcpb` from [GitHub Releases](https://github.com/shaqmughal/seekstone/releases/latest), double-click it in Claude Desktop, and pick your Obsidian vault folder when prompted. No JSON editing, no terminal, no Node.js setup required.

### Option 2 — Guided setup (recommended for CLI users)

Run the setup helper and let Seekstone find your vault automatically:

```bash
npx -y seekstone init
```

Seekstone reads Obsidian's own vault registry to detect your vault, validates it, and either prints the config to paste or patches Claude Desktop directly:

```bash
# Auto-detect vault, print config to paste
npx -y seekstone init

# Auto-detect vault, patch Claude Desktop in place (with backup)
npx -y seekstone init --write

# Specify vault explicitly if you have multiple
npx -y seekstone init --vault "/path/to/vault"

# Generate the Claude Code command instead
npx -y seekstone init --client code
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

---

## Tools

### Read

| Tool | Description |
|---|---|
| `search` | Full-text search. Returns ranked excerpts (default ~120 chars, tunable via `excerptLength`), not full notes. Fuzzy, prefix, and phrase queries. |
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
| `create_note` | Create a note (optional frontmatter + body); parent dirs created automatically. |
| `delete_note` | Permanently delete a note. |
| `move_note` | Move/rename a note; destination dirs created automatically. |
| `append_note` | Append to a note body without touching frontmatter. |
| `patch_frontmatter` | Set/update/delete frontmatter keys without reordering existing keys or changing quote style. |
| `patch_note` | Insert text immediately after a heading without touching frontmatter. |
| `replace_in_note` | Replace the first occurrence of a word or phrase in the note body. |
| `append_periodic_note` | Append to today's periodic note, creating it from a template if it doesn't yet exist. |

---

## Configuration

| Env var | Required | Description |
|---|---|---|
| `SEEKSTONE_VAULT` | yes | Absolute path to your Obsidian vault. |
| `SEEKSTONE_LOG_LEVEL` | no | `error` \| `warn` \| `info` (default) \| `debug`. |
| `SEEKSTONE_LOG_FILE` | no | Absolute path; when set, JSON-line logs are appended here (size-rotated). |
| `SEEKSTONE_WATCH_POLL` | no | Set to `1` to stat-poll for changes instead of native OS events — reliable on network drives, WSL, containers. |

---

## Frequently asked questions

**Does the Obsidian app need to be running?**
No — Seekstone reads the vault folder from disk directly.

**Do I need the Local REST API plugin?**
No — Seekstone bypasses it entirely (that's where the 575× reduction comes from).

**How does `seekstone init` find my vault automatically?**
It reads Obsidian's own vault registry (`obsidian.json`) — the same file Obsidian uses to track your known vaults. One vault → auto-selected. Multiple → lists them and asks you to pick with `--vault`.

**What is the `.mcpb` file?**
An MCP Bundle — a zip containing the server and its manifest. Claude Desktop installs it with a double-click, no terminal required.

**Which AI clients does it support?**
Any MCP-over-stdio client: Claude Desktop, Claude Code, Cursor, Windsurf, Continue, and others.

**Does it work on Windows?**
Yes — tested on macOS, Linux, and Windows in CI on every commit.

**Is it safe?**
No network calls, no telemetry. The vault path is sandboxed — no tool reads or writes outside it.

---

## Requirements

- Node.js ≥ 22 (for CLI install options; the `.mcpb` bundle has no external requirements)
- macOS, Linux, or Windows

---

## License

MIT © Shaq Mughal · [GitHub](https://github.com/shaqmughal/seekstone) · [Issues](https://github.com/shaqmughal/seekstone/issues)
