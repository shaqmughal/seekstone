---
"seekstone": minor
---

Link-aware moves: `move_note` now rewrites wikilinks, embeds, and relative/vault-absolute markdown links in other notes that pointed at the moved note, so a move or rename no longer orphans it in the graph. Links that still resolve after the move (unchanged, unambiguous basename) are left byte-identical; aliases, `#fragments`, embed prefixes, and `%20`/`<...>` encodings are preserved; fenced code blocks are skipped. The tool reports how many links in how many notes were updated, `rewriteLinks: false` restores the old move-only behavior, and referencing notes outside `SEEKSTONE_WRITE_PATHS` are skipped and reported rather than blocking the move. Also fixes a pre-existing gap where the moved note's own outgoing links stayed registered in the backlink index under its old path.
