---
"seekstone": minor
---

Read-only mode and write-path scoping. `SEEKSTONE_READ_ONLY=1` unregisters the 8 write tools from the tool list (and rejects them at dispatch if called anyway — `get_periodic_note`'s `createIfMissing` side-effect is also neutralized). `SEEKSTONE_WRITE_PATHS` takes comma-separated vault-relative globs (e.g. `journal/**,inbox/*.md`) and restricts writes to matching paths. Both are enforced at the dispatch layer plus a shared `assertWritable` check in every write handler, so a new tool can't forget the check.
