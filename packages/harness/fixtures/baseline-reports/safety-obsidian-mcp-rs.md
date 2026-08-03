# Write Safety — obsidian-mcp-rs

- **Adapter:** obsidian-mcp-rs (Rust, filesystem-direct, per-query scan, no Obsidian required)
- **Snapshot:** 2026-08-03T03:13:02.563Z
- **Sample:** 25 frontmatter-heavy notes
- **Vault copy:** `<tmpdir>/seekstone-safety-Wi4Phm`
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

> Skipped = the adapter does not expose the capability (delete/create/CAS), or the op does not apply to a note's shape. Skips are the capability matrix, not failures.

✅ No failures across 25 sampled notes.
