# Retrieval-quality eval (SHA-257 spike)

- **Snapshot:** 2026-08-29T17:13:26.787Z
- **Machine:** darwin/arm64, node v25.9.0, 16 cpus
- **Vault:** packages/harness/fixtures/vault (10000 notes)
- **Query set:** 150 queries (90 semantic, 30 lexical, 30 topical), 5 latency runs/query
- **Splits:** dev 90 (54/18/18), holdout 60 (36/12/12) — tuning reads dev only; gate v2 reports on holdout
- **Lexical index build:** 43866.00 ms
- **potion-base-8M:** dim 256, 45964 chunks, index build 24350.91 ms, model load 18.02 ms

## Retrieval quality

| Condition | Subset | hit@5 | MRR@10 | n |
| --- | --- | ---: | ---: | ---: |
| lexical | overall | 34.7% | 0.282 | 150 |
| lexical | semantic | 17.8% | 0.100 | 90 |
| lexical | lexical | 100.0% | 0.983 | 30 |
| lexical | topical | 20.0% | 0.125 | 30 |
| semantic:potion-base-8M | overall | 74.0% | 0.539 | 150 |
| semantic:potion-base-8M | semantic | 74.4% | 0.558 | 90 |
| semantic:potion-base-8M | lexical | 90.0% | 0.748 | 30 |
| semantic:potion-base-8M | topical | 56.7% | 0.274 | 30 |
| hybrid-rrf:potion-base-8M | overall | 52.0% | 0.391 | 150 |
| hybrid-rrf:potion-base-8M | semantic | 43.3% | 0.270 | 90 |
| hybrid-rrf:potion-base-8M | lexical | 100.0% | 0.983 | 30 |
| hybrid-rrf:potion-base-8M | topical | 30.0% | 0.162 | 30 |
| semantic-top2:potion-base-8M | overall | 72.7% | 0.505 | 150 |
| semantic-top2:potion-base-8M | semantic | 66.7% | 0.458 | 90 |
| semantic-top2:potion-base-8M | lexical | 100.0% | 0.844 | 30 |
| semantic-top2:potion-base-8M | topical | 63.3% | 0.309 | 30 |
| hybrid-route:potion-base-8M | overall | 76.0% | 0.586 | 150 |
| hybrid-route:potion-base-8M | semantic | 74.4% | 0.558 | 90 |
| hybrid-route:potion-base-8M | lexical | 100.0% | 0.983 | 30 |
| hybrid-route:potion-base-8M | topical | 56.7% | 0.274 | 30 |
| hybrid-route-top2:potion-base-8M | overall | 72.7% | 0.533 | 150 |
| hybrid-route-top2:potion-base-8M | semantic | 66.7% | 0.458 | 90 |
| hybrid-route-top2:potion-base-8M | lexical | 100.0% | 0.983 | 30 |
| hybrid-route-top2:potion-base-8M | topical | 63.3% | 0.309 | 30 |
| hybrid-wsum70:potion-base-8M | overall | 72.7% | 0.542 | 150 |
| hybrid-wsum70:potion-base-8M | semantic | 67.8% | 0.528 | 90 |
| hybrid-wsum70:potion-base-8M | lexical | 100.0% | 0.900 | 30 |
| hybrid-wsum70:potion-base-8M | topical | 60.0% | 0.225 | 30 |
| hybrid-wsum85:potion-base-8M | overall | 74.7% | 0.537 | 150 |
| hybrid-wsum85:potion-base-8M | semantic | 72.2% | 0.543 | 90 |
| hybrid-wsum85:potion-base-8M | lexical | 96.7% | 0.819 | 30 |
| hybrid-wsum85:potion-base-8M | topical | 60.0% | 0.234 | 30 |
| shipped-semantic:potion-base-8M | overall | 74.0% | 0.539 | 150 |
| shipped-semantic:potion-base-8M | semantic | 74.4% | 0.558 | 90 |
| shipped-semantic:potion-base-8M | lexical | 90.0% | 0.748 | 30 |
| shipped-semantic:potion-base-8M | topical | 56.7% | 0.274 | 30 |
| shipped-hybrid:potion-base-8M | overall | 76.0% | 0.586 | 150 |
| shipped-hybrid:potion-base-8M | semantic | 74.4% | 0.558 | 90 |
| shipped-hybrid:potion-base-8M | lexical | 100.0% | 0.983 | 30 |
| shipped-hybrid:potion-base-8M | topical | 56.7% | 0.274 | 30 |
| competitor:obsidian-tc | overall | 89.3% | 0.752 | 150 |
| competitor:obsidian-tc | semantic | 94.4% | 0.800 | 90 |
| competitor:obsidian-tc | lexical | 100.0% | 0.950 | 30 |
| competitor:obsidian-tc | topical | 63.3% | 0.408 | 30 |
| competitor:obsidian-tc-graph | overall | 92.0% | 0.802 | 150 |
| competitor:obsidian-tc-graph | semantic | 97.8% | 0.869 | 90 |
| competitor:obsidian-tc-graph | lexical | 100.0% | 0.983 | 30 |
| competitor:obsidian-tc-graph | topical | 66.7% | 0.423 | 30 |

