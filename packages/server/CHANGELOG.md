# seekstone

## 0.15.0

### Minor Changes

- c34c9e9: Local semantic search, opt-in and fully offline. With `SEEKSTONE_SEMANTIC=1`, the `search` tool gains `mode: "semantic"` (meaning-based search — a description like "instrument that measures wind speed" finds the Anemometer note even when no words match) and `mode: "hybrid"` (exact-title lookups stay lexical, everything else goes semantic). Powered by an in-process Model2Vec embedding model downloaded once via the new `seekstone fetch-model` subcommand — the running server never touches the network, keeping the zero-network guarantee intact. The vault embeds in the background at boot and is cached per-vault (keyed by content hash) so restarts are instant; the file watcher re-embeds changed notes incrementally. Semantic hits return the same lean ranked-excerpt payloads, with excerpts drawn from the matching passage rather than the note head. On the 10k-note benchmark vault, semantic mode answers description-style queries at 70% hit@5 vs lexical's 30%, at ~14 ms warm.

## 0.14.0

### Minor Changes

- 37c395d: Complete compare-and-swap coverage: every write tool now participates. `move_note` and `delete_note` accept an optional `prevHash` guarding the source note — a stale hash fails with the structured `hash_conflict` error before anything is moved or deleted, so you never destroy content you haven't seen. Every mutating result now returns a `contentHash`: `move_note` returns the hash of the (unchanged) bytes at the new path, `delete_note` the hash of the deleted content (byte-identical to the `.trash/` copy when recoverable), and `replace_in_note` returns the unchanged hash on dry runs and zero-match calls — so chained edits never need a re-read. The write-safety harness's `cas-conflict` op now also drives the move and delete guards.

## 0.13.1

### Patch Changes

- 87dc5b2: Advertise explicit MCP safety annotations for every tool so clients can distinguish read-only, additive, destructive, idempotent, and closed-world operations.

## 0.13.0

### Minor Changes

- e722330: New write tool `rename_heading` (19 tools): rename a heading in a note and rewrite every `[[note#heading]]` wikilink and embed across the vault so references keep working — aliases preserved, fenced code blocks and block refs (`#^id`) left alone, same-note anchors (`[[#heading]]`) included. Referencing notes come off the warm backlink index (no vault scan). Heading matching is case-insensitive and first-match-wins, mirroring Obsidian link resolution. Supports the optional `prevHash` compare-and-swap guard, and reports links/notes rewritten plus any notes skipped by `SEEKSTONE_WRITE_PATHS`.

### Patch Changes

- 4b2f3a2: YAML-aware frontmatter link extraction: wikilinks split across lines by scalar folding (hand edits, other tools, or files written by pre-0.12.1 versions) now extract correctly into the backlink index, `get_links`, and `context_pack`. The frontmatter block is parsed as YAML and its string values walked, instead of regexing raw lines; malformed frontmatter falls back to the previous per-line behavior. Links inside multi-line scalars are attributed to the line where the scalar begins, and YAML keys are no longer scanned for links.

## 0.12.2

### Patch Changes

- 1ad6028: Documentation accuracy sweep: npm description now says 18 tools; `replace_in_note` is correctly documented as replacing all occurrences by default (literal/regex, whole-word, `limit`, dry-run); compare-and-swap docs name the six participating edit tools; `SEEKSTONE_LOG_MAX_SIZE` added to the configuration tables; SECURITY.md rewritten for recoverable deletes, the full 8-tool write surface, read-only mode, and write scoping; llms.txt and REGISTRIES.md updated to current benchmark claims. No code changes.
- e2c5926: Harden the vault sandbox: path containment now uses a single shared guard (`resolveVaultPath`) with a proper separator-boundary check, replacing 13 inline `startsWith` checks that accepted paths escaping into sibling directories whose names share the vault's prefix (e.g. vault `/home/u/vault` + path `../vault-backup/x.md`). The vault root is also normalized with `resolve()` at startup so a relative or trailing-slash `SEEKSTONE_VAULT` can't weaken the boundary, and absolute-path inputs are now contained instead of concatenated.

## 0.12.1

### Patch Changes

