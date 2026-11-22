---
'seekstone': patch
---

Symlinks that point outside the vault are now refused. Before, a symlink inside the vault let tools read and write files outside it, and could route a write past `SEEKSTONE_WRITE_PATHS` or into `.seekstone/` and `.trash/`. Now a read or write whose real path is outside the vault fails with an error, unless you set `SEEKSTONE_FOLLOW_SYMLINKS=1`. Dangling symlinks are refused in both modes. Symlinks whose target stays inside the vault work as before. With or without the setting, `SEEKSTONE_READ_PATHS`, `SEEKSTONE_WRITE_PATHS` and the `.seekstone/` and `.trash/` folders are checked against where a link really lands. The file watcher no longer picks up files through symlinked folders, which the startup index already skipped.
