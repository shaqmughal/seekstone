# Schema tax — seekstone

What a client loads into context when a session starts, before any tool is called: the name, description and input schema of every tool the server offers, plus its instructions string if it sends one.

| Mode | Tools | Tool list | Tokens (approx) | Instructions |
| --- | ---: | ---: | ---: | ---: |
| Read-write (default) | 25 | 25.5 KB | 5,742 | none |
| Read-only (`SEEKSTONE_READ_ONLY=1`) | 14 | 14.4 KB | 3,261 | none |

## Per tool — Read-write (default)

Most expensive first.

| Tool | Bytes | Tokens (approx) | Share |
| --- | ---: | ---: | ---: |
| `query_notes` | 2,155 | 480 | 8.3% |
| `read_notes` | 1,797 | 417 | 7.2% |
| `context_pack` | 1,666 | 357 | 6.2% |
| `patch_note` | 1,586 | 345 | 6.0% |
| `list_tasks` | 1,356 | 324 | 5.6% |
| `replace_in_note` | 1,347 | 290 | 5.0% |
| `read_note` | 1,223 | 273 | 4.7% |
| `update_task` | 1,187 | 267 | 4.6% |
| `search` | 1,185 | 265 | 4.6% |
| `rename_heading` | 1,118 | 246 | 4.3% |
| `move_note` | 1,118 | 233 | 4.0% |
| `append_periodic_note` | 1,031 | 228 | 4.0% |
| `create_note` | 973 | 213 | 3.7% |
| `undo_write` | 872 | 198 | 3.4% |
| `get_periodic_note` | 878 | 193 | 3.3% |
| `resolve_note` | 880 | 191 | 3.3% |
| `delete_note` | 767 | 171 | 3.0% |
| `patch_frontmatter` | 720 | 159 | 2.8% |
| `list_tags` | 674 | 149 | 2.6% |
| `get_backlinks` | 680 | 148 | 2.6% |
| `outline_note` | 732 | 145 | 2.5% |
| `append_note` | 644 | 142 | 2.5% |
| `list_writes` | 580 | 126 | 2.2% |
| `list_notes` | 510 | 113 | 2.0% |
| `get_links` | 420 | 91 | 1.6% |

## Per tool — Read-only (`SEEKSTONE_READ_ONLY=1`)

Most expensive first.

| Tool | Bytes | Tokens (approx) | Share |
| --- | ---: | ---: | ---: |
| `query_notes` | 2,155 | 480 | 14.7% |
| `read_notes` | 1,797 | 417 | 12.7% |
| `context_pack` | 1,666 | 357 | 10.9% |
| `list_tasks` | 1,356 | 324 | 9.9% |
| `read_note` | 1,223 | 273 | 8.3% |
| `search` | 1,185 | 265 | 8.1% |
| `get_periodic_note` | 878 | 193 | 5.9% |
| `resolve_note` | 880 | 191 | 5.8% |
| `list_tags` | 674 | 149 | 4.6% |
| `get_backlinks` | 680 | 148 | 4.5% |
| `outline_note` | 732 | 145 | 4.4% |
| `list_writes` | 580 | 126 | 3.9% |
| `list_notes` | 510 | 113 | 3.5% |
| `get_links` | 420 | 91 | 2.8% |

> **Method.** Tool list as served over MCP stdio (tools/list, all pages), each tool compact-JSON serialized; totalBytes/totalTokens cover the whole tools array, perTool covers each tool on its own (per-tool tokens do not sum exactly to the total). Tokens: tiktoken cl100k_base.
> Clients reformat tool definitions before passing them to a model, so absolute counts vary by client and model. Comparisons between servers measured the same way still hold.
