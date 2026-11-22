---
'seekstone': patch
---

The npm README now states the write-safety limits as the code has them. `SEEKSTONE_HISTORY_MAX_ENTRIES` deletes the oldest journal entries outright, while `SEEKSTONE_HISTORY_MAX_SIZE` keeps them listed with `undoable: false`. `undo_write` has no `prevHash` and checks against the journal instead. A relative `SEEKSTONE_AUDIT_FILE` path resolves against the server's working directory, so use an absolute one. A symlink inside the vault that points outside it is followed.

The `undo_write` tool description no longer says a multi-file move is restored whole, which isn't true when a restore write fails partway. The `prevHash` description on the ten compare-and-swap tools now says the call fails with `hash_conflict` on a mismatch, rather than whenever the note changed since it was read. The read-write tool list is 51 tokens smaller (5,821 to 5,770); the read-only list is unchanged.
