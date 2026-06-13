---
"seekstone": patch
---

Add a process-level `unhandledRejection` guard to the server entrypoint. A stray unhandled promise rejection now logs to stderr and the long-lived stdio session stays up (preserving the in-memory index) instead of crashing the user's MCP session. `uncaughtException` is intentionally left to Node's default crash behaviour.
