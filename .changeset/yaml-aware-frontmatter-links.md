---
"seekstone": patch
---

YAML-aware frontmatter link extraction: wikilinks split across lines by scalar folding (hand edits, other tools, or files written by pre-0.12.1 versions) now extract correctly into the backlink index, `get_links`, and `context_pack`. The frontmatter block is parsed as YAML and its string values walked, instead of regexing raw lines; malformed frontmatter falls back to the previous per-line behavior. Links inside multi-line scalars are attributed to the line where the scalar begins, and YAML keys are no longer scanned for links.
