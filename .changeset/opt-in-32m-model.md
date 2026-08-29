---
'seekstone': minor
---

Opt-in bigger embedding model for semantic search. `npx -y seekstone fetch-model --model potion-retrieval-32M` downloads the 512-dim potion-retrieval-32M model (~129 MB, SHA-256-verified like the default), and `SEEKSTONE_SEMANTIC_MODEL=potion-retrieval-32M` selects it at boot. On the committed 10k-note benchmark it lifts description-style queries noticeably over the shipped potion-base-8M at roughly 2× the (still tens-of-milliseconds) query latency. The default stays potion-base-8M; per-vault embedding caches are keyed on model id + dimension, so switching models re-embeds cleanly and switching back reuses the existing cache. An unknown model id is a clear boot/fetch error; a selected-but-not-fetched model gets the existing actionable error naming the exact fetch command.
