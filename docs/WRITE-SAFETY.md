# The Seekstone Write-Safety Contract

Seekstone is the filesystem-direct Obsidian MCP server you can safely give write
access. That claim is not marketing copy — it is a set of **ten named
guarantees**, each enforced by specific code and proven by a specific test that
runs in CI on every commit and every release. Claims → proof, in one page.

The end-to-end proof is the harness **write-safety suite**
([`packages/harness/src/safety/`](../packages/harness/src/safety/)): it copies a
vault to a scratch directory (never touching the original — the copy step
refuses same-path or nested destinations), runs nine operations against every
sampled note through the server's own tool handlers, and verifies the outcome
**byte-by-byte on disk**. The committed baseline for the 10,000-note fixture
vault is
[`safety-seekstone.md`](../packages/harness/fixtures/baseline-reports/safety-seekstone.md);
CI regenerates the fs-reference run on every commit and fails on any drift
([`scripts/check-safety-baseline.mjs`](../scripts/check-safety-baseline.mjs)).

## The guarantees

### 1. Zero network, zero telemetry

The **running server makes no outbound network connection of any kind, ever**
— no telemetry, no update checks, no cloud calls. Nothing leaves your machine.
The one piece of networking code in the package is the explicit
`seekstone fetch-model` CLI subcommand (the opt-in semantic-search model
download — SHA-256-pinned files, and it exits before any MCP serving starts);
it never runs during a session, and it uploads nothing.

- Enforced by: the serving path has no networking code; the only runtime deps
  are the MCP SDK, chokidar, fast-glob, minisearch, yaml, zod, picomatch, and
  the only `fetch()` in the package lives in the pre-serving `fetch-model`
  subcommand.
- Proven by: [`no-network.test.ts`](../packages/server/src/no-network.test.ts)
  replaces Node's socket/http/https primitives with throwing stubs, then runs
  the real index build **and all 21 tools** through the real dispatcher —
  including semantic/hybrid search with the semantic index enabled, built,
  and persisting its cache under the stubs. Any connection attempt fails the
  suite.

### 2. Vault sandbox

No tool can read or write **vault files** outside `SEEKSTONE_VAULT`. Every
tool resolves its path and refuses anything that escapes the vault root;
traversal attempts (`../…`) are errors. (With semantic search enabled, the
server also reads the local embedding model and maintains a per-vault
embedding cache under `SEEKSTONE_CACHE_DIR`, default `~/.cache/seekstone` —
derived vectors of your notes, on your machine, documented in the README's
configuration table. No note content is written there in plain text, and no
tool can be pointed at those paths.)

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

### 7. Optional compare-and-swap on every write

