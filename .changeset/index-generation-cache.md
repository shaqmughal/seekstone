---
'seekstone': patch
---

Repeat calls to `list_tags`, `vault_stats` and `get_links` are faster when the vault hasn't changed. The server keeps a counter that goes up on every index change, and these tools reuse their last whole-vault pass until it moves. On the 10k-note test vault, a repeat `list_tags` call takes about 3 µs instead of 1.4 ms, and `get_links` on a 30-link note about 0.08 ms instead of 3.7 ms.
