---
"seekstone": patch
---

`context_pack`, `rename_heading` and `resolve_note` are faster on large vaults: they reuse the link lookup maps until the index changes instead of rebuilding them for every link.
