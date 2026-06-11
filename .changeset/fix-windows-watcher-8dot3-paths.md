---
"seekstone": patch
---

Fix watcher silently dropping all events on Windows when the vault path contains 8.3 short names (e.g. `RUNNER~1`). chokidar's `followSymlinks: true` expands short paths to long form via `realpath()`, causing `relative()` to produce `..` segments that the dot-directory filter incorrectly matched. Now resolves the vault root via `realpathSync` at startup so path comparisons are consistent.
