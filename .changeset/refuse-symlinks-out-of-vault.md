---
'seekstone': patch
---

Symlinks that point outside the vault are now refused. Before, a symlink inside the vault let tools read and write files outside it, and could route a write past `SEEKSTONE_WRITE_PATHS` or into `.seekstone/` and `.trash/`. Now a read or write whose real path is outside the vault fails with an error, unless you set `SEEKSTONE_FOLLOW_SYMLINKS=1`. Dangling symlinks are refused in both modes. Symlinks whose target stays inside the vault work as before. When a link lands inside the vault, `SEEKSTONE_READ_PATHS`, `SEEKSTONE_WRITE_PATHS` and the `.seekstone/` and `.trash/` folders are checked against where it lands, with or without the setting. With the setting on, a link to outside the vault is checked by the path as written only. The file watcher no longer picks up files through symlinked folders, which the startup index already skipped.
