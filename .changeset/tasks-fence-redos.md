---
"seekstone": patch
---

Fix a slow regular expression in checkbox-task scanning (`list_tasks`, `update_task`). A note with a very long line of tabs inside a code block could make the scan take minutes. It now runs in linear time.
