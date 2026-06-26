# Benchmark — scaling across vault sizes

> darwin/arm64 · Node v25.9.0 · vault sizes: 1k / 5k / 10k notes

How each adapter behaves as the vault grows. **Lower and flatter is better** — a filesystem-direct, indexed server should barely move; a REST-proxy or full-scan server climbs with vault size.

## Search latency — warm, mean across queries (ms)

| Adapter | 1k | 5k | 10k | scaling 1k→10k |
| --- | ---: | ---: | ---: | ---: |
| **seekstone** | 1.1 | 3.2 | 7.5 | 6.6× |
| **fs** | 1.3 | 3.3 | 8.2 | 6.1× |
| **mcpvault** | 99.3 | 466.1 | 971.3 | 9.8× |

## Search payload — mean across queries (context tax)

| Adapter | 1k | 5k | 10k | scaling 1k→10k |
| --- | ---: | ---: | ---: | ---: |
| **seekstone** | 2.3 KB | 2.6 KB | 3.0 KB | 1.3× |
| **fs** | 2.1 KB | 2.3 KB | 2.7 KB | 1.3× |
| **mcpvault** | 1.7 KB | 1.9 KB | 2.2 KB | 1.3× |

## Large-note read payload

| Adapter | 1k | 5k | 10k | scaling 1k→10k |
| --- | ---: | ---: | ---: | ---: |
| **seekstone** | 389.1 KB | 781.6 KB | 781.6 KB | 2.0× |
| **fs** | 389.1 KB | 781.6 KB | 781.6 KB | 2.0× |
| **mcpvault** | 395.8 KB | 794.6 KB | 794.6 KB | 2.0× |

## Search latency vs seekstone at 10k notes

| Adapter | warm search (ms) | × seekstone |
| --- | ---: | ---: |
| **seekstone** | 7.5 | 1× |
| **fs** | 8.2 | 1× |
| **mcpvault** | 971.3 | 130× |

## Not yet captured

- **obsidian-mcp-pro** — filesystem-direct; pending adapter read-path fix
- **obsidian-mcp** — filesystem-direct; slow synchronous init at scale (raise `SEEKSTONE_MCP_INIT_TIMEOUT`)
- **rest** — requires Obsidian running + Local REST API plugin — captured manually
- **obsidian-mcp-server** — requires Obsidian running + Local REST API plugin — captured manually
- **mcp-obsidian** — requires Obsidian running + Local REST API plugin — captured manually

See the harness README for the manual REST-capture procedure.

