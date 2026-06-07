---
"seekstone": patch
"obsidian-mcp-seekstone": patch
---

Fix watcher ignored-path guard and MCPB bundle crash

- **Watcher**: guard against empty relative paths in the `ignored` callback. Paths that resolved to an empty string (e.g. the vault root itself during chokidar's initial scan) could be evaluated incorrectly, risking file events being missed on some configurations.
- **MCPB**: fully bundle all dependencies to fix an `Error: require('process') is not supported` crash on ESM environments. Also improves the vault picker description and bumps the bundle to manifest v0.4.