## Retrieval quality by split (SHA-312)

Dev is the tuning split; holdout is the reporting split for gate v2.

| Condition | Split | Subset | hit@5 | MRR@10 | n |
| --- | --- | --- | ---: | ---: | ---: |
| lexical | dev | overall | 37.8% | 0.282 | 90 |
| lexical | dev | semantic | 24.1% | 0.122 | 54 |
| lexical | dev | lexical | 100.0% | 0.972 | 18 |
| lexical | dev | topical | 16.7% | 0.075 | 18 |
| lexical | holdout | overall | 30.0% | 0.281 | 60 |
| lexical | holdout | semantic | 8.3% | 0.068 | 36 |
| lexical | holdout | lexical | 100.0% | 1.000 | 12 |
| lexical | holdout | topical | 25.0% | 0.201 | 12 |
| semantic:potion-base-8M | dev | overall | 68.9% | 0.531 | 90 |
| semantic:potion-base-8M | dev | semantic | 70.4% | 0.542 | 54 |
| semantic:potion-base-8M | dev | lexical | 83.3% | 0.727 | 18 |
| semantic:potion-base-8M | dev | topical | 50.0% | 0.305 | 18 |
| semantic:potion-base-8M | holdout | overall | 81.7% | 0.551 | 60 |
| semantic:potion-base-8M | holdout | semantic | 80.6% | 0.582 | 36 |
| semantic:potion-base-8M | holdout | lexical | 100.0% | 0.781 | 12 |
| semantic:potion-base-8M | holdout | topical | 66.7% | 0.227 | 12 |
| hybrid-rrf:potion-base-8M | dev | overall | 50.0% | 0.388 | 90 |
| hybrid-rrf:potion-base-8M | dev | semantic | 42.6% | 0.286 | 54 |
| hybrid-rrf:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-rrf:potion-base-8M | dev | topical | 22.2% | 0.110 | 18 |
| hybrid-rrf:potion-base-8M | holdout | overall | 55.0% | 0.396 | 60 |
| hybrid-rrf:potion-base-8M | holdout | semantic | 44.4% | 0.246 | 36 |
| hybrid-rrf:potion-base-8M | holdout | lexical | 100.0% | 1.000 | 12 |
| hybrid-rrf:potion-base-8M | holdout | topical | 41.7% | 0.240 | 12 |
| semantic-top2:potion-base-8M | dev | overall | 68.9% | 0.500 | 90 |
| semantic-top2:potion-base-8M | dev | semantic | 63.0% | 0.454 | 54 |
| semantic-top2:potion-base-8M | dev | lexical | 100.0% | 0.824 | 18 |
| semantic-top2:potion-base-8M | dev | topical | 55.6% | 0.314 | 18 |
| semantic-top2:potion-base-8M | holdout | overall | 78.3% | 0.514 | 60 |
| semantic-top2:potion-base-8M | holdout | semantic | 72.2% | 0.465 | 36 |
| semantic-top2:potion-base-8M | holdout | lexical | 100.0% | 0.875 | 12 |
| semantic-top2:potion-base-8M | holdout | topical | 75.0% | 0.300 | 12 |
| hybrid-route:potion-base-8M | dev | overall | 72.2% | 0.580 | 90 |
| hybrid-route:potion-base-8M | dev | semantic | 70.4% | 0.542 | 54 |
| hybrid-route:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route:potion-base-8M | dev | topical | 50.0% | 0.305 | 18 |
| hybrid-route:potion-base-8M | holdout | overall | 81.7% | 0.594 | 60 |
| hybrid-route:potion-base-8M | holdout | semantic | 80.6% | 0.582 | 36 |
| hybrid-route:potion-base-8M | holdout | lexical | 100.0% | 1.000 | 12 |
| hybrid-route:potion-base-8M | holdout | topical | 66.7% | 0.227 | 12 |
| hybrid-route-top2:potion-base-8M | dev | overall | 68.9% | 0.529 | 90 |
| hybrid-route-top2:potion-base-8M | dev | semantic | 63.0% | 0.454 | 54 |
| hybrid-route-top2:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-top2:potion-base-8M | dev | topical | 55.6% | 0.314 | 18 |
| hybrid-route-top2:potion-base-8M | holdout | overall | 78.3% | 0.539 | 60 |
| hybrid-route-top2:potion-base-8M | holdout | semantic | 72.2% | 0.465 | 36 |
| hybrid-route-top2:potion-base-8M | holdout | lexical | 100.0% | 1.000 | 12 |
| hybrid-route-top2:potion-base-8M | holdout | topical | 75.0% | 0.300 | 12 |
| hybrid-wsum70:potion-base-8M | dev | overall | 70.0% | 0.538 | 90 |
| hybrid-wsum70:potion-base-8M | dev | semantic | 64.8% | 0.528 | 54 |
| hybrid-wsum70:potion-base-8M | dev | lexical | 100.0% | 0.889 | 18 |
| hybrid-wsum70:potion-base-8M | dev | topical | 55.6% | 0.217 | 18 |
| hybrid-wsum70:potion-base-8M | holdout | overall | 76.7% | 0.548 | 60 |
| hybrid-wsum70:potion-base-8M | holdout | semantic | 72.2% | 0.528 | 36 |
| hybrid-wsum70:potion-base-8M | holdout | lexical | 100.0% | 0.917 | 12 |
| hybrid-wsum70:potion-base-8M | holdout | topical | 66.7% | 0.238 | 12 |
| hybrid-wsum85:potion-base-8M | dev | overall | 70.0% | 0.526 | 90 |
| hybrid-wsum85:potion-base-8M | dev | semantic | 68.5% | 0.536 | 54 |
| hybrid-wsum85:potion-base-8M | dev | lexical | 94.4% | 0.782 | 18 |
| hybrid-wsum85:potion-base-8M | dev | topical | 50.0% | 0.243 | 18 |
| hybrid-wsum85:potion-base-8M | holdout | overall | 81.7% | 0.552 | 60 |
| hybrid-wsum85:potion-base-8M | holdout | semantic | 77.8% | 0.555 | 36 |
| hybrid-wsum85:potion-base-8M | holdout | lexical | 100.0% | 0.875 | 12 |
| hybrid-wsum85:potion-base-8M | holdout | topical | 75.0% | 0.220 | 12 |
| shipped-semantic:potion-base-8M | dev | overall | 68.9% | 0.531 | 90 |
| shipped-semantic:potion-base-8M | dev | semantic | 70.4% | 0.542 | 54 |
| shipped-semantic:potion-base-8M | dev | lexical | 83.3% | 0.727 | 18 |
| shipped-semantic:potion-base-8M | dev | topical | 50.0% | 0.305 | 18 |
| shipped-semantic:potion-base-8M | holdout | overall | 81.7% | 0.551 | 60 |
| shipped-semantic:potion-base-8M | holdout | semantic | 80.6% | 0.582 | 36 |
| shipped-semantic:potion-base-8M | holdout | lexical | 100.0% | 0.781 | 12 |
| shipped-semantic:potion-base-8M | holdout | topical | 66.7% | 0.227 | 12 |
| shipped-hybrid:potion-base-8M | dev | overall | 72.2% | 0.580 | 90 |
| shipped-hybrid:potion-base-8M | dev | semantic | 70.4% | 0.542 | 54 |
| shipped-hybrid:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| shipped-hybrid:potion-base-8M | dev | topical | 50.0% | 0.305 | 18 |
| shipped-hybrid:potion-base-8M | holdout | overall | 81.7% | 0.594 | 60 |
| shipped-hybrid:potion-base-8M | holdout | semantic | 80.6% | 0.582 | 36 |
| shipped-hybrid:potion-base-8M | holdout | lexical | 100.0% | 1.000 | 12 |
| shipped-hybrid:potion-base-8M | holdout | topical | 66.7% | 0.227 | 12 |
| competitor:obsidian-tc | dev | overall | 90.0% | 0.757 | 90 |
| competitor:obsidian-tc | dev | semantic | 96.3% | 0.789 | 54 |
| competitor:obsidian-tc | dev | lexical | 100.0% | 0.944 | 18 |
| competitor:obsidian-tc | dev | topical | 61.1% | 0.473 | 18 |
| competitor:obsidian-tc | holdout | overall | 88.3% | 0.744 | 60 |
| competitor:obsidian-tc | holdout | semantic | 91.7% | 0.817 | 36 |
| competitor:obsidian-tc | holdout | lexical | 100.0% | 0.958 | 12 |
| competitor:obsidian-tc | holdout | topical | 66.7% | 0.311 | 12 |
| competitor:obsidian-tc-graph | dev | overall | 90.0% | 0.793 | 90 |
| competitor:obsidian-tc-graph | dev | semantic | 96.3% | 0.849 | 54 |
| competitor:obsidian-tc-graph | dev | lexical | 100.0% | 0.972 | 18 |
| competitor:obsidian-tc-graph | dev | topical | 61.1% | 0.444 | 18 |
| competitor:obsidian-tc-graph | holdout | overall | 95.0% | 0.817 | 60 |
| competitor:obsidian-tc-graph | holdout | semantic | 100.0% | 0.898 | 36 |
| competitor:obsidian-tc-graph | holdout | lexical | 100.0% | 1.000 | 12 |
| competitor:obsidian-tc-graph | holdout | topical | 75.0% | 0.390 | 12 |

