---
'seekstone': patch
---

Write tools now refuse paths inside `.seekstone/` (the write history) and `.trash/` (deleted notes), so an agent can't overwrite or delete its own undo history. Restoring a deleted note by moving it out of `.trash/` with `move_note` still works, and `undo_write` can still undo both the delete and the restore.
