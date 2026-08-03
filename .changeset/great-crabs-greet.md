---
"seekstone": patch
---

`seekstone init` now errors on an unknown `--client` value instead of silently configuring Claude Desktop — agents running the one-prompt install get a clear failure they can relay. Docs gain a copy-pasteable agent install prompt (README + llms.txt), and llms.txt catches up to the 17-tool surface (adds `query_notes`).
