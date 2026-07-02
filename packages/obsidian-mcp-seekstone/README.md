# obsidian-mcp-seekstone

> **This package has been renamed to [`seekstone`](https://www.npmjs.com/package/seekstone).** Install that instead.

`obsidian-mcp-seekstone` was a discoverability alias for `seekstone` — the filesystem-direct Obsidian MCP server. The two packages were always the same server. The project has consolidated on the canonical name **`seekstone`**, and this alias is deprecated.

**Existing installs keep working** — this package still runs the same server — but it no longer receives updates. Migrate your MCP config when convenient.

## How to migrate

Replace `obsidian-mcp-seekstone` with `seekstone` wherever it appears.

**Claude Desktop** — `claude_desktop_config.json`:

```diff
 {
   "mcpServers": {
     "seekstone": {
       "command": "npx",
-      "args": ["-y", "obsidian-mcp-seekstone"],
+      "args": ["-y", "seekstone"],
       "env": { "SEEKSTONE_VAULT": "/absolute/path/to/your/vault" }
     }
   }
 }
```

**Claude Code:**

```bash
claude mcp remove seekstone
claude mcp add seekstone --env SEEKSTONE_VAULT=/path/to/vault -- npx -y seekstone
```

**Guided setup** (auto-detects your vault, patches your client config):

```bash
npx -y seekstone init
```

## What is Seekstone?

The fastest Obsidian MCP server for Claude — it reads your vault **directly from disk**, no Obsidian app, no plugins, no network calls. 16 tools over stdio: search (ranked excerpts, not full notes), reads, writes, link navigation, and structural ops. macOS, Linux, and Windows (Node.js ≥ 22).

Everything lives at:

- npm: [`seekstone`](https://www.npmjs.com/package/seekstone)
- Website: [seekstone.dev](https://seekstone.dev)
- GitHub: [shaqmughal/seekstone](https://github.com/shaqmughal/seekstone)

## License

MIT © Shaq Mughal