## Query latency (warm) & payload

| Condition | p50 | p90 | p95 | p99 | payload/query |
| --- | ---: | ---: | ---: | ---: | ---: |
| lexical | 58.65 ms | 240.84 ms | 296.53 ms | 494.01 ms | in-process |
| semantic:potion-base-8M | 13.05 ms | 13.41 ms | 13.94 ms | 14.22 ms | in-process |
| hybrid-rrf:potion-base-8M | 71.04 ms | 244.96 ms | 270.19 ms | 496.68 ms | in-process |
| semantic-top2:potion-base-8M | 13.05 ms | 13.38 ms | 13.99 ms | 14.34 ms | in-process |
| hybrid-route:potion-base-8M | 12.95 ms | 13.35 ms | 13.87 ms | 14.20 ms | in-process |
| hybrid-route-top2:potion-base-8M | 12.96 ms | 13.25 ms | 13.94 ms | 14.28 ms | in-process |
| hybrid-wsum70:potion-base-8M | 13.02 ms | 13.38 ms | 14.03 ms | 14.37 ms | in-process |
| hybrid-wsum85:potion-base-8M | 13.01 ms | 13.54 ms | 14.04 ms | 14.34 ms | in-process |
| shipped-semantic:potion-base-8M | 14.01 ms | 14.47 ms | 14.71 ms | 15.11 ms | in-process |
| shipped-hybrid:potion-base-8M | 14.08 ms | 40.58 ms | 51.54 ms | 89.81 ms | in-process |
| competitor:obsidian-tc | 171.10 ms | 177.50 ms | 182.41 ms | 205.96 ms | 15.6 KB |
| competitor:obsidian-tc-graph | 1219.68 ms | 6976.72 ms | 9982.64 ms | 21613.59 ms | 14.9 KB |

