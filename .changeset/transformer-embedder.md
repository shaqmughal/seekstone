---
"seekstone": minor
---

feat(semantic): support real transformer embedding models via transformers.js (ONNX)

Model2Vec static embeddings are fast but context-free — for CJK vaults their
concept-level discrimination is near bag-of-words. This adds an async
embedding runtime: when `SEEKSTONE_MODEL_PATH` points at a HuggingFace-style
ONNX model directory (e.g. a local clone of `Xenova/bge-small-zh-v1.5`),
the server loads it through `@huggingface/transformers` (mean pooling +
L2 normalize, `dtype: q8`) instead of failing the Model2Vec format check.

- Model-dir format detection: an `onnx/` subdir selects the transformer
  runtime; anything else stays Model2Vec (fully backward compatible).
- New `AsyncEmbedder` seam beside the sync `Embedder`; `Semantic` supports
  both (batched per-note embedding on the build path).
- `searchAsync` dispatched for the `search` tool: lexical + Model2Vec paths
  are unchanged and stay synchronous; MaxSim rerank passes through for
  runtimes without token vectors.
- Zero-network guarantee preserved: `env.allowRemoteModels = false`, models
  are fetched out-of-band exactly like `seekstone fetch-model`.
