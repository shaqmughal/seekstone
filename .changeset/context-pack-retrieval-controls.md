---
"seekstone": minor
---

`context_pack` accepts `mode`, `folder` and `tag`. It called the lexical index directly, so it could neither search by meaning nor be scoped to a folder or tag — the two controls `search` has had since 0.17.0. Both tools now route through one retrieval path, so a mode or filter added to either is available to both, and `totalMatches` reports matches before filtering, which distinguishes an empty pack caused by a filter from one caused by an absent subject.
