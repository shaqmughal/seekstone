---
"seekstone": minor
---

One-click semantic search (SHA-309): every release now ships a second MCP Bundle, `seekstone-semantic.mcpb`, with the local embedding model packed inside the extension and semantic search enabled out of the box — no terminal, no Node.js, and nothing downloaded at runtime. The model ships as sub-cap shards (Claude Desktop rejects any packed file over ~108KB) that the server reassembles into the standard cache location at boot, verified against the same pinned SHA-256 hashes `fetch-model` uses; the zero-network guarantee is unchanged and now also covers the reassembly path in `no-network.test.ts`.
