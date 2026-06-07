---
"seekstone": minor
"obsidian-mcp-seekstone": minor
---

Add five new tools, read_note range selectors, and Claude Code init support

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
