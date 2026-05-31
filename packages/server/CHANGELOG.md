# seekstone

## 0.2.0

### Minor Changes

- 6a15f9a: Add CLI conveniences for setup and inspection:

  - `seekstone init` — validate an Obsidian vault and print the Claude config to paste, or patch the Claude Desktop config in place with `--write` (creates a timestamped backup and never touches your other MCP servers). Supports `--vault`, `--client desktop|code`.
  - `seekstone --version` and `seekstone --help`.

## 0.1.0

### Minor Changes

- d0a6a98: Initial public release of the Seekstone MCP server — a filesystem-direct Obsidian vault server with low context-tax.

  - Reads the vault **directly from disk** (no Obsidian app or Local REST API plugin required), returning small payloads instead of multi-megabyte responses.
  - 8 tools over stdio: `search`, `read_note`, `list_notes`, `create_note`, `delete_note`, `move_note`, `append_note`, `patch_frontmatter`.
  - In-memory MiniSearch full-text index, kept in sync by a cross-platform (chokidar) file watcher; `SEEKSTONE_WATCH_POLL=1` for network drives / WSL.
  - Structured leveled logging to stderr with an opt-in JSON-lines file (`SEEKSTONE_LOG_LEVEL`, `SEEKSTONE_LOG_FILE`); never writes to stdout.
  - Runs on macOS, Linux, and Windows (Node.js ≥ 22). Install with `npx -y seekstone`.
