---
"seekstone": patch
---

On Linux and macOS, a note write that reports success, and the pre-image blob that lets you undo it, now survive a power cut as far as a plain fsync allows: the folder is fsynced after each rename. One gap remains: the history folders and the history manifest aren't folder-synced when they are first created, so a power cut soon after a vault's first journaled write can keep the note and lose its undo history. On macOS a plain fsync can leave data in the drive's cache, so a power cut can still lose a recent write there. If the file system refuses the folder fsync, the write still succeeds without this guarantee. Windows is unchanged.
