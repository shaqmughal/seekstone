---
"seekstone": patch
---

When a write fails because its history entry couldn't be saved, the entry's number is now kept by a placeholder row instead of being reused, so an `undo_write` from another server sharing the vault can't revert a different write by mistake. `undo_write` on that number now says there is nothing to undo.
