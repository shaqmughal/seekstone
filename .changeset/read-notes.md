---
"seekstone": minor
---

New `read_notes` tool: read up to 20 notes (or sections, blocks, or line ranges of them) in one call instead of repeated `read_note` calls. A `budgetBytes` cap (default 16 KB) bounds the total note text: when exceeded, each note is cut to a fair share at a UTF-8 boundary and marked `truncated`. Each item returns exactly what `read_note` would, including `contentHash`, and a failing item (missing path, unknown section) returns its own error without failing the batch.
