---
"seekstone": patch
---

Write history stays correct when more than one client uses the same vault: seq numbers no longer collide, `list_writes` and `undo_write` see the other client's writes, and eviction keeps its rows.
