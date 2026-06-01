---
"seekstone": minor
---

Ship Seekstone as a one-click MCP Bundle (MCPB)

Adds a `seekstone.mcpb` build artifact that lets non-developers install
Seekstone in Claude Desktop with a double-click and a vault directory picker —
no terminal, no JSON editing required. The bundle packages `dist/index.js` and
`manifest.json` into a 15 KB zip. CI attaches it to every GitHub Release.

The `npx -y seekstone` path is unchanged.
