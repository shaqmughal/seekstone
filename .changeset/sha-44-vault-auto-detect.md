---
"seekstone": minor
---

Auto-detect the Obsidian vault in `seekstone init`

When `--vault` is omitted and `SEEKSTONE_VAULT` is not set, `seekstone init`
now reads Obsidian's own vault registry (`obsidian.json`) to find known vaults
automatically. One vault → auto-selected and validated. Multiple vaults → lists
them numbered with a `--vault` re-run hint. Registry missing/malformed → falls
back to the existing "pass --vault" guidance.
