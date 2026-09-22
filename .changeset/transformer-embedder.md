---
"seekstone": minor
---

Opt-in transformer embedding models via transformers.js (ONNX). Model2Vec static embeddings are fast but context-free, and on CJK vaults their concept-level discrimination is close to bag-of-words. When `SEEKSTONE_MODEL_PATH` points at a HuggingFace-style ONNX model directory (`config.json` + `onnx/`, e.g. a local clone of `Xenova/bge-small-zh-v1.5`), the server now loads it through `@huggingface/transformers` (mean pooling, L2 normalize, `dtype: q8`) instead of failing the Model2Vec format check.

- The runtime is an **optional peer dependency**, not a dependency: the default install stays free of native modules, and `npx -y seekstone` downloads nothing new. Install it alongside seekstone to opt in (`npx -y -p seekstone -p @huggingface/transformers seekstone`); a transformer model directory without the runtime fails at boot with the install command.
- `search` and `context_pack` share one async retrieval path, so both tools get the transformer runtime; the lexical and Model2Vec paths never suspend and return byte-identical results.
- Zero-network guarantee preserved: `allowRemoteModels = false`, models are fetched out-of-band exactly like `seekstone fetch-model`.
- Embedding caches for transformer models are keyed on the model's weights, not its folder name. Watcher re-embeds that resolve out of order can no longer overwrite a newer edit.
- Trade-offs, documented in the README: ~350 MB unpacked runtime, roughly 140 ms per query embedding, minutes for a first index, and no MaxSim rerank on this path.
