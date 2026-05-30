# seekstone

**An Obsidian MCP server — filesystem-direct, low context-tax.**

Seekstone reads your Obsidian vault **directly from disk** instead of routing through the Obsidian Local REST API plugin. The practical difference: a search that returns ~1.75 MB / ~459,000 tokens via the REST plugin returns **~3 KB / ~800 tokens** via seekstone — a ~575× reduction. Claude can search and read notes without burning its context window on a single tool call.

It runs as a standard [MCP](https://modelcontextprotocol.io) stdio server with no Obsidian app or plugin required — just point it at a vault directory.

## Install

```jsonc
// Claude Desktop — claude_desktop_config.json
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

Or with Claude Code:

```bash
claude mcp add seekstone --env SEEKSTONE_VAULT=/absolute/path/to/your/vault -- npx -y seekstone
```

Restart the client. On startup seekstone walks the vault and builds an in-memory full-text index (a couple of seconds for a few thousand notes), then keeps it in sync as notes change.

## Configuration

| Env var | Required | Description |
|---|---|---|
| `SEEKSTONE_VAULT` | yes | Absolute path to the Obsidian vault. |
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
