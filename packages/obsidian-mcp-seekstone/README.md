# obsidian-mcp-seekstone

> **A discoverability alias for [seekstone](https://www.npmjs.com/package/seekstone)** — the filesystem-direct Obsidian MCP server.

`obsidian-mcp-seekstone` and `seekstone` are the same server. This package exists so users searching npm for "obsidian mcp" can find it. The underlying code, tools, and documentation all live in [shaqmughal/seekstone](https://github.com/shaqmughal/seekstone).

## Why seekstone?

Seekstone reads your Obsidian vault **directly from disk** instead of routing through the Local REST API plugin. The practical difference: a search that returns ~1.75 MB / ~459,000 tokens via the REST plugin returns **~3 KB / ~800 tokens** via seekstone — a ~575× reduction. No Obsidian app, no plugin, no network calls.

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
claude mcp add seekstone --env SEEKSTONE_VAULT=/path/to/vault -- npx -y obsidian-mcp-seekstone
```

## Tools

8 tools over stdio: `search`, `read_note`, `list_notes`, `create_note`, `delete_note`, `move_note`, `append_note`, `patch_frontmatter`.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `SEEKSTONE_VAULT` | Yes | Absolute path to your Obsidian vault. |
| `SEEKSTONE_LOG_LEVEL` | No | `error` \| `warn` \| `info` (default) \| `debug`. |
| `SEEKSTONE_WATCH_POLL` | No | Set to `1` for network drives / WSL. |

Works on macOS, Linux, and Windows (Node.js ≥ 22).

## Source & docs

Everything is in [shaqmughal/seekstone](https://github.com/shaqmughal/seekstone). Issues, PRs, and docs live there.

## License

MIT © Shaq Mughal
