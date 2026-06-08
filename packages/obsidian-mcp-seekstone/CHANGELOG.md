# obsidian-mcp-seekstone

## 0.4.1

### Patch Changes

- Updated dependencies [3e47cd8]
  - seekstone@0.4.1

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

- Updated dependencies [3ec5e67]
- Updated dependencies [3ec5e67]
  - seekstone@0.4.0

## 0.2.2

### Patch Changes

- 26267bd: Add `mcpName` field required by the official MCP registry for package ownership verification.
