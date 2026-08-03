---
"seekstone": minor
---

Recoverable deletes: `delete_note` now moves the note to the vault's `.trash/` folder (Obsidian-compatible, restore by moving it back) instead of permanently removing it; name collisions get a timestamp suffix, and the tool result says where the note went. Pass `permanent: true` for the old unlink behavior. Also fixes a gap where a deleted note's outgoing links stayed registered in the backlink index.
