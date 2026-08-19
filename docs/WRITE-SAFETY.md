# The Seekstone Write-Safety Contract

Seekstone is the filesystem-direct Obsidian MCP server you can safely give write
access. That claim is not marketing copy — it is a set of **eight named
guarantees**, each enforced by specific code and proven by a specific test that
runs in CI on every commit and every release. Claims → proof, in one page.

The end-to-end proof is the harness **write-safety suite**
([`packages/harness/src/safety/`](../packages/harness/src/safety/)): it copies a
vault to a scratch directory (never touching the original — the copy step
refuses same-path or nested destinations), runs eight operations against every
sampled note through the server's own tool handlers, and verifies the outcome
**byte-by-byte on disk**. The committed baseline for the 10,000-note fixture
vault is
[`safety-seekstone.md`](../packages/harness/fixtures/baseline-reports/safety-seekstone.md);
CI regenerates the fs-reference run on every commit and fails on any drift
([`scripts/check-safety-baseline.mjs`](../scripts/check-safety-baseline.mjs)).

## The guarantees

### 1. Zero network, zero telemetry

Seekstone makes **no outbound network connection of any kind, ever** — no
telemetry, no update checks, no cloud calls. Nothing leaves your machine.

- Enforced by: there is simply no networking code; the only runtime deps are
  the MCP SDK, chokidar, fast-glob, minisearch, yaml, zod, picomatch.
- Proven by: [`no-network.test.ts`](../packages/server/src/no-network.test.ts)
  replaces Node's socket/http/https primitives with throwing stubs, then runs
  the real index build **and all 18 tools** through the real dispatcher. Any
  connection attempt fails the suite.

### 2. Vault sandbox

No tool can read or write outside `SEEKSTONE_VAULT`. Every tool resolves its
path and refuses anything that escapes the vault root; traversal attempts
(`../…`) are errors.

- Enforced by: the path-containment guard in every tool handler.
- Proven by: per-tool traversal tests (e.g.
  [`create_note.test.ts`](../packages/server/src/tools/create_note.test.ts),
  [`move_note.test.ts`](../packages/server/src/tools/move_note.test.ts)).

### 3. Frontmatter preserved byte-for-byte on body edits

Body-editing tools (`append_note`, `patch_note`, `replace_in_note`) never touch
the frontmatter region — not re-serialized, not re-quoted, not re-ordered:
byte-identical. `patch_frontmatter` edits values through a CST-preserving YAML
parser, so untouched keys keep their order, quotes, and comments (and since
0.12.1, serialization passes `lineWidth: 0`, so long values are never re-folded
across lines).

- Enforced by: byte-offset frontmatter handling (`parseFrontmatter` reports
  `bodyStart` as an offset) plus post-write re-read verification in
  `patch_note`/`replace_in_note`.
