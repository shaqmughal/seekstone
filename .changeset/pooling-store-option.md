---
'seekstone': patch
---

`SemanticStore` accepts a chunk-pooling strategy (default unchanged: `max`); the returned excerpt span is always the note's best chunk regardless of pooling. No behavior change for users — the SHA-313 dev-split eval found no pooling that improved retrieval without a matching loss, so the shipped ranking is untouched (writeup committed under the harness baseline reports).
