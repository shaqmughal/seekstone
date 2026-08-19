---
'seekstone': minor
---

Complete compare-and-swap coverage: every write tool now participates. `move_note` and `delete_note` accept an optional `prevHash` guarding the source note — a stale hash fails with the structured `hash_conflict` error before anything is moved or deleted, so you never destroy content you haven't seen. Every mutating result now returns a `contentHash`: `move_note` returns the hash of the (unchanged) bytes at the new path, `delete_note` the hash of the deleted content (byte-identical to the `.trash/` copy when recoverable), and `replace_in_note` returns the unchanged hash on dry runs and zero-match calls — so chained edits never need a re-read. The write-safety harness's `cas-conflict` op now also drives the move and delete guards.
