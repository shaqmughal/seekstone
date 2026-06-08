---
"seekstone": patch
---

Fix serverInfo.version in MCP handshake — was hardcoded to "0.1.0" instead of using the build-time version constant. MCP clients that surface server metadata now see the correct version.
