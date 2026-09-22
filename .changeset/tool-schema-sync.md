---
"seekstone": patch
---

Served tool schemas now match what the server validates. `query_notes` predicates' `value` is advertised as `string | number | boolean` (it had no type, so clients could not tell numbers and booleans are accepted), and `patch_note`'s `target` is advertised as the exact `{ heading }` | `{ block }` union instead of a bare object with the shape only in prose. A new test derives every tool's JSON schema from its zod schema and compares it structurally against the served copy, so the two can no longer drift.