## Competitor setup cost (SHA-308)

Both competitors delegate embeddings to a local Ollama (`nomic-embed-text`) — a second server seekstone does not need. Cold index build over the same fixture vault:

| Server | Version | Embedding provider | Cold index |
| --- | --- | --- | ---: |
| obsidian-tc | 1.23.2 | ollama/nomic-embed-text (its built-in default; loopback HTTP at index + query time) | 2290.2 s |
| obsidian-mcp-pro | 4.0.1 | ollama/nomic-embed-text (loopback HTTP) | **FAILED** after 907 s |

**competitor:obsidian-tc** — search_semantic capability (vector kNN over sqlite-vec), defaults: k=10, content returned. Scratch cacheDir per run — cold index measured; native modules (better-sqlite3, sqlite-vec, Rust NAPI) required; Node ≥ 24.

```
{"vault":"main","notes_seen":10000,"notes_indexed":10000,"chunks_upserted":65263,"chunks_deleted":0,"chunks_unchanged":0,"edges_inserted":41708,"edges_deleted":0,"secrets_skipped":0,"vec_enabled":true,"fts_enabled":true,"notes_upserted":2400,"notes_deleted":0,"notes_embed_failed":0,"chunks_dedup_reused":0,"chunks_dedup_unresolved":0,"embed_batch_rejections":0,"model":"ollama:nomic-embed-text","dimensions":768}
```

**competitor:obsidian-tc-graph** — vault_graph_search — its GraphRAG mode: vector seeds expanded through the wikilink graph, RRF-fused.

```
{"vault":"main","notes_seen":10000,"notes_indexed":10000,"chunks_upserted":65263,"chunks_deleted":0,"chunks_unchanged":0,"edges_inserted":41708,"edges_deleted":0,"secrets_skipped":0,"vec_enabled":true,"fts_enabled":true,"notes_upserted":2400,"notes_deleted":0,"notes_embed_failed":0,"chunks_dedup_reused":0,"chunks_dedup_unresolved":0,"embed_batch_rejections":0,"model":"ollama:nomic-embed-text","dimensions":768}
```

**competitor:obsidian-mcp-pro** — Setup did not complete on the 10k-note fixture vault — no quality/latency numbers are possible; the failure itself is the recorded result.

```
obsidian-mcp-pro index_vault: Error indexing vault: Invalid string length
```

## Hybrid misses at 5 (error-analysis material)

- **sem-anemometer** (semantic): "instrument that measures the speed and pressure of wind" → expected Notes/Anemometer.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Hydraulics.md, Encyclopedia/H/Horn.md, 0 Inbox/Mecca.md, Encyclopedia/L/Ligao.md, Reference/Cloaca.md
- **sem-anglesite** (semantic): "mineral composed of lead sulphate" → expected Encyclopedia/A/Anglesite.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Copper.md, Encyclopedia/I/Irnerius.md, Encyclopedia/C/Chemistry.md, Encyclopedia/C/Calcite.md, Encyclopedia/M/Magnesite.md
- **sem-jaguar** (semantic): "largest wild cat found on the American continent" → expected Encyclopedia/J/Jaguar.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Canachus.md, Reference/India.md, Encyclopedia/G/Geography.md, Reference/Australia.md, Encyclopedia/I/Indo-China.md
- **sem-dahlia** (semantic): "Mexican garden flower named after a pupil of Linnaeus" → expected Sources/Dahlia.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Notes/Japan.md, 0 Inbox/Flower.md, Sources/Europe.md, Encyclopedia/I/Italy.md
- **sem-geyser** (semantic): "natural hot spring that periodically erupts a column of boiling water and steam" → expected Sources/Geyser.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Encyclopedia/E/Electric Eel.md, Sources/Cotton.md, Encyclopedia/B/Bacsanyi.md, Encyclopedia/D/Daille.md
- **sem-giraffe** (semantic): "the tallest living mammal, an African ruminant with a long neck" → expected Encyclopedia/G/Giraffe.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Reference/India.md, Encyclopedia/M/Madagascar.md, Encyclopedia/C/Chile.md, 0 Inbox/Mammalia.md
- **sem-guillotine** (semantic): "beheading machine of the French Revolution" → expected Sources/Guillotine.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/F/French Revolution.md, Notes/French Revolutionary Wars.md, Notes/History.md, Sources/Europe.md, Encyclopedia/I/Italy.md
- **sem-hurricane** (semantic): "violent tropical wind storm of the West Indies" → expected Reference/Hurricane.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/Australia.md, Reference/India.md, Notes/Argentina.md, Encyclopedia/A/Asia.md
- **sem-kite-bird** (semantic): "bird of prey once the most familiar in Great Britain, now among its rarest" → expected Encyclopedia/K/Kite.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Reference/India.md, Notes/Canachus.md, Encyclopedia/F/Flycatcher.md, Notes/Japan.md
- **sem-comet** (semantic): "nebulous celestial body travelling a highly eccentric orbit around the sun" → expected Reference/Comet.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Astronomy.md, Notes/Japan.md, 0 Inbox/Mecca.md, Notes/Horse.md, Encyclopedia/B/Babylon.md
- **sem-fog** (semantic): "suspended particles near the ground that make surrounding objects invisible" → expected Reference/Fog.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Encyclopedia/E/Electric Eel.md, Encyclopedia/M/Magnesite.md, 0 Inbox/Cap Haitien.md, Reference/Astronomy.md
- **sem-llama** (semantic): "domesticated South American pack animal of the camel family" → expected Notes/Llama.md
  - hybrid-rrf:potion-base-8M top 5: Reference/India.md, Reference/Australia.md, Encyclopedia/A/Asia.md, Notes/Horse.md, Encyclopedia/I/Indo-China.md
