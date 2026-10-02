---
"seekstone": patch
---

Tag filters on `search`, `context_pack`, `query_notes`, and `list_notes` now match the way Obsidian does: case-insensitively, and a parent tag matches its nested children (`project` matches `#Project/alpha`). A tag that no note has now returns an `unknown_tag` error listing the closest existing tags, instead of an empty result. Typo tolerance in keyword search is now documented and pinned by tests.
