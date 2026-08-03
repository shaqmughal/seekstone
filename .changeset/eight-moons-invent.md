---
"seekstone": minor
---

Guarded writes: `read_note` (and every mutating tool) now returns a `contentHash` (sha-256 of the note's disk bytes), and the edit tools — `append_note`, `patch_note`, `patch_frontmatter`, `replace_in_note`, `append_periodic_note`, plus `create_note` with `overwrite: true` — accept an optional `prevHash` for compare-and-swap: if the note changed since it was read, the write fails with a structured `hash_conflict` error carrying the current hash instead of silently discarding the concurrent edit. Returned hashes chain, so multi-step edits need no re-reads. All write paths now also go through one shared crash-safe temp-file+rename helper — previously only `patch_note` and `replace_in_note` wrote atomically.
