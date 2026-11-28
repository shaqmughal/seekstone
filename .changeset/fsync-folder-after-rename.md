---
"seekstone": patch
---

On Linux and macOS, a note write that reports success, and the write history that lets you undo it, now survive a power cut as far as a plain fsync allows: the folder is fsynced after each rename. On macOS a plain fsync can leave data in the drive's cache, so a power cut can still lose a recent write there. If the file system refuses the folder fsync, the write still succeeds without this guarantee. Windows is unchanged.
