# seekstone / obsidian-mcp-seekstone

**The MCP server that connects Claude to your Obsidian vault — filesystem-direct, no plugins, no context waste.**

Seekstone is an Obsidian MCP server that gives Claude (and any [Model Context Protocol](https://modelcontextprotocol.io) client) direct read and write access to your Obsidian vault. No Obsidian app needs to be running, no plugins are required, and nothing leaves your machine.

It reads your vault **directly from disk** instead of routing through the Obsidian Local REST API plugin. The practical difference: a search that returns ~1.75 MB and ~459,000 tokens via the REST plugin returns **~3 KB and ~800 tokens** via Seekstone — a **~575× reduction**. Claude can search and read your entire note library without burning most of its context window on a single tool call.

**Two npm names, one server:**

| Package | Best for |
|---|---|
| [`obsidian-mcp-seekstone`](https://www.npmjs.com/package/obsidian-mcp-seekstone) | Searching npm for "obsidian mcp" |
| [`seekstone`](https://www.npmjs.com/package/seekstone) | Shorter name if you already know it |

## Install

**Claude Desktop** — `claude_desktop_config.json`:

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

### Guided setup

`seekstone init` validates your vault and prints the config to paste, or patches the Claude Desktop config for you (with a backup, leaving other MCP servers untouched):

```bash
npx -y obsidian-mcp-seekstone init --vault "/absolute/path/to/your/vault"          # print config
npx -y obsidian-mcp-seekstone init --vault "/absolute/path/to/your/vault" --write  # patch Claude Desktop
npx -y obsidian-mcp-seekstone init --vault "/absolute/path/to/your/vault" --client code
```

## What can Claude do with your vault?

Once connected, ask Claude things like:

- **"Search my notes for everything about [topic] and summarize"** — ranked excerpts, not full files
- **"Find all notes tagged #project and list their titles"** — folder and tag filtering
- **"Read my note on [topic] and suggest improvements"** — full note content
- **"Create a meeting note for today with this template"** — creates note + parent dirs
- **"Add a summary section to the bottom of [note]"** — appends without touching frontmatter
- **"Update the status field in this note's frontmatter to 'done'"** — key-safe YAML edit

## Tools

| Tool | Description |
|---|---|
| `search` | Full-text search. Returns ranked ~200-char excerpts, not full notes. Fuzzy, prefix, and phrase queries. |
| `read_note` | Read the full content of a note by vault-relative path. |
| `list_notes` | List notes, optionally filtered by folder prefix or tag. |
| `create_note` | Create a note (optional frontmatter + body); parent dirs created automatically. |
| `delete_note` | Permanently delete a note. |
| `move_note` | Move/rename a note; destination dirs created automatically. |
| `append_note` | Append to a note body without touching frontmatter. |
| `patch_frontmatter` | Set/update/delete frontmatter keys without reordering existing keys or changing quote style. |

## Configuration

| Env var | Required | Description |
|---|---|---|
| `SEEKSTONE_VAULT` | yes | Absolute path to your Obsidian vault. |
| `SEEKSTONE_LOG_LEVEL` | no | `error` \| `warn` \| `info` (default) \| `debug`. |
| `SEEKSTONE_LOG_FILE` | no | Absolute path; when set, JSON-line logs are appended here (size-rotated). |
| `SEEKSTONE_WATCH_POLL` | no | Set to `1` to stat-poll for changes instead of native OS events — reliable on network drives, WSL, containers. |

## Frequently asked questions

**Does the Obsidian app need to be running?** No — Seekstone reads the vault folder from disk directly.

**Do I need the Local REST API plugin?** No — Seekstone bypasses it entirely (that's where the 575× reduction comes from).

**Which AI clients does it support?** Any MCP-over-stdio client: Claude Desktop, Claude Code, Cursor, Windsurf, Continue, and others.

**Does it work on Windows?** Yes — tested on macOS, Linux, and Windows in CI on every commit.

**Is it safe?** No network calls, no telemetry. The vault path is sandboxed — no tool reads or writes outside it.

## Requirements

- Node.js ≥ 22
- Works on macOS, Linux, and Windows

## License

MIT © Shaq Mughal. Source and issues: <https://github.com/shaqmughal/seekstone>
