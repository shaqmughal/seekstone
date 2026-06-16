---
"seekstone": patch
---

fix(mcpb): shard the bundle under Claude Desktop's ~108KB per-file install cap

The `.mcpb` one-click install silently broke as of v0.4.0: Claude Desktop's
local install preview rejects a bundle if any single file exceeds ~108KB, and
the fully-bundled `dist/index.js` is ~1.7MB. The bundle is now split into <95KB
shards that a small loader reassembles at startup, so the install dialog appears
again. A build-time guard fails the build if any packed file exceeds the cap.
