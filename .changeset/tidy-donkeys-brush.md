---
"seekstone": patch
---

Watcher teardown is now awaitable: `stop()` returns chokidar's close promise instead of fire-and-forgetting it, so embedders and tests can wait for the watcher (and its polling timers) to fully shut down. Also deflakes CI: the harness's `copyVault` scratch destinations are created atomically with `mkdtemp` (the old millisecond-timestamp naming could collide under parallel test workers), and the watcher tests self-heal missed single-create polling ticks on Windows.
