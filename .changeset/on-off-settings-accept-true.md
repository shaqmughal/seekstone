---
"seekstone": patch
---

On/off settings (`SEEKSTONE_READ_ONLY`, `SEEKSTONE_HISTORY`, `SEEKSTONE_WATCH_POLL`, `SEEKSTONE_SEMANTIC`) now also accept `true`/`false`, `yes`/`no` and `on`/`off`. Any other value logs a warning at boot. For `SEEKSTONE_READ_ONLY` it turns read-only on; the other on/off settings keep their default.
