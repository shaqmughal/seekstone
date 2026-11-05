---
"seekstone": minor
---

Upgrade the file watcher to chokidar 6. chokidar 6 requires Node.js 22.22 or later, so seekstone's minimum Node version goes from 22 to 22.22. chokidar 6 also fixes two watcher bugs: watching could stop after a watched folder was deleted, and deleted files could be reported as folder removals.
