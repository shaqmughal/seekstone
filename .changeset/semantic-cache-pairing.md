---
"seekstone": patch
---

fix(semantic): pair the embedding cache's manifest with the binary it describes, so a manifest left beside another build's binary is rejected instead of mapping every note to another note's vectors. Existing caches are invalidated once by the version bump and re-embedded on next boot.
