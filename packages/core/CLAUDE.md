# Core (packages/core)

Shared vault primitives: `walk`, `frontmatter`, `extract`, `outline`, `tasks`, `percentiles`, `pmap` and `embed` (the Model2Vec semantic search pieces). Private; the server bundles it at build time and the harness imports it from source.

- **Both the server and the harness depend on this code, so it must not import from either.** Changes here affect the product and the measurements at once. Run the server and harness tests as well as `npm run -w @seekstone/core test`.
- **These are hot paths.** The walker and parsers run on every note at index time. Avoid extra passes, repeated parsing and new dependencies. Check the CodSpeed benches in `packages/server/src/bench/` when you change them.
- **Frontmatter handling is byte-faithful.** Write tools rely on `bodyStart` and the parsed block to rewrite notes without disturbing anything else. Malformed YAML is reported (`malformed: true`), never thrown.
- **Property tests** (`*.property.test.ts`, fast-check) cover the parsers. Add a property when you fix a parser bug.
- **No transformer runtime.** Semantic search uses static Model2Vec embeddings, with no ONNX or transformers.js. Models are pinned by hash in `packages/harness/fixtures/models/manifest.json`.
