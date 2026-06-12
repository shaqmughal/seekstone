---
"seekstone": patch
---

Bound `replace_in_note`'s `find` parameter to 1000 chars at the schema boundary, capping the size of any caller-supplied pattern in `regex: true` mode (ReDoS / self-DoS guard). Also converts an internal `new RegExp(constant.source)` in the link extractor to a direct regex literal — behavior-neutral, removes a per-line allocation, and clears a Codacy non-literal-RegExp false positive.
