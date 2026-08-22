---
"seekstone": patch
---

The `search` tool's advertised schema now matches its behavior: the long-documented `excerptLength` option (20–2000 characters, default 120) is exposed in the MCP input schema so clients can actually discover and use it, and the tool description's excerpt-size figure is corrected from ~200 to ~120 characters. Search's `mode` now also appears in info-level logs' safe metadata. The `no-network` guarantee test additionally proves the semantic subsystem — index build, cache persistence, and semantic/hybrid queries — runs fully offline.
