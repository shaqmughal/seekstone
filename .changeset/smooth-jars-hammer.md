---
'seekstone': patch
---

Stop folding long frontmatter scalars. `create_note` and `patch_frontmatter` passed no
`lineWidth` to the YAML serializer, so values past 80 columns were wrapped across lines with a
trailing `\`. The output is valid YAML and round-trips, but link extraction runs per line, so a
wikilink split that way became invisible to the backlink index, `get_links` and `context_pack` —
a patch touching one key could silently drop a link declared under another.
