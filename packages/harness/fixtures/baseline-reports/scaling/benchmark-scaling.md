# Benchmark — scaling across vault sizes

> darwin/arm64 · Node v25.9.0 · vault sizes: 1k / 5k / 10k notes

How each adapter behaves as the vault grows. **Lower and flatter is better** — a filesystem-direct, indexed server should barely move; a REST-proxy or full-scan server climbs with vault size.

## Search latency — warm, mean across queries (ms)

| Adapter | 1k | 5k | 10k | scaling 1k→10k |
| --- | ---: | ---: | ---: | ---: |
| **seekstone** | 1.0 | 2.7 | 5.2 | 5.4× |
| **fs** | 1.1 | 2.7 | 5.5 | 4.9× |
| **mcpvault** | 89.0 | 435.5 | 897.1 | 10.1× |
| **obsidian-mcp-pro** | 46.2 | 213.4 | 430.2 | 9.3× |
| **obsidian-mcp** | 81.6 | 404.8 | 811.1 | 9.9× |
| **obsidian-mcp-rs** | 5.8 | 17.9 | 35.2 | 6.1× |
| **obsidian-tc** | 262.8 | 1253.4 | 2666.5 | 10.1× |
| **rest** | 59.8 | 275.9 | 574.8 | 9.6× |
| **obsidian-mcp-server** | 81.8 | 355.8 | 731.8 | 8.9× |
| **mcp-obsidian** | 163.6 | 740.0 | 1550.4 | 9.5× |

## Search payload — mean across queries (context tax)

| Adapter | 1k | 5k | 10k | scaling 1k→10k |
| --- | ---: | ---: | ---: | ---: |
| **seekstone** | 1.6 KB | 1.8 KB | 2.0 KB | 1.3× |
| **fs** | 2.1 KB | 2.3 KB | 2.7 KB | 1.3× |
| **mcpvault** | 1.7 KB | 1.9 KB | 2.2 KB | 1.3× |
| **obsidian-mcp-pro** | 25.0 KB | 84.3 KB | 114.3 KB | 4.6× |
| **obsidian-mcp** | 18.1 KB | 104.8 KB | 201.3 KB | 11.1× |
| **obsidian-mcp-rs** | 5.4 KB | 5.8 KB | 6.2 KB | 1.1× |
| **obsidian-tc** | 4.6 KB | 6.8 KB | 7.2 KB | 1.6× |
| **rest** | 6.47 MB | 29.87 MB | 62.58 MB | 9.7× |
| **obsidian-mcp-server** | 55.3 KB | 47.1 KB | 46.6 KB | 0.8× |
| **mcp-obsidian** | 9.78 MB | 45.13 MB | 94.55 MB | 9.7× |

## Large-note read payload

| Adapter | 1k | 5k | 10k | scaling 1k→10k |
| --- | ---: | ---: | ---: | ---: |
| **seekstone** | 389.5 KB | 783.9 KB | 786.3 KB | 2.0× |
| **fs** | 389.5 KB | 783.9 KB | 786.3 KB | 2.0× |
| **mcpvault** | 396.2 KB | 796.8 KB | 799.3 KB | 2.0× |
| **obsidian-mcp-pro** | 389.3 KB | 781.9 KB | 781.9 KB | 2.0× |
| **obsidian-mcp** | 389.2 KB | 781.7 KB | 781.7 KB | 2.0× |
| **obsidian-mcp-rs** | 391.4 KB | 788.0 KB | 790.4 KB | 2.0× |
| **obsidian-tc** | 792.7 KB | 1.56 MB | 1.56 MB | 2.0× |
| **rest** | 389.1 KB | 781.6 KB | 781.6 KB | 2.0× |
| **obsidian-mcp-server** | 389.1 KB | 781.7 KB | 781.7 KB | 2.0× |
| **mcp-obsidian** | 395.7 KB | 796.6 KB | 796.6 KB | 2.0× |

## Search latency vs seekstone at 10k notes

| Adapter | warm search (ms) | × seekstone |
| --- | ---: | ---: |
| **seekstone** | 5.2 | 1× |
| **fs** | 5.5 | 1× |
| **mcpvault** | 897.1 | 173× |
| **obsidian-mcp-pro** | 430.2 | 83× |
| **obsidian-mcp** | 811.1 | 156× |
| **obsidian-mcp-rs** | 35.2 | 7× |
| **obsidian-tc** | 2666.5 | 514× |
| **rest** | 574.8 | 111× |
| **obsidian-mcp-server** | 731.8 | 141× |
| **mcp-obsidian** | 1550.4 | 299× |

