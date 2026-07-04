---
"seekstone": minor
---

`seekstone init --client vscode` — auto-detect your vault and print or (with `--write`) create/merge the workspace `.vscode/mcp.json` for GitHub Copilot in VS Code, handling VS Code's config quirks (`servers` key instead of `mcpServers`, explicit `"type": "stdio"`). Same additive merge + backup behavior as the other client writers. `init` now also resolves relative `--vault` paths to absolute before writing any client config, so the spawned server always finds the vault regardless of the client's working directory.
