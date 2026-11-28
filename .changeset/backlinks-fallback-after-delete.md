---
"seekstone": patch
---

When two notes share a name and one is deleted, `get_backlinks` on the other now lists the notes whose links fall back to it, instead of missing them until the server restarts.