- d24cb4d: Refresh the npm-facing README to current messaging: 18 tools (adds `query_notes` and `context_pack` to the tables), recoverable `.trash/` deletes, compare-and-swap edits, the Write-Safety Contract, `SEEKSTONE_READ_ONLY` / `SEEKSTONE_WRITE_PATHS` configuration, and current benchmark numbers replacing the retired pre-launch figures. No code changes.
- 8286529: Stop folding long frontmatter scalars. `create_note` and `patch_frontmatter` passed no
  `lineWidth` to the YAML serializer, so values past 80 columns were wrapped across lines with a
  trailing `\`. The output is valid YAML and round-trips, but link extraction runs per line, so a
  wikilink split that way became invisible to the backlink index, `get_links` and `context_pack` —
  a patch touching one key could silently drop a link declared under another.

## 0.12.0

### Minor Changes

- 2642435: Add `context_pack` — one-call, byte-budgeted context assembly for answering a question about the vault. Returns ranked excerpts (with inline scalar frontmatter), backlink/outlink neighbor notes with one-line summaries, and overflow source refs for follow-up reads, all hard-capped at a caller-set byte budget (default 2048, never exceeded). Replaces the search → read → get_backlinks round-trip loop with a single payload, and reports explicit `totalMatches` + `confidence` so an empty or thin pack is never mistaken for coverage.

### Patch Changes

- 3961616: Bump picomatch from 2.3.2 to 4.0.5 (write-path glob matching; call-site API unchanged).

## 0.11.1

### Patch Changes

- d428aa3: Bump @modelcontextprotocol/sdk from 1.29.0 to 1.30.0.

## 0.11.0

### Minor Changes

- 543a5d9: Guarded writes: `read_note` (and every mutating tool) now returns a `contentHash` (sha-256 of the note's disk bytes), and the edit tools — `append_note`, `patch_note`, `patch_frontmatter`, `replace_in_note`, `append_periodic_note`, plus `create_note` with `overwrite: true` — accept an optional `prevHash` for compare-and-swap: if the note changed since it was read, the write fails with a structured `hash_conflict` error carrying the current hash instead of silently discarding the concurrent edit. Returned hashes chain, so multi-step edits need no re-reads. All write paths now also go through one shared crash-safe temp-file+rename helper — previously only `patch_note` and `replace_in_note` wrote atomically.
- 3e9d25c: Recoverable deletes: `delete_note` now moves the note to the vault's `.trash/` folder (Obsidian-compatible, restore by moving it back) instead of permanently removing it; name collisions get a timestamp suffix, and the tool result says where the note went. Pass `permanent: true` for the old unlink behavior. Also fixes a gap where a deleted note's outgoing links stayed registered in the backlink index.

## 0.10.0

### Minor Changes

- fd1e03a: Read-only mode and write-path scoping. `SEEKSTONE_READ_ONLY=1` unregisters the 8 write tools from the tool list (and rejects them at dispatch if called anyway — `get_periodic_note`'s `createIfMissing` side-effect is also neutralized). `SEEKSTONE_WRITE_PATHS` takes comma-separated vault-relative globs (e.g. `journal/**,inbox/*.md`) and restricts writes to matching paths. Both are enforced at the dispatch layer plus a shared `assertWritable` check in every write handler, so a new tool can't forget the check.
- e6092c3: Link-aware moves: `move_note` now rewrites wikilinks, embeds, and relative/vault-absolute markdown links in other notes that pointed at the moved note, so a move or rename no longer orphans it in the graph. Links that still resolve after the move (unchanged, unambiguous basename) are left byte-identical; aliases, `#fragments`, embed prefixes, and `%20`/`<...>` encodings are preserved; fenced code blocks are skipped. The tool reports how many links in how many notes were updated, `rewriteLinks: false` restores the old move-only behavior, and referencing notes outside `SEEKSTONE_WRITE_PATHS` are skipped and reported rather than blocking the move. Also fixes a pre-existing gap where the moved note's own outgoing links stayed registered in the backlink index under its old path.

### Patch Changes

- b82c6ef: `seekstone init` now errors on an unknown `--client` value instead of silently configuring Claude Desktop — agents running the one-prompt install get a clear failure they can relay. Docs gain a copy-pasteable agent install prompt (README + llms.txt), and llms.txt catches up to the 17-tool surface (adds `query_notes`).
- 227fe6c: `seekstone init --help` (and `-h`) now prints the init subcommand's usage — its `--vault`, `--client`, and `--write` flags — instead of ignoring the flag and running the init flow (vault auto-detection). Help flags after `init` were previously swallowed by init's own argument parsing.

## 0.9.1

### Patch Changes

- ac99ba5: Watcher teardown is now awaitable: `stop()` returns chokidar's close promise instead of fire-and-forgetting it, so embedders and tests can wait for the watcher (and its polling timers) to fully shut down. Also deflakes CI: the harness's `copyVault` scratch destinations are created atomically with `mkdtemp` (the old millisecond-timestamp naming could collide under parallel test workers), and the watcher tests self-heal missed single-create polling ticks on Windows.
- a8414b8: npm description now matches the README wedge: no plugin, no running Obsidian app, filesystem-direct with single-digit-ms search and ~2 KB payloads across 17 tools. Replaces the stale pre-benchmark-refresh "575×" phrasing.

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
