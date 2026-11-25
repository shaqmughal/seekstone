---
"seekstone": patch
---

On/off settings (`SEEKSTONE_READ_ONLY`, `SEEKSTONE_HISTORY`, `SEEKSTONE_WATCH_POLL`, `SEEKSTONE_SEMANTIC`) now also accept `true`/`false`, `yes`/`no` and `on`/`off`. Any other value keeps the default and logs a warning at boot, so a typo like `SEEKSTONE_READ_ONLY=y` no longer leaves writes on without a word.
