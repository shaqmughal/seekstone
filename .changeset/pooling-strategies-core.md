---
'@seekstone/core': minor
---

`scanTopNotes` accepts a `ChunkPooling` beyond `max`/`top2mean`: `{ kind: 'logdiscount', lambda }` and `{ kind: 'softmax', temperature }`, all driven by a new streaming `PoolAccumulator` (same dot products, aggregation only). Exported with `poolingId` / `assertValidPooling`.
