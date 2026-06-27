---
"seekstone": minor
---

feat(search): slim the search payload below mcpvault, add a tunable excerpt length

`search` results are now leaner with no loss of usable information: the response
is minified, `score` is rounded to 2 decimals, and `title`/`tags` are omitted
when redundant (title equals the path basename) or empty — both remain optional
on each hit. A new `excerptLength` parameter (default 120, min 20 / max 2000)
lets callers trade match context for an even smaller payload.

On the committed 10k-note fixture this drops the mean search payload to ~2 KB,
making seekstone the smallest payload of every benchmarked Obsidian MCP server
(below mcpvault at every vault size) while staying the fastest on latency.
