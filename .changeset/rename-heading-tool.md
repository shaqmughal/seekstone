---
"seekstone": minor
---

New write tool `rename_heading` (19 tools): rename a heading in a note and rewrite every `[[note#heading]]` wikilink and embed across the vault so references keep working — aliases preserved, fenced code blocks and block refs (`#^id`) left alone, same-note anchors (`[[#heading]]`) included. Referencing notes come off the warm backlink index (no vault scan). Heading matching is case-insensitive and first-match-wins, mirroring Obsidian link resolution. Supports the optional `prevHash` compare-and-swap guard, and reports links/notes rewritten plus any notes skipped by `SEEKSTONE_WRITE_PATHS`.
