---
"seekstone": patch
---

Two writes to the same note at the same time no longer make each other fail. Each write now uses its own hidden temp file (`.<note>.<id>.seekstone-tmp`), and a failed write only removes the temp file it created. Notes with very long names can be written again.
