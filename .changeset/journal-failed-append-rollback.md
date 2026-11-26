---
"seekstone": patch
---

A write whose journal entry can't be recorded no longer leaves an entry behind, and a failed journal compaction no longer fails the write.

Stop every seekstone server that shares a vault before upgrading. An older server running next to this one can write a rolled-back journal row back into the manifest and drop a real write's undo history.
