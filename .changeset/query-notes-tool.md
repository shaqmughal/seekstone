---
"seekstone": minor
---

New `query_notes` tool — a second search mode alongside full-text `search`. Filter notes by frontmatter key/value predicates (`eq`, `ne`, `contains`, `exists`, `missing`, `gt`/`gte`/`lt`/`lte`), tag, folder, modified time, and size, with sort, field selection, and limit. Returns compact rows (path + title by default; opt into frontmatter keys or `mtime`/`size`/`tags` via `select`) — never note content — so a full 10k-note vault scan costs ~350 bytes of context.