- **sem-fox-statesman** (semantic): "eighteenth century British statesman and orator, son of Lord Holland" → expected Encyclopedia/F/Fox.md
  - hybrid-rrf:potion-base-8M top 5: Reference/George.md, Encyclopedia/B/Belgium.md, Encyclopedia/L/Leeds.md, Encyclopedia/H/Harrowby.md, Notes/Japan.md
- **sem-darwin** (semantic): "Victorian naturalist who developed the theory of evolution by natural selection" → expected Sources/Darwin.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Evidence.md, Reference/Ethics.md, Sources/Aristotle.md, Reference/Australia.md, Encyclopedia/E/Embrun.md
- **sem-faraday** (semantic): "English scientist famous for discoveries in electromagnetism and electrochemistry" → expected Reference/Faraday.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/E/Electric Eel.md, Encyclopedia/C/Chemistry.md, Encyclopedia/M/Magnesite.md, Encyclopedia/L/Ligao.md, Notes/Japan.md
- **sem-machiavelli** (semantic): "Florentine political theorist whose name became a byword for cunning statecraft" → expected Encyclopedia/M/Machiavelli.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/I/Italy.md, Encyclopedia/E/English Law.md, Encyclopedia/F/Florence.md, Sources/Germanium.md, Notes/Japan.md
- **top-birds-of-prey** (topical): "birds of prey" → expected Reference/Eagle.md, Encyclopedia/H/Hawk.md, Encyclopedia/K/Kite.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/I/Italy.md, Reference/India.md, Notes/Humming-Bird.md, Reference/Australia.md, Encyclopedia/F/Frigate-Bird.md
- **top-big-cats** (topical): "large wild cats" → expected Encyclopedia/J/Jaguar.md, Encyclopedia/L/Leopard.md, Reference/Lynx.md
  - hybrid-rrf:potion-base-8M top 5: Reference/India.md, Encyclopedia/F/Fur.md, Encyclopedia/H/Himalaya.md, Reference/Australia.md, Notes/Canachus.md
- **top-green-gemstones** (topical): "green gemstones" → expected Encyclopedia/E/Emerald.md, Notes/Jade.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Greenockite.md, Encyclopedia/E/Epidote.md, Reference/Greensand.md, Notes/Marble.md, Reference/Apatite.md
- **top-weather** (topical): "violent weather phenomena" → expected Reference/Hurricane.md, Encyclopedia/H/Hail.md, Reference/Fog.md
  - hybrid-rrf:potion-base-8M top 5: Reference/India.md, Notes/Japan.md, Encyclopedia/C/Chile.md, Reference/Australia.md, Sources/Influenza.md
