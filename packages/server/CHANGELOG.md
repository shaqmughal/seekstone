# seekstone

## 0.3.0

### Minor Changes

- f6f6770: Auto-detect the Obsidian vault in `seekstone init`

  When `--vault` is omitted and `SEEKSTONE_VAULT` is not set, `seekstone init`
  now reads Obsidian's own vault registry (`obsidian.json`) to find known vaults
  automatically. One vault → auto-selected and validated. Multiple vaults → lists
  them numbered with a `--vault` re-run hint. Registry missing/malformed → falls
  back to the existing "pass --vault" guidance.

- f2c6d7c: Ship Seekstone as a one-click MCP Bundle (MCPB)

  Adds a `seekstone.mcpb` build artifact that lets non-developers install
  Seekstone in Claude Desktop with a double-click and a vault directory picker —
  no terminal, no JSON editing required. The bundle packages `dist/index.js` and
  `manifest.json` into a 15 KB zip. CI attaches it to every GitHub Release.

  The `npx -y seekstone` path is unchanged.

## 0.2.1

### Patch Changes

- 326ccf3: Add the `mcp-name` package field (`io.github.shaqmughal/seekstone`) so the package can be verified and listed in the official MCP registry.

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
