---
"seekstone": patch
---

Write history is safer when several clients share a vault. A server that pauses mid-write now keeps its history lock; before, another server took it after 30 seconds. Two servers recovering a crashed server's lock can no longer both take it. A short disk write can no longer leave a half-written history entry. `undo_write` returns `entry_evicted`, not a raw file error, when another server evicted the pre-image. Two servers storing the same history blob at once no longer break each other's temp file.
