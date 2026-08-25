---
"seekstone": patch
---

Fix Windows breaking basename wikilink resolution, backlinks, and path lookups for notes in subdirectories (#268). The vault scan stored platform-native `path.relative()` output as the index key, so on Windows a nested note was keyed `Projects\Core.md` while wikilink resolution, the file watcher, and MCP client paths all assume forward slashes — `[[Core]]` never resolved, `get_backlinks` returned zero, and every path-keyed tool lookup missed. Index keys are now forward-slash vault-relative paths on every platform.