- **top-instruments** (topical): "musical instruments" → expected Reference/Flute.md, Sources/Drum.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Instrument.md, Encyclopedia/G/Guitar.md, Encyclopedia/C/Clarinet.md, Encyclopedia/K/Kettle.md, Encyclopedia/H/Harmonica.md
- **top-composers** (topical): "great German composers" → expected Sources/Beethoven.md, Encyclopedia/H/Handel.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Germanium.md, Sources/Hymettus.md, Notes/History.md, Encyclopedia/C/Chorale.md, Reference/Encyclical.md
- **top-dairy** (topical): "foods made from milk" → expected Encyclopedia/C/Cheese.md, Encyclopedia/B/Butter.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/D/Daille.md, Reference/Cattle.md, Notes/Canachus.md, Notes/Dietetics.md, Reference/India.md
- **sem-astrolabe** (semantic): "ancient instrument for taking the altitude of stars, sun and moon" → expected Encyclopedia/A/Astrolabe.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Astronomy.md, Sources/Hindostani.md, Notes/Japan.md, Reference/India.md, Encyclopedia/I/Italy.md
- **sem-astrology** (semantic): "art of divining human fate from the positions of the heavenly bodies" → expected Encyclopedia/A/Astrology.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Aristotle.md, Notes/Japan.md, Encyclopedia/E/English Law.md, Encyclopedia/B/Babylon.md, Encyclopedia/H/Hinduism.md
- **sem-avalanche** (semantic): "mass of snow and ice rushing down a mountainside carrying everything before it" → expected Encyclopedia/A/Avalanche.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Sources/Europe.md, Encyclopedia/I/Ireland.md, Reference/India.md, Reference/Australia.md
- **sem-brick** (semantic): "artificial stone of burnt clay used as a building material" → expected Encyclopedia/B/Brick.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Encyclopedia/F/Fine Arts.md, Encyclopedia/B/Babylon.md, Encyclopedia/M/Magnesite.md, Encyclopedia/F/Fire Brat.md
- **sem-mars** (semantic): "the reddish fourth planet in order of distance from the sun" → expected Reference/Mars.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Astronomy.md, Notes/Japan.md, Sources/Europe.md, Encyclopedia/L/Ligao.md, Sources/Map.md
- **sem-caravan** (semantic): "body of traders travelling together for security against robbers" → expected Reference/Caravan.md
  - hybrid-rrf:potion-base-8M top 5: Reference/India.md, Reference/Labour Exchange.md, Notes/Japan.md, Encyclopedia/I/Italy.md, Sources/Cotton.md
- **sem-carnival** (semantic): "days of feasting and merrymaking before Lent" → expected Notes/Carnival.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Lent.md, Encyclopedia/F/Fasting.md, Encyclopedia/E/Eucharist.md, Encyclopedia/M/Madagascar.md, Encyclopedia/D/Daille.md
- **sem-clover** (semantic): "plant of the pea family named for its three leaflets" → expected Sources/Clover.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Encyclopedia/I/Italy.md, Reference/Australia.md, Encyclopedia/L/Leaf.md, Sources/Cotton.md
- **sem-cormorant** (semantic): "large sea fowl named from the Latin for sea raven" → expected Encyclopedia/C/Cormorant.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Encyclopedia/G/Geography.md, Reference/Australia.md, Encyclopedia/I/Italy.md, Encyclopedia/B/Baltic Sea.md
- **sem-crown-coin** (semantic): "English silver coin of the value of five shillings" → expected Reference/Crown.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Encyclopedia/E/Exchange.md, Reference/India.md, Notes/History.md, Encyclopedia/C/Coin.md
- **sem-desert** (semantic): "land too barren of vegetation to support a human population" → expected Encyclopedia/D/Desert.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Encyclopedia/G/Geography.md, Encyclopedia/A/Asia.md, Encyclopedia/I/Italy.md, Notes/Argentina.md
- **sem-equator** (semantic): "great circle equidistant from the two poles dividing the hemispheres" → expected Encyclopedia/E/Equator.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Map.md, Reference/Astronomy.md, 0 Inbox/Mecca.md, Encyclopedia/M/Magnesite.md, Encyclopedia/E/Electrokinetics.md
- **sem-feather** (semantic): "horny outgrowth of the skin that distinguishes birds from all other animals" → expected Encyclopedia/F/Feather.md
  - hybrid-rrf:potion-base-8M top 5: Reference/India.md, Reference/Australia.md, Encyclopedia/I/Italy.md, 0 Inbox/Mammalia.md, Encyclopedia/M/Madagascar.md
