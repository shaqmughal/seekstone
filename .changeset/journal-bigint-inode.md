---
"seekstone": patch
---

On Windows, a server that shares a vault's write history with another server process now sees that process's writes in `list_writes` after it compacts the history file, instead of showing a stale list.
