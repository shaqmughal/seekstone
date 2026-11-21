---
"seekstone": patch
---

Note writes are synced to disk before they replace the old file, so a power loss right after a write can't leave an empty or partial note.
