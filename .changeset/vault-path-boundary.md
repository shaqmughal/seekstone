---
"seekstone": patch
---

Harden the vault sandbox: path containment now uses a single shared guard (`resolveVaultPath`) with a proper separator-boundary check, replacing 13 inline `startsWith` checks that accepted paths escaping into sibling directories whose names share the vault's prefix (e.g. vault `/home/u/vault` + path `../vault-backup/x.md`). The vault root is also normalized with `resolve()` at startup so a relative or trailing-slash `SEEKSTONE_VAULT` can't weaken the boundary, and absolute-path inputs are now contained instead of concatenated.
