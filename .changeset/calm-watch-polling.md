---
'seekstone': minor
---

`SEEKSTONE_WATCH_POLL=1` no longer stat-polls every file in the vault every 50ms — that hardcoded interval could pin ~20–25% of a CPU core per running instance on the network/WSL/9p mounts polling exists for ([#280](https://github.com/shaqmughal/seekstone/issues/280)). The default poll interval is now 10s (binary files 20s), and a new `SEEKSTONE_WATCH_POLL_INTERVAL` env var (milliseconds) tunes it. Note this only affects how quickly *external* edits are picked up under polling mode — seekstone's own writes still update the index immediately, and native (non-polling) watching is unchanged.
