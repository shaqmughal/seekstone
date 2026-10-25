---
"seekstone": patch
---

The Claude Desktop bundle (`.mcpb`) now uses zod 4.6.7 inside the MCP SDK instead of zod 3.25.76, fixing zod's memory-exhaustion advisory (affects versions below 4.6.6) for bundle users. The npm package was not affected.
