---
"seekstone": patch
---

`get_links` now resolves embeds of attachments that exist in the vault, such as `![[diagram.png]]`, instead of reporting them as unresolved. It is also faster on large vaults: on a 10k-note vault, a note with 30 links returns about 30 times faster.
