---
"seekstone": minor
---

New `resolve_note` tool + alias-aware link resolution everywhere (SHA-22). `resolve_note` turns a note name, path, or frontmatter alias into its canonical vault path(s), with provenance per match (`path`/`basename`/`relpath`/`alias`), all candidates listed when a reference is ambiguous, and did-you-mean suggestions when nothing matches. The shared resolver now reads frontmatter `aliases:`/`alias:` as a lowest-precedence tier, so `get_links`, `get_backlinks`, `context_pack`, and semantic link expansion resolve `[[Alias]]` wikilinks instead of reporting them unresolved — and `move_note`'s link rewriting leaves alias-form links untouched, since the alias travels with the moved note. Source-relative resolution (a `from` parameter) is deferred until the link index itself resolves relative targets.
