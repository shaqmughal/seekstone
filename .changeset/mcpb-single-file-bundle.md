---
"seekstone": patch
---

Fix the .mcpb extension crashing at startup (`ERR_MODULE_NOT_FOUND: chunk-*.js`). tsup's ESM code splitting (default-on) emitted separate chunk files for the dynamic `import()` introduced with semantic search in 0.15.0, and the mcpb pipeline only ships the sharded `index.js` — the chunks were silently dropped, so the installed extension died on launch. Both builds now set `splitting: false`, and `build-mcpb.mjs` fails loudly if the build ever emits more than one file.
