---
'seekstone': patch
---

Cold index build no longer quadratic on link-heavy vaults. `resolveLink` used to scan every indexed note for each non-exact wikilink target, making backlink indexing O(links × notes) — ~17 minutes on a 10k-note vault with 131k links. Loose resolution now goes through basename/path lookup maps built once per index build (and once per watcher event), bringing that same build to seconds. Resolution precedence is unchanged (exact → +.md → basename → path-without-extension); ambiguous targets (duplicate basenames) now resolve deterministically to the lexicographically smallest note path instead of depending on index insertion order.