`read_note` returns a `contentHash` (sha-256 of the note's disk bytes). Every
content-editing tool — the nine original write tools — accepts `prevHash` and refuse to act — with a structured
`hash_conflict` error carrying the current hash — when the note changed since
it was read, so a concurrent edit is never silently discarded, moved, or
deleted. Every mutating result returns a `contentHash`, so chained edits need
no re-reads: `move_note` returns the hash of the (unchanged) bytes at the new
path, `delete_note` the hash of the deleted content (byte-identical to the
`.trash/` copy when recoverable), and `replace_in_note` returns the unchanged
hash on dry runs and zero-match calls. This is conflict **detection**, not
locking.

- Enforced by: [`content-hash.ts`](../packages/server/src/content-hash.ts),
  checked immediately after the disk read in every write tool.
- Proven by: [`cas.test.ts`](../packages/server/src/tools/cas.test.ts) and the
  harness `cas-conflict` op — a stale-hash write, move, or delete after an
  out-of-band edit must be refused, and the out-of-band edit must survive.

### 8. Write scoping and read-only mode

`SEEKSTONE_READ_ONLY=1` removes the 10 write tools (`undo_write` included)
from `tools/list` entirely (and rejects them at dispatch if a client calls
anyway — including `get_periodic_note`'s create flag); `list_writes` is a read
tool and stays visible. `SEEKSTONE_WRITE_PATHS` restricts writes to
an explicit glob allowlist. Both are enforced at the dispatch layer plus a
shared `assertWritable` in every write handler, so a new tool cannot forget
the check.

- Enforced by: [`policy.ts`](../packages/server/src/policy.ts),
  [`dispatch.ts`](../packages/server/src/dispatch.ts) (`WRITE_TOOLS`),
  [`tool-list.ts`](../packages/server/src/tool-list.ts) (`visibleTools`).
- Proven by: [`policy.test.ts`](../packages/server/src/policy.test.ts),
  [`tool-list.test.ts`](../packages/server/src/tool-list.test.ts), and the
  read-only dispatch tests.

### 9. Every write is reversible

Before any write tool changes a byte, it journals the **pre-image of every
file it is about to touch** under `<vault>/.seekstone/history/` —
content-addressed blobs (identical states are stored once) plus a JSONL
manifest row `{ seq, ts, tool, files: [{ path, preHash, postHash }] }`.
`list_writes` lists the journal; `undo_write` restores byte-identically. A
multi-file `move_note` or `rename_heading` is journaled under one `seq` and
restored whole (the note *and* every link rewrite) or not at all; a
`delete_note` is restored even when it was `permanent: true`. Undo is CAS
against the journal: if a file changed after the journaled write, the undo is
refused with a structured `undo_conflict` (expected/actual hashes and byte
counts) unless `force: true` — and even then the clobbered state is journaled
first. The undo is itself journaled, so `undo_write({ seq })` on an undo entry
redoes it; the default target skips undo entries, so repeated undos walk
backwards through history.

Crash window: the blob **and** the manifest row are fsync'd before the vault
write starts. A crash after the journal commit but before the vault write
leaves an entry whose `postHash` does not match disk — `undo_write` reports
that as a conflict rather than restoring blindly. A journal write failure
aborts the vault write: while the journal is enabled, an unjournalable write
does not proceed. Retention is capped (`SEEKSTONE_HISTORY_MAX_SIZE`, default
50 MB; `SEEKSTONE_HISTORY_MAX_ENTRIES`, default 1000); evicted entries stay
listed with `undoable: false`, never silently dropped. `SEEKSTONE_HISTORY=0`
disables the journal. `.seekstone/` is excluded from indexing and search like
`.trash/`. This complements git and Obsidian's File Recovery — it is the
recovery path the agent itself can drive.

- Enforced by: [`journal.ts`](../packages/server/src/journal.ts) (blob store,
  manifest, retention) called from every write tool before its first disk
  write, and [`undo_write.ts`](../packages/server/src/tools/undo_write.ts)
  (conflict check, all-or-nothing restore, self-journaling).
- Proven by: [`journal.test.ts`](../packages/server/src/journal.test.ts),
  [`undo_write.test.ts`](../packages/server/src/tools/undo_write.test.ts)
  (write → undo → byte-identical for every write tool, multi-file
  all-or-nothing, conflict/force/redo, eviction, journal-failure abort), and
  the harness `undo-roundtrip` op — a write through the server, then
  `undo_write`, must leave the note byte-identical to its original.

### 10. Every write leaves a receipt

With `SEEKSTONE_AUDIT_FILE` set, the dispatcher appends one JSONL record for
**every write-tool call** — successful or refused — after the call completes:
`{ v: 1, ts, tool, outcome, durationMs, seq?, files: [{ path, hashBefore,
hashAfter }], ...opDetail, error? }`. `outcome` is one of `ok`,
`hash_conflict`, `undo_conflict`, `policy_denied`, or `error`, so the trail
shows *attempts*, not just changes — a policy-denied write is exactly what a
user auditing an agent wants to see. The hashes are the same sha-256 values
`read_note` returns as `contentHash`, and `seq` is the journal entry the call
committed, so every record is user-verifiable against the vault and indexes
straight into `list_writes` / `undo_write`. The record shape is versioned
(`v: 1`).

Privacy: records carry paths, hashes, byte counts, replacement/link counts,
and — for `patch_frontmatter` — key **names** only; `error` is a short code
(`heading_not_found`, `not_found`, `invalid_input`, …), never the tool's
message, because messages can quote headings or patterns. Note content,
frontmatter values, and search queries never appear; the file is safe to attach to a bug
report.

Durability: each record is appended and fsync'd **after** the vault write
commits, so a crash loses at most the in-flight record and never touches
earlier ones; a torn trailing line is skipped by `jq -R 'fromjson?'`. The file
rotates to `<file>.1` when the next record would exceed
`SEEKSTONE_AUDIT_MAX_SIZE` (default 10 MB). An unwritable audit path fails
boot, and a failed append turns the (already completed) call into a structured
`audit_failed` error — an unauditable write is never reported as a clean
success.

Non-goals: reads and searches are not audited; there is no tamper-evident hash
chaining yet (a v2 candidate); the sink is a local file only — no network, no
syslog.

- Enforced by: [`audit.ts`](../packages/server/src/audit.ts) (record shape,
  durable append, rotation) and [`dispatch.ts`](../packages/server/src/dispatch.ts)
  — the single choke point every write tool passes through, which emits the
  record and strips each tool's `audit` detail from the MCP result.
- Proven by: [`audit.test.ts`](../packages/server/src/audit.test.ts) and
  [`dispatch-audit.test.ts`](../packages/server/src/dispatch-audit.test.ts)
  (one record per write tool including refused outcomes, read tools emit
  nothing, hashes equal `read_note`'s `contentHash`, sentinel content never
  appears, rotation preserves records, `audit_failed` on an unwritable file).

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
| undo-roundtrip | ✅ 25/25 | — n/a | — n/a | — n/a | — n/a |

<sup>The cas-conflict op was extended on 2026-08-19 to also exercise stale-hash
**move** and **delete** guards (seekstone and the fs reference declare and pass
all three). The competitor rows are unchanged: their reports are dated
snapshots from 2026-08-03, and none of those servers exposed a CAS surface for
the op to drive in the first place.</sup>

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
