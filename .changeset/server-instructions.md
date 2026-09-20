---
"seekstone": minor
---

Add `SEEKSTONE_INSTRUCTIONS`: point it at a file and its contents become the MCP server's `instructions` string, surfaced to clients alongside the tool list. A relative path resolves against the vault root; the file is read once at boot, trimmed, and capped at 16 KB (truncated with a warning past that). Unset, missing/unreadable, or empty after trim all mean the server starts without instructions, exactly as before.
