# Write Safety — obsidian-mcp-rs

- **Adapter:** obsidian-mcp-rs (Rust, filesystem-direct, per-query scan, no Obsidian required)
- **Snapshot:** 2026-09-07T04:09:24.391Z
- **Sample:** 25 frontmatter-heavy notes
- **Vault copy:** `<tmpdir>/seekstone-safety-tW9I8Q`
- **Original (read-only, untouched):** `packages/harness/fixtures/vault`

## Summary

| Op | Pass | Fail | Skipped | Verdict |
| --- | ---: | ---: | ---: | --- |
| identity | 25 | 0 | 0 | ✅ Pass |
| body-append | 25 | 0 | 0 | ✅ Pass |
| fm-edit | 25 | 0 | 0 | ✅ Pass |
| patch-note | 25 | 0 | 0 | ✅ Pass |
| replace-in-note | 25 | 0 | 0 | ✅ Pass |
| recoverable-delete | 25 | 0 | 0 | ✅ Pass |
| create-no-clobber | 25 | 0 | 0 | ✅ Pass |
| cas-conflict | 0 | 0 | 25 | — n/a (unsupported by adapter) |
| undo-roundtrip | 0 | 0 | 25 | — n/a (unsupported by adapter) |

> Skipped = the adapter does not expose the capability (delete/create/CAS), or the op does not apply to a note's shape. Skips are the capability matrix, not failures.

✅ No failures across 25 sampled notes.