- **sem-flag** (semantic): "piece of bunting waved from a staff as a standard, ensign or signal" → expected Encyclopedia/F/Flag.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Notes/Japan.md, Reference/Astronomy.md, Reference/Hydraulics.md, Encyclopedia/L/Ligao.md
- **sem-flood-statesman** (semantic): "Irish statesman, son of a chief justice of the king's bench in Ireland" → expected Notes/Flood.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/I/Ireland.md, Reference/Australia.md, Encyclopedia/C/Crimea.md, Encyclopedia/C/Celt.md, Notes/Canachus.md
- **sem-gong** (semantic): "broad thin bronze disk with a deep rim struck as an instrument of Chinese origin" → expected Encyclopedia/G/Gong.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/Hydraulics.md, Encyclopedia/F/Fine Arts.md, Reference/Australia.md, Encyclopedia/D/Drama.md
- **sem-grasshopper** (semantic): "leaping insect with powerful hind legs that stridulates" → expected Encyclopedia/G/Grasshopper.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/C/Coleoptera.md, Encyclopedia/H/Hexapoda.md, Encyclopedia/I/Insect.md, Sources/Lepidoptera.md, Encyclopedia/I/Insectivora.md
- **sem-hibernation** (semantic): "dormant state in which animals pass the winter" → expected Encyclopedia/H/Hibernation.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Europe.md, Encyclopedia/I/Italy.md, Notes/Japan.md, Sources/Horticulture.md, Reference/India.md
- **sem-ice** (semantic): "solid crystalline form that water assumes at low temperature" → expected 0 Inbox/Ice.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/C/Chemistry.md, Encyclopedia/F/Fusion.md, Encyclopedia/M/Magnesite.md, Sources/Horticulture.md, 0 Inbox/Cap Haitien.md
- **sem-jury** (semantic): "body of laymen sworn to ascertain the truth of facts under the guidance of a judge" → expected Reference/Jury.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Evidence.md, Encyclopedia/E/English Law.md, Encyclopedia/C/Crimea.md, Encyclopedia/E/Edric.md, Encyclopedia/E/England.md
- **sem-lagoon** (semantic): "sheet of shallow water near the sea or enclosed by an atoll" → expected Reference/Lagoon.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Notes/Japan.md, Encyclopedia/I/Ireland.md, Encyclopedia/G/Geography.md, Encyclopedia/C/Chile.md
- **sem-lantern** (semantic): "case of transparent material protecting a light from rain and wind" → expected Reference/Lantern.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Notes/Japan.md, Sources/Europe.md, Sources/Cotton.md, Encyclopedia/A/Asia.md
- **sem-lithography** (semantic): "printing from a design drawn on stone, relying on the antagonism of grease and water" → expected Reference/Lithography.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/C/Chemistry.md, Notes/Japan.md, Sources/Map.md, Sources/Evidence.md, Reference/Ethics.md
- **sem-marble** (semantic): "limestone close enough in texture to admit of being polished" → expected Notes/Marble.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/Ethics.md, Sources/Horticulture.md, Encyclopedia/E/Edric.md, Encyclopedia/F/Fine Arts.md
- **sem-mead-physician** (semantic): "English physician, eleventh child of an Independent divine, who graduated at Padua" → expected Reference/Mead.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/H/Harvey.md, Reference/Leonardo Da Vinci.md, Encyclopedia/I/Italy.md, Notes/Assarotti.md, Notes/Japan.md
- **sem-helium** (semantic): "gaseous element named after the sun, discovered soon after argon" → expected Encyclopedia/H/Helium.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/C/Chemistry.md, Encyclopedia/A/Argon.md, Encyclopedia/M/Magnesite.md, Reference/Astronomy.md, Sources/Germanium.md
- **sem-hare** (semantic): "well-known English rodent allied to the rabbit, with an Alpine mountain relative" → expected Notes/Hare.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Encyclopedia/I/Italy.md, Notes/Japan.md, Encyclopedia/C/Chile.md, Reference/India.md
- **sem-lamprey** (semantic): "jawless stone-sucking fish with a cartilaginous skeleton" → expected Sources/Lamprey.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/C/Cephalopoda.md, Notes/Japan.md, Encyclopedia/H/Hexapoda.md, Notes/Horse.md, Encyclopedia/I/Ireland.md
- **sem-lacrosse** (semantic): "national ball game of Canada played with a curved netted stick" → expected 0 Inbox/Lacrosse.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Reference/Hydraulics.md, Notes/Canachus.md, Encyclopedia/D/Daille.md, Encyclopedia/B/Billiards.md
- **sem-haydn** (semantic): "Austrian composer of Croatian stock born at Rohrau" → expected Notes/Haydn.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Croatia-Slavonia.md, Notes/History.md, Sources/Europe.md, Reference/Australia.md, Encyclopedia/D/Dalmatia.md
- **sem-gray-poet** (semantic): "English poet whose mother kept a millinery shop in Cornhill" → expected 0 Inbox/Gray.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/C/Celt.md, Encyclopedia/I/Ireland.md, Encyclopedia/E/English Law.md, Sources/Hindostani.md, Notes/Japan.md
- **sem-matterhorn** (semantic): "famous Alpine peak above Zermatt on the frontier of Switzerland and Italy" → expected Encyclopedia/M/Matterhorn.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/I/Italy.md, Sources/Europe.md, Notes/Japan.md, Reference/Australia.md, Reference/India.md
- **sem-lemming** (semantic): "small Scandinavian rodent of the mouse tribe related to the voles" → expected Encyclopedia/L/Lemming.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mammalia.md, Encyclopedia/I/Ireland.md, Encyclopedia/A/Asia.md, Reference/Australia.md, Encyclopedia/F/Fur.md
- **sem-anvil** (semantic): "mass of iron on which material is supported while shaped under the hammer" → expected Reference/Anvil.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/Australia.md, Encyclopedia/M/Magnesite.md, 0 Inbox/Mecca.md, Sources/Europe.md
- **sem-catapult** (semantic): "warlike engine of the cross-bow type used by the ancients" → expected 0 Inbox/Catapult.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Sources/Europe.md, Encyclopedia/C/Cross.md, Encyclopedia/I/Ireland.md, Sources/Hymettus.md
- **top-orchard-fruits** (topical): "fruits grown in gardens and orchards" → expected Reference/Apple.md, Sources/Gooseberry.md, Sources/Lemon.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Notes/Canachus.md, Encyclopedia/I/Italy.md, Sources/Europe.md, Sources/Guiana.md
- **top-english-poets** (topical): "lives of the English poets" → expected Encyclopedia/B/Byron.md, Notes/Chaucer.md, Encyclopedia/D/Dryden.md, 0 Inbox/Gray.md, Notes/Cowper.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/E/English Law.md, Encyclopedia/C/Celt.md, Notes/Japan.md, Encyclopedia/I/Iceland.md, Sources/Hindostani.md
- **top-british-philosophers** (topical): "British philosophers of the seventeenth and eighteenth centuries" → expected Encyclopedia/L/Locke.md, Reference/Berkeley.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/I/Ireland.md, Sources/Europe.md, Sources/Germanium.md, Reference/Astronomy.md, Encyclopedia/F/Folkes.md
- **top-classical-deities** (topical): "gods and goddesses of Greek and Roman mythology" → expected Sources/Apollo.md, Sources/Hermes.md, Notes/Dionysus.md, Reference/Hera.md, Encyclopedia/J/Juno.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/A/Aphrodite.md, Reference/Ares.md, Encyclopedia/D/Drama.md, Reference/Hephaestus.md, Encyclopedia/I/Isis.md
- **top-trees** (topical): "broad-leaved and evergreen trees" → expected Sources/Beech.md, Encyclopedia/B/Birch.md, Encyclopedia/E/Elm.md, Encyclopedia/M/Maple.md, Encyclopedia/C/Cypress.md, Encyclopedia/H/Holly.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/F/Forest Laws.md, Sources/Laureate.md, Sources/Bosnia And Herzegovina.md, Sources/Horticulture.md, Sources/Lebanon.md
- **top-great-rivers** (topical): "great rivers of the world" → expected Encyclopedia/E/Euphrates.md, Encyclopedia/G/Ganges.md, Encyclopedia/E/Elbe.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Europe.md, Reference/Australia.md, Notes/Canachus.md, Encyclopedia/G/Geography.md, Sources/Germanium.md
- **top-outdoor-ball-games** (topical): "outdoor games played with a ball" → expected Encyclopedia/G/Golf.md, Encyclopedia/C/Croquet.md, 0 Inbox/Lacrosse.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/G/Games.md, Encyclopedia/B/Billiards.md, Encyclopedia/I/Italy.md, Encyclopedia/B/Bagatelle.md, Notes/Japan.md
- **top-indoor-games** (topical): "indoor games of skill played on a table or board" → expected Encyclopedia/B/Billiards.md, Encyclopedia/D/Draughts.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/G/Games.md, Encyclopedia/I/Ireland.md, Encyclopedia/F/Fine Arts.md, Encyclopedia/D/Drama.md, Encyclopedia/H/Halma.md
- **top-british-birds** (topical): "familiar birds of the British countryside" → expected Reference/Cuckoo.md, Encyclopedia/M/Magpie.md, Encyclopedia/L/Lark.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Notes/Canachus.md, Sources/Europe.md, Encyclopedia/E/English Law.md, Encyclopedia/F/Flycatcher.md
- **top-sea-fishes** (topical): "fishes of the open sea" → expected Encyclopedia/C/Cod.md, Notes/Mackerel.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/India.md, Reference/Australia.md, Encyclopedia/I/Italy.md, Sources/Caspian Sea.md
- **top-building-stones** (topical): "stones and materials used in building" → expected Encyclopedia/B/Brick.md, Notes/Marble.md, Encyclopedia/L/Limestone.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/F/Fine Arts.md, Notes/Japan.md, Encyclopedia/M/Magnesite.md, Encyclopedia/I/Ireland.md, Encyclopedia/I/Inscriptions.md
- **top-funerary-customs** (topical): "burial customs and monuments to the dead" → expected Sources/Cremation.md, Sources/Mausoleum.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Notes/Funeral Rites.md, Encyclopedia/I/Inscriptions.md, Reference/Australia.md, Encyclopedia/A/Athenry.md
- **top-light-sources** (topical): "devices for holding and carrying a light" → expected Encyclopedia/L/Lamp.md, Reference/Lantern.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Sources/Cotton.md, Reference/Hydraulics.md, Encyclopedia/E/Electric Eel.md, Sources/Dream.md
- **top-lead-ores** (topical): "minerals that are ores of lead" → expected Encyclopedia/C/Cerussite.md, Encyclopedia/A/Anglesite.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Notes/Canachus.md, Notes/Japan.md, Encyclopedia/L/Leadville.md, Encyclopedia/C/Chile.md

## Gate verdict

> **Pre-registered gate:** hybrid RRF must beat lexical-only by ≥10 points hit@5 on the semantic subset, regress ≤2 points on the exact-term subset, and warm end-to-end semantic query (embed + scan) p95 ≤ 15 ms at 10k notes. +5..+10 points = discuss zone. Model choice = smallest model passing.

### potion-base-8M — SHIP

- semantic subset hit@5 +25.6 pts (gate ≥ +10): PASS
- lexical subset hit@5 0.0 pts (gate ≥ -2): PASS
- semantic warm p95 13.94 ms (gate ≤ 15 ms): PASS

**Overall: SHIP** — chosen model: potion-base-8M
