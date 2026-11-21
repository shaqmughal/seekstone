# Schema tax — seekstone

What a client can load into context when a session starts, before any tool is called: the name, description and input schema of every tool the server offers, its instructions string if it sends one, and any prompts and resources it advertises.

| Mode | Tools | Tool list | Tokens (approx) | Instructions | Prompts | Resources |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Read-write (default) | 26 | 25.8 KB | 5,821 | none | none | none |
| Read-only (`SEEKSTONE_READ_ONLY=1`) | 15 | 14.7 KB | 3,340 | none | none | none |

## Per tool — Read-write (default)

Most expensive first.

| Tool | Bytes | Tokens (approx) | Share |
| --- | ---: | ---: | ---: |
| `query_notes` | 2,155 | 480 | 8.2% |
| `read_notes` | 1,797 | 417 | 7.1% |
| `context_pack` | 1,666 | 357 | 6.1% |
| `patch_note` | 1,586 | 345 | 5.9% |
| `list_tasks` | 1,356 | 324 | 5.5% |
| `replace_in_note` | 1,347 | 290 | 5.0% |
| `read_note` | 1,223 | 273 | 4.7% |
| `update_task` | 1,187 | 267 | 4.6% |
| `search` | 1,185 | 265 | 4.5% |
| `rename_heading` | 1,118 | 246 | 4.2% |
| `move_note` | 1,118 | 233 | 4.0% |
| `append_periodic_note` | 1,031 | 228 | 3.9% |
| `create_note` | 973 | 213 | 3.6% |
| `undo_write` | 872 | 198 | 3.4% |
| `get_periodic_note` | 878 | 193 | 3.3% |
| `resolve_note` | 880 | 191 | 3.3% |
| `delete_note` | 767 | 171 | 2.9% |
| `patch_frontmatter` | 720 | 159 | 2.7% |
| `list_tags` | 674 | 149 | 2.5% |
| `get_backlinks` | 680 | 148 | 2.5% |
| `outline_note` | 732 | 145 | 2.5% |
| `append_note` | 644 | 142 | 2.4% |
| `list_writes` | 580 | 126 | 2.2% |
| `list_notes` | 510 | 113 | 1.9% |
| `get_links` | 420 | 91 | 1.6% |
| `vault_stats` | 338 | 80 | 1.4% |

## Per tool — Read-only (`SEEKSTONE_READ_ONLY=1`)

Most expensive first.

| Tool | Bytes | Tokens (approx) | Share |
| --- | ---: | ---: | ---: |
| `query_notes` | 2,155 | 480 | 14.3% |
| `read_notes` | 1,797 | 417 | 12.4% |
| `context_pack` | 1,666 | 357 | 10.7% |
| `list_tasks` | 1,356 | 324 | 9.7% |
| `read_note` | 1,223 | 273 | 8.1% |
| `search` | 1,185 | 265 | 7.9% |
| `get_periodic_note` | 878 | 193 | 5.8% |
| `resolve_note` | 880 | 191 | 5.7% |
| `list_tags` | 674 | 149 | 4.4% |
| `get_backlinks` | 680 | 148 | 4.4% |
| `outline_note` | 732 | 145 | 4.3% |
| `list_writes` | 580 | 126 | 3.8% |
| `list_notes` | 510 | 113 | 3.4% |
| `get_links` | 420 | 91 | 2.7% |
| `vault_stats` | 338 | 80 | 2.4% |

> **Method.** Tool list as served over MCP stdio (tools/list, all pages), each tool compact-JSON serialized; totalBytes/totalTokens cover the whole tools array, perTool covers each tool on its own (per-tool tokens do not sum exactly to the total). prompts/list, resources/list and resources/templates/list are measured the same way when the server advertises them. Tokens: tiktoken cl100k_base.
> Clients reformat these definitions before passing them to a model, and some (Claude Code with tool search, for one) load only tool names until a tool is needed, so treat these counts as an upper bound that varies by client and model. Comparisons between servers measured the same way still hold.
