# seekstone

## 0.9.0

### Minor Changes

- aa0a6c3: `seekstone init --client vscode` — auto-detect your vault and print or (with `--write`) create/merge the workspace `.vscode/mcp.json` for GitHub Copilot in VS Code, handling VS Code's config quirks (`servers` key instead of `mcpServers`, explicit `"type": "stdio"`). Same additive merge + backup behavior as the other client writers. `init` now also resolves relative `--vault` paths to absolute before writing any client config, so the spawned server always finds the vault regardless of the client's working directory.

## 0.8.0

### Minor Changes

- 0bb43fc: `seekstone init --client cursor` — auto-detect your vault and print or (with `--write`) patch `~/.cursor/mcp.json`, with the same additive merge + backup behavior as the Claude Desktop writer. Cursor joins Claude Desktop and Claude Code as a first-class documented client.
- 04271ed: New `query_notes` tool — a second search mode alongside full-text `search`. Filter notes by frontmatter key/value predicates (`eq`, `ne`, `contains`, `exists`, `missing`, `gt`/`gte`/`lt`/`lte`), tag, folder, modified time, and size, with sort, field selection, and limit. Returns compact rows (path + title by default; opt into frontmatter keys or `mtime`/`size`/`tags` via `select`) — never note content — so a full 10k-note vault scan costs ~350 bytes of context.

## 0.7.2

### Patch Changes

- 8c5ddb7: Add npm keywords for the adjacent discovery clusters Seekstone was absent from: `claude-code`, `second-brain`, `chatgpt`, `cursor`, `connect-claude-to-obsidian`, `mcp-server`.

## 0.7.1

### Patch Changes

- cdf659a: Consolidate on the canonical npm name `seekstone`. The `obsidian-mcp-seekstone` discoverability alias is deprecated: its README is now a migration notice, and all install docs point at `npx -y seekstone`. Existing alias installs keep working. This is the alias's final release.

## 0.7.0

### Minor Changes

- a61612c: feat(search): slim the search payload below mcpvault, add a tunable excerpt length

  `search` results are now leaner with no loss of usable information: the response
  is minified, `score` is rounded to 2 decimals, and `title`/`tags` are omitted
  when redundant (title equals the path basename) or empty — both remain optional
  on each hit. A new `excerptLength` parameter (default 120, min 20 / max 2000)
  lets callers trade match context for an even smaller payload.

  On the committed 10k-note fixture this drops the mean search payload to ~2 KB,
  making seekstone the smallest payload of every benchmarked Obsidian MCP server
  (below mcpvault at every vault size) while staying the fastest on latency.

## 0.6.3

### Patch Changes

- 0a192cc: fix(mcpb): shard the bundle under Claude Desktop's ~108KB per-file install cap

  The `.mcpb` one-click install silently broke as of v0.4.0: Claude Desktop's
  local install preview rejects a bundle if any single file exceeds ~108KB, and
  the fully-bundled `dist/index.js` is ~1.7MB. The bundle is now split into <95KB
  shards that a small loader reassembles at startup, so the install dialog appears
  again. A build-time guard fails the build if any packed file exceeds the cap.

## 0.6.2

### Patch Changes

- cc3bd9d: Point package `homepage` at the new site, https://seekstone.dev (was the GitHub readme).

## 0.6.1

### Patch Changes

- d1a7fb1: Bump chokidar from 4.x to 5.x (bundled dependency — no API surface change for consumers).
- 3bafa80: Bump zod from 3.x to 4.x (bundled dependency — no API surface change for consumers).
- d2ac3d5: Fix watcher silently dropping all events on Windows when the vault path contains 8.3 short names (e.g. `RUNNER~1`). chokidar's `followSymlinks: true` expands short paths to long form via `realpath()`, causing `relative()` to produce `..` segments that the dot-directory filter incorrectly matched. Now resolves the vault root via `realpathSync` at startup so path comparisons are consistent.
- 2cda8b8: Bound `replace_in_note`'s `find` parameter to 1000 chars at the schema boundary, capping the size of any caller-supplied pattern in `regex: true` mode (ReDoS / self-DoS guard). Also converts an internal `new RegExp(constant.source)` in the link extractor to a direct regex literal — behavior-neutral, removes a per-line allocation, and clears a Codacy non-literal-RegExp false positive.
- 2d9588f: Add a process-level `unhandledRejection` guard to the server entrypoint. A stray unhandled promise rejection now logs to stderr and the long-lived stdio session stays up (preserving the in-memory index) instead of crashing the user's MCP session. `uncaughtException` is intentionally left to Node's default crash behaviour.

## 0.6.0

### Minor Changes

- dd136ae: Add `get_periodic_note` and `append_periodic_note` tools for filesystem-direct access to daily, weekly, monthly, quarterly, and yearly periodic notes. Reads folder/format/template config from `.obsidian/daily-notes.json` and the periodic-notes plugin data.json with moment.js-compatible date tokens. No running Obsidian required.

### Patch Changes

- 0d7e2d1: Add HTML reporter to server vitest coverage config so `--coverage` runs generate an interactive report at `coverage/index.html`.
- 95c6f0b: Sync manifest.json version to 0.5.0 (was left at 0.3.0 after changeset release) and ignore the mcp-publisher binary from git.

## 0.5.0

### Minor Changes

- c430b48: Add `replace_in_note` tool — literal and regex find/replace within a note body. Supports case-insensitive matching (default), whole-word boundaries, capture-group backreferences in regex mode, a replacement limit, and a dry-run preview mode. Frontmatter is never touched.

### Patch Changes

- c3d3cda: Fix serverInfo.version in MCP handshake — was hardcoded to "0.1.0" instead of using the build-time version constant. MCP clients that surface server metadata now see the correct version.

## 0.4.1

### Patch Changes

- 3e47cd8: Fix serverInfo.version in MCP handshake — was hardcoded to "0.1.0" instead of using the build-time version constant. MCP clients that surface server metadata now see the correct version.

## 0.4.0

### Minor Changes

- 3ec5e67: Add five new tools, read_note range selectors, and Claude Code init support

  **New tools:**

  - `list_tags` — lists every tag across the vault with per-tag note counts
  - `outline_note` — returns the heading structure of a note as a nested tree
  - `patch_note` — replaces a specific section of a note's body without rewriting the whole file
  - `get_links` — returns all wikilinks and embeds in a note with resolved vault-relative paths and line numbers
  - `get_backlinks` — returns all notes that link to a given note, with line numbers and optional excerpts; backed by a reverse-link index built at startup and maintained incrementally by the file watcher

  **`read_note` range selectors:**

  Three new optional selectors narrow the response to a sub-region of the note: `section` (by heading name), `block` (by block reference `^id`), and `lines` (`{ from, to }`). Only one selector may be used per call. The response includes a `span: { charStart, charEnd }` field for the selected range.

  **`seekstone init` — Claude Code support:**

  `seekstone init --client code --write` now auto-writes the MCP config directly into Claude Code's settings file, with the same timestamped-backup safety as the Desktop variant.

### Patch Changes

- 3ec5e67: Fix watcher ignored-path guard and MCPB bundle crash

  - **Watcher**: guard against empty relative paths in the `ignored` callback. Paths that resolved to an empty string (e.g. the vault root itself during chokidar's initial scan) could be evaluated incorrectly, risking file events being missed on some configurations.
  - **MCPB**: fully bundle all dependencies to fix an `Error: require('process') is not supported` crash on ESM environments. Also improves the vault picker description and bumps the bundle to manifest v0.4.

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
