---
"seekstone": patch
---

Writes on Windows no longer fail with `EPERM` or `EBUSY` when another program, such as antivirus, a sync client or Obsidian, briefly has the note open. The final rename now retries for up to about a second before giving up. A write that fails anyway no longer leaves a `.seekstone-tmp` file in the vault.
