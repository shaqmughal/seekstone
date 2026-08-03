---
"seekstone": minor
---

Add `context_pack` — one-call, byte-budgeted context assembly for answering a question about the vault. Returns ranked excerpts (with inline scalar frontmatter), backlink/outlink neighbor notes with one-line summaries, and overflow source refs for follow-up reads, all hard-capped at a caller-set byte budget (default 2048, never exceeded). Replaces the search → read → get_backlinks round-trip loop with a single payload, and reports explicit `totalMatches` + `confidence` so an empty or thin pack is never mistaken for coverage.
