---
'seekstone': patch
---

The npm README now states the write-safety limits as the code has them. `SEEKSTONE_HISTORY_MAX_ENTRIES` deletes the oldest journal entries outright, while `SEEKSTONE_HISTORY_MAX_SIZE` keeps them listed with `undoable: false`. `undo_write` has no `prevHash` and checks against the journal instead. A relative `SEEKSTONE_AUDIT_FILE` path resolves against the server's working directory, so use an absolute one. A symlink inside the vault that points outside it is followed.
