---
'seekstone': patch
---

`move_note` and `delete_note` now return the note's `contentHash`, so a client can chain a `prevHash` edit after a move.
