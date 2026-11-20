---
"seekstone": minor
---

Semantic search now holds the embedding table as int8 with one scale per row, using about a quarter of the memory (~7.5 MB instead of ~30 MB for `potion-base-8M`). Set `SEEKSTONE_SEMANTIC_WEIGHTS=f32` to keep the old float32 table. The first boot after upgrading re-embeds the vault once, because the cache is keyed on the table format.