- Proven by: the harness `identity`, `body-append`, `patch-note`, and
  `replace-in-note` ops ([`ops.ts`](../packages/harness/src/safety/ops.ts)) —
  byte-region equality assertions on the re-read file. The `fm-edit` op asserts
  body-untouched, key-order preservation, and that every original frontmatter
  line not owned by the patched key appears byte-identically, in order, in the
  post-write file — so a serializer that re-quotes or re-folds an untouched
  value fails the op even though the YAML still parses to the same data (the
  only line allowed to differ is the patched key's own).

### 4. Atomic writes — no torn files

Every write goes through one shared temp-file-plus-rename helper
([`atomic-write.ts`](../packages/server/src/atomic-write.ts)). A crash
mid-write leaves either the old content or the new content on disk, never a
truncated file. (`move_note`'s file relocation and `delete_note`'s move-to-`.trash/` are
atomic renames rather than temp-file writes; `move_note`'s link rewrites in
referencing notes are each individually atomic. This is per-file crash-safety,
not a multi-file transaction.)

- Proven by: [`atomic-write.test.ts`](../packages/server/src/atomic-write.test.ts)
  and every write-tool test asserting exact post-write bytes.

### 5. Creates never clobber

`create_note` on an existing path fails with an actionable error unless
`overwrite: true` is passed explicitly; `move_note` refuses an existing
destination the same way.

- Proven by: overwrite tests in the tool suites and the harness
  `create-no-clobber` op — a create-shaped call against an existing note must
  error and leave the bytes untouched.

### 6. Deletes are recoverable

`delete_note` moves the note to the vault's `.trash/` folder
(Obsidian-compatible; restore by moving it back) instead of unlinking it, and
reports where it went. `permanent: true` is the explicit opt-out.

- Proven by: [`delete_note.test.ts`](../packages/server/src/tools/delete_note.test.ts)
  and the harness `recoverable-delete` op — after a delete, a byte-identical
  copy must exist in a recoverable location.

### 7. Optional compare-and-swap on edits

`read_note` returns a `contentHash` (sha-256 of the note's disk bytes). Edit
tools accept `prevHash` and refuse to write — with a structured
`hash_conflict` error carrying the current hash — when the note changed since
it was read, so a concurrent edit is never silently discarded. Every
content-editing result returns the new hash, so chained edits need no re-reads
(`move_note` and `delete_note` don't participate in hash chaining — re-read
after them). This is conflict **detection**, not locking.

- Enforced by: [`content-hash.ts`](../packages/server/src/content-hash.ts),
  checked immediately after the disk read in every edit tool.
- Proven by: [`cas.test.ts`](../packages/server/src/tools/cas.test.ts) and the
  harness `cas-conflict` op — a stale-hash write after an out-of-band edit
  must be refused, and the out-of-band edit must survive.

### 8. Write scoping and read-only mode

`SEEKSTONE_READ_ONLY=1` removes the 8 write tools from `tools/list` entirely
(and rejects them at dispatch if a client calls anyway — including
`get_periodic_note`'s create flag). `SEEKSTONE_WRITE_PATHS` restricts writes to
an explicit glob allowlist. Both are enforced at the dispatch layer plus a
shared `assertWritable` in every write handler, so a new tool cannot forget
the check.

- Enforced by: [`policy.ts`](../packages/server/src/policy.ts),
  [`dispatch.ts`](../packages/server/src/dispatch.ts) (`WRITE_TOOLS`),
  [`tool-list.ts`](../packages/server/src/tool-list.ts) (`visibleTools`).
- Proven by: [`policy.test.ts`](../packages/server/src/policy.test.ts),
  [`tool-list.test.ts`](../packages/server/src/tool-list.test.ts), and the
  read-only dispatch tests.

## How other servers compare

Same suite, same committed 10k-note fixture vault, 25 sampled notes per run,
verified byte-by-byte on disk. *Skipped* means the server does not expose the
capability through its tool surface — the capability matrix, not a failure.
Full per-server reports live in
[`fixtures/baseline-reports/`](../packages/harness/fixtures/baseline-reports/).

| Op | seekstone | fs (reference) | obsidian-mcp-rs | mcpvault | obsidian-mcp-pro |
| --- | --- | --- | --- | --- | --- |
| identity round-trip | ✅ 25/25 | ✅ 25/25 | ✅ 25/25 | ✅ 25/25 | ✖ refused† |
| body-append (FM untouched) | ✅ 25/25 | ✅ 25/25 | ✅ 25/25 | ✅ 25/25 | ✖ refused† |
| fm-edit (key order kept) | ✅ 25/25 | ✅ 25/25 | ✅ 25/25 | ✅ 25/25 | ✖ refused† |
| patch-note | ✅ 25/25 | ✅ 25/25 | ✅ 25/25 | ✅ 25/25 | ✖ refused† |
| replace-in-note | ✅ 25/25 | ✅ 25/25 | ✅ 25/25 | ✅ 25/25 | ✖ refused† |
| recoverable-delete | ✅ 25/25 | ✅ 25/25 | ✅ 25/25 | — n/a | — n/a |
| create-no-clobber | ✅ 25/25 | ✅ 25/25 | ✅ 25/25 | — n/a | ✅ 25/25 |
| cas-conflict | ✅ 25/25 | ✅ 25/25 | — n/a | — n/a | — n/a |

<sup>† obsidian-mcp-pro exposes no whole-file update tool — its `create_note`
refuses existing paths, so the byte-edit ops cannot be exercised through its
generic write surface at all. Protective (no note was ever corrupted), but
whole-note updates are simply unavailable; its partial-edit tools were not
driven by this suite. — n/a = the server does not expose the capability
(no delete / create / CAS surface in its tools). **obsidian-mcp**
(StevenStavrakis) is absent because its synchronous startup indexing does not
complete within this suite's 5-minute init budget on the 10k-note vault. (It
does appear in the scaling benchmark, whose per-run patience is higher.) REST-proxy servers need a live Obsidian
session and are not part of this headless table.</sup>

**obsidian-tc** (the governance platform) is absent for a structural reason:
overwriting a non-empty note through its write tool demands interactive human
confirmation (MCP elicitation) even with a correct CAS token, so the suite
cannot run unattended against it at default settings. Its read envelope also
returns note content twice. Governance by friction; the guarantees above hold
with three env flags and no ceremony.

## Reproduce it

```bash
npm install
npm run harness -- safety --backend seekstone \
  --vault "$PWD/packages/harness/fixtures/vault" \
  --out reports
```

Point `--backend` at `fs`, `obsidian-mcp`, `obsidian-mcp-pro`,
`obsidian-mcp-rs`, or `mcpvault` to rerun any comparison row headlessly.
