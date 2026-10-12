# Benchmark — scaling across vault sizes

> darwin/arm64 · Node v25.9.0 · vault sizes: 1k / 5k / 10k notes

How each adapter behaves as the vault grows. **Lower and flatter is better** — a filesystem-direct, indexed server should barely move; a REST-proxy or full-scan server climbs with vault size.

## Search latency — warm, mean across queries (ms)

| Adapter | 1k | 5k | 10k | scaling 1k→10k |
| --- | ---: | ---: | ---: | ---: |
| **seekstone** | 1.0 | 2.8 | 5.6 | 5.5× |
| **fs** | 1.2 | 3.0 | 5.7 | 4.7× |
| **mcpvault** | 89.7 | 431.3 | 892.5 | 9.9× |
| **obsidian-mcp-pro** | 41.0 | 199.5 | 407.1 | 9.9× |
| **obsidian-mcp** | 78.1 | 379.8 | 771.7 | 9.9× |
| **obsidian-mcp-rs** | 6.0 | 18.7 | 35.7 | 6.0× |
| **obsidian-tc** | 273.4 | 1380.1 | 2848.5 | 10.4× |
| **rest** | 59.8 | 275.9 | 574.8 | 9.6× |
| **obsidian-mcp-server** | 81.8 | 355.8 | 731.8 | 8.9× |
| **mcp-obsidian** | 163.6 | 740.0 | 1550.4 | 9.5× |

## Search payload — mean across queries (context tax)

| Adapter | 1k | 5k | 10k | scaling 1k→10k |
| --- | ---: | ---: | ---: | ---: |
| **seekstone** | 1.6 KB | 1.8 KB | 2.0 KB | 1.3× |
| **fs** | 2.1 KB | 2.3 KB | 2.7 KB | 1.3× |
| **mcpvault** | 1.7 KB | 1.9 KB | 2.2 KB | 1.3× |
| **obsidian-mcp-pro** | 25.0 KB | 84.4 KB | 114.5 KB | 4.6× |
| **obsidian-mcp** | 18.2 KB | 105.2 KB | 203.0 KB | 11.2× |
| **obsidian-mcp-rs** | 5.4 KB | 5.8 KB | 6.2 KB | 1.1× |
| **obsidian-tc** | 4.6 KB | 6.8 KB | 7.3 KB | 1.6× |
| **rest** | 6.47 MB | 29.87 MB | 62.58 MB | 9.7× |
| **obsidian-mcp-server** | 55.3 KB | 47.1 KB | 46.6 KB | 0.8× |
| **mcp-obsidian** | 9.78 MB | 45.13 MB | 94.55 MB | 9.7× |

## Large-note read payload

| Adapter | 1k | 5k | 10k | scaling 1k→10k |
| --- | ---: | ---: | ---: | ---: |
| **seekstone** | 389.5 KB | 783.9 KB | 786.3 KB | 2.0× |
| **fs** | 389.5 KB | 783.9 KB | 786.3 KB | 2.0× |
| **mcpvault** | 396.2 KB | 796.8 KB | 799.3 KB | 2.0× |
| **obsidian-mcp-pro** | 389.8 KB | 784.2 KB | 786.6 KB | 2.0× |
| **obsidian-mcp** | 389.7 KB | 784.0 KB | 786.4 KB | 2.0× |
| **obsidian-mcp-rs** | 391.4 KB | 788.0 KB | 790.4 KB | 2.0× |
| **obsidian-tc** | 792.7 KB | 1.56 MB | 1.56 MB | 2.0× |
| **rest** | 389.1 KB | 781.6 KB | 781.6 KB | 2.0× |
| **obsidian-mcp-server** | 389.1 KB | 781.7 KB | 781.7 KB | 2.0× |
| **mcp-obsidian** | 395.7 KB | 796.6 KB | 796.6 KB | 2.0× |

## Search latency vs seekstone at 10k notes

| Adapter | warm search (ms) | × seekstone |
| --- | ---: | ---: |
| **seekstone** | 5.6 | 1× |
| **fs** | 5.7 | 1× |
| **mcpvault** | 892.5 | 159× |
| **obsidian-mcp-pro** | 407.1 | 73× |
| **obsidian-mcp** | 771.7 | 138× |
| **obsidian-mcp-rs** | 35.7 | 6× |
| **obsidian-tc** | 2848.5 | 508× |
| **rest** | 574.8 | 103× |
| **obsidian-mcp-server** | 731.8 | 131× |
| **mcp-obsidian** | 1550.4 | 277× |

