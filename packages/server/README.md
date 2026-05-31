# seekstone / obsidian-mcp-seekstone

**An Obsidian MCP server — filesystem-direct, low context-tax.**

Seekstone reads your Obsidian vault **directly from disk** instead of routing through the Local REST API plugin. The practical difference: a search that returns ~1.75 MB / ~459,000 tokens via the REST plugin returns **~3 KB / ~800 tokens** via seekstone — a ~575× reduction. No context window wasted on a single tool call.

It runs as a standard [MCP](https://modelcontextprotocol.io) stdio server. No Obsidian app, no plugin, no network calls — just point it at a vault folder.

**Two npm names, same server:**

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

## Configuration

| Env var | Required | Description |
|---|---|---|
| `SEEKSTONE_VAULT` | yes | Absolute path to your Obsidian vault. |
| `SEEKSTONE_LOG_LEVEL` | no | `error` \| `warn` \| `info` (default) \| `debug`. |
| `SEEKSTONE_LOG_FILE` | no | Absolute path; when set, JSON-line logs are appended here (size-rotated). |
| `SEEKSTONE_WATCH_POLL` | no | Set to `1` to stat-poll for changes instead of native OS events — slower but reliable on network drives, WSL, and some containers. |

Works on macOS, Linux, and Windows.

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

## Requirements

- Node.js ≥ 22

## License

MIT © Shaq Mughal. Source and issues: <https://github.com/shaqmughal/seekstone>
