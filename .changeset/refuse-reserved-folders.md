---
'seekstone': patch
---

Write tools now refuse paths inside `.seekstone/` (the write history) and `.trash/` (deleted notes), so an agent can't overwrite or delete its own undo history. `delete_note` still moves notes into `.trash/`, and `undo_write` still restores them.
