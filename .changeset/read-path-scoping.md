---
"seekstone": minor
---

Add `SEEKSTONE_READ_PATHS`, which hides parts of the vault from the agent. It takes comma-separated vault-relative globs, the same syntax as `SEEKSTONE_WRITE_PATHS`; a leading `!` excludes, so `!Journal/**` means everything except `Journal/`. Files outside the scope are never indexed or watched, never appear in any tool output, and reading one by path returns the same not-found error as a missing file. Links to them resolve like links to nothing, and write-history entries that touched them are hidden from `list_writes` and `undo_write`. Writes are limited to the read scope as well. When the variable is unset nothing changes.

A `!` glob in `SEEKSTONE_WRITE_PATHS` now also excludes (`journal/**,!journal/locked/**` no longer lets writes into `journal/locked/`). Before, it was ORed with the other globs and had no effect.
