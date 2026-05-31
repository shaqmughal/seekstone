---
"seekstone": minor
---

Add CLI conveniences for setup and inspection:

- `seekstone init` — validate an Obsidian vault and print the Claude config to paste, or patch the Claude Desktop config in place with `--write` (creates a timestamped backup and never touches your other MCP servers). Supports `--vault`, `--client desktop|code`.
- `seekstone --version` and `seekstone --help`.
