# Read-scope no-leak check

Scope: `SEEKSTONE_READ_PATHS=!Private/**`. Hidden note: `Private/Read Scope Sentinel.md`, with the sentinel `zzseekstonereadscopeqq` in its title, frontmatter, heading, body, tag and task.

Result: **PASS**. 34 calls across 25 served tools; 0 leak(s); 0 unprobed tool(s); hidden note intact.

| Tool | Calls | Errors | Response bytes |
| --- | ---: | ---: | ---: |
| `append_note` | 1 | 1 | 107 |
| `append_periodic_note` | 1 | 0 | 113 |
| `context_pack` | 1 | 0 | 83 |
| `create_note` | 1 | 1 | 107 |
| `delete_note` | 1 | 1 | 107 |
| `get_backlinks` | 2 | 0 | 342 |
| `get_links` | 1 | 1 | 53 |
| `get_periodic_note` | 1 | 0 | 69 |
| `list_notes` | 2 | 0 | 14012 |
| `list_tags` | 1 | 0 | 19838 |
| `list_tasks` | 2 | 0 | 10931 |
| `list_writes` | 1 | 0 | 32 |
| `move_note` | 1 | 1 | 107 |
| `outline_note` | 1 | 1 | 160 |
| `patch_frontmatter` | 1 | 1 | 107 |
| `patch_note` | 1 | 1 | 107 |
| `query_notes` | 3 | 2 | 3536 |
| `read_note` | 1 | 1 | 160 |
| `read_notes` | 1 | 0 | 1786 |
| `rename_heading` | 1 | 1 | 107 |
| `replace_in_note` | 1 | 1 | 107 |
| `resolve_note` | 2 | 0 | 143 |
| `search` | 3 | 0 | 4531 |
| `undo_write` | 2 | 1 | 534 |
| `update_task` | 1 | 1 | 107 |
