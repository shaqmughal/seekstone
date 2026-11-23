---
"seekstone": minor
---

Seekstone no longer follows symlinks inside the vault. Reads and writes through a symlink are refused, and linked notes aren't indexed, including with `SEEKSTONE_READ_PATHS` set. If `.trash/` is a symlink, recoverable deletes are refused (use `permanent: true`). If `.seekstone/` or its history is a symlink, write history turns off with a warning. Obsidian's periodic-notes settings files may still be symlinks. If you rely on following symlinks, please open an issue.
