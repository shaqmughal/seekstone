---
"@seekstone/core": patch
---

Fix two ReDoS vulnerabilities in wikilink and URL regexes flagged by CodeQL (`js/polynomial-redos`). Wikilink/embed regexes now bound each capturing group at 512 chars, eliminating O(n²) backtracking on crafted inputs. URL trailing-punct strip replaces the unbounded `[.,;:!?)]+$` regex with a linear backward walk.
