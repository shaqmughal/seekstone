---
"seekstone": patch
---

`vault_stats` and `get_backlinks` now match the files right after a write. Appends, patches, task toggles and frontmatter edits update the note's size, modified time, tags and frontmatter in the index straight away. A write that removes a link (`replace_in_note`, `patch_note`, `patch_frontmatter`, `create_note` with `overwrite`) no longer leaves the old backlink behind for good. Links to a deleted note stop counting in `links.resolved`, and come back if the note is restored. `move_note` keeps backlinks from notes it didn't rewrite when their links still resolve to the new path, and drops the backlinks of a note it overwrote.
