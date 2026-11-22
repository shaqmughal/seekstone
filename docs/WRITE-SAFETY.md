# The Seekstone Write-Safety Contract

Seekstone is the filesystem-direct Obsidian MCP server you can safely give write
access. That claim is not marketing copy — it is a set of **ten named
guarantees**, each enforced by specific code and proven by a specific test that
runs in CI on every commit and every release. Claims → proof, in one page.

The end-to-end proof is the harness **write-safety suite**
([`packages/harness/src/safety/`](../packages/harness/src/safety/)): it copies a
vault to a scratch directory (never touching the original — the copy step
refuses same-path or nested destinations), runs ten operations against every
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
it never runs during a session, and it uploads nothing. The
`seekstone-semantic.mcpb` bundle variant needs no download at all: it ships
the model inside the extension and reassembles it from disk at boot, verified
against the same pinned SHA-256 hashes.

- Enforced by: the serving path has no networking code; the only runtime deps
  are the MCP SDK, chokidar, fast-glob, minisearch, yaml, zod, picomatch, and
  the only `fetch()` in the package lives in the pre-serving `fetch-model`
  subcommand.
- Proven by: [`no-network.test.ts`](../packages/server/src/no-network.test.ts)
  replaces Node's socket/http/https primitives with throwing stubs, then runs
  the real index build **and all 26 tools** through the real dispatcher —
  including semantic/hybrid search with the semantic index enabled, built,
  and persisting its cache under the stubs, plus the semantic bundle's
  disk-only model reassembly. Any connection attempt fails the suite.

### 2. Vault sandbox

No tool can read or write **vault files** outside `SEEKSTONE_VAULT`. Every
tool resolves its path and refuses anything that escapes the vault root;
traversal attempts (`../…`) are errors. (With semantic search enabled, the
server also reads the local embedding model and maintains a per-vault
embedding cache under `SEEKSTONE_CACHE_DIR`, default `~/.cache/seekstone` —
derived vectors of your notes, on your machine, documented in the README's
configuration table. No note content is written there in plain text, and no
tool can be pointed at those paths.)

Not guaranteed: the guard checks the path as written and does not resolve
symlinks. If you put a symlink inside the vault that points outside it, a
tool given a path through it reaches the target: reads see the target file,
and a write through a symlinked folder lands outside the vault. (A write to a
symlinked file replaces the link with a regular file in the vault, because
the atomic write renames over it.) The index walk doesn't follow symlinks, and
no tool can create one. (Tracked as SHA-575.)

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
([`atomic-write.ts`](../packages/server/src/atomic-write.ts)). It writes the
temp file, fsyncs it, closes it, and only then renames it over the note, so
the new bytes are on disk before the rename can be. A crash or power loss
mid-write leaves either the old content or the new content, never an empty or
truncated file. (`move_note`'s file relocation and `delete_note`'s move-to-`.trash/` are
atomic renames rather than temp-file writes; `move_note`'s link rewrites in
referencing notes are each individually atomic. This is per-file crash-safety,
not a multi-file transaction.)

Not guaranteed: that the rename itself survives a power loss. The directory
entry is not fsynced after the rename, so after a power cut the note can
still hold its old content even though the write returned. It is never torn
either way. (Tracked as SHA-576.)

Each write uses its own temp file next to the note, named
`.<note>.<process tag><counter>.seekstone-tmp` and created exclusively. Two
writers on the same note never share a temp file, and a failed write only
removes the temp file it created. If a crash leaves one behind, it stays out
of the vault: the leading dot hides it from Obsidian and the file watcher, and
the index walk never treats the `.seekstone-tmp` extension as a note.

- Proven by: [`atomic-write.test.ts`](../packages/server/src/atomic-write.test.ts)
  (the open, write, sync, close, rename order; a failed sync keeps the old
  note; one exclusive temp file per call) and every write-tool test asserting
  exact post-write bytes.

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
reports where it went. `permanent: true` is the explicit opt-out. `move_note`
accepts a source inside `.trash/` so the note can be moved back, even though
`.trash/` is otherwise closed to write tools (see §8). `undo_write` can undo
that restore, which puts the note back in `.trash/`.

- Proven by: [`delete_note.test.ts`](../packages/server/src/tools/delete_note.test.ts)
  and the harness `recoverable-delete` op — after a delete, a byte-identical
  copy must exist in a recoverable location.

### 7. Optional compare-and-swap on writes

`read_note` returns a `contentHash` (sha-256 of the note's disk bytes). Ten
write tools accept `prevHash`: `create_note`, `append_note`, `patch_note`,
`patch_frontmatter`, `replace_in_note`, `rename_heading`, `move_note`,
`delete_note`, `append_periodic_note` and `update_task`. When the note changed
since it was read, they refuse with a structured `hash_conflict` error that
carries the current hash, so a concurrent edit the check detects is never
silently discarded, moved, or deleted (see the window below). `create_note` takes `prevHash` only with `overwrite: true`,
since a fresh create has no earlier version. Two writes have no `prevHash`:
`undo_write`, which checks every file against the journal instead (see §9),
and the note `get_periodic_note` creates when it is missing, which by
definition has no earlier version to compare. Every mutating result returns a `contentHash`, so chained edits need
no re-reads: `move_note` returns the hash of the (unchanged) bytes at the new
path, `delete_note` the hash of the deleted content (byte-identical to the
`.trash/` copy when recoverable), and `replace_in_note` returns the unchanged
hash on dry runs and zero-match calls. This is conflict **detection**, not
locking: the hash is checked against the bytes the tool reads just before it
writes, and the note is not locked in between, so an outside edit that lands
in that window is overwritten. For `move_note`, `prevHash` guards the source
note only. With `overwrite: true`, an existing destination is replaced without
a hash check; the journal keeps its old content, so `undo_write` can bring it
back.

- Enforced by: [`content-hash.ts`](../packages/server/src/content-hash.ts),
  checked immediately after the disk read in each of those ten tools.
- Proven by: [`cas.test.ts`](../packages/server/src/tools/cas.test.ts),
  [`rename_heading.test.ts`](../packages/server/src/tools/rename_heading.test.ts)
  and the harness `cas-conflict` op — a stale-hash write, move, or delete after
  an out-of-band edit must be refused, and the out-of-band edit must survive.
  `append_periodic_note`'s `prevHash` check has no test of its own yet.

### 8. Path scoping and read-only mode

`SEEKSTONE_READ_ONLY=1` removes the 11 write tools (`undo_write` included)
from `tools/list` entirely (and rejects them at dispatch if a client calls
anyway — including `get_periodic_note`'s create flag). `list_writes` is a read
tool and stays listed, but the journal is not opened in read-only mode, so it
returns `disabled: true` and no entries: write history can't be browsed while
the server is read-only. `SEEKSTONE_WRITE_PATHS` restricts writes to an
explicit glob allowlist.

Only read-only mode is enforced at dispatch. `SEEKSTONE_WRITE_PATHS`, the read
scope and the reserved folders below are checked inside each write tool, by a
call to the shared `assertWritable` before the tool reads or writes the path.
Nothing in the code forces a new tool to make that call; tests catch a tool
that doesn't. `reserved-paths.test.ts` drives every tool in `WRITE_TOOLS` at
`.seekstone/` and `.trash/` and fails if one is missing from its cases, and
`read-scope.test.ts` drives every write tool at a hidden path. Both fail for a
tool that skips `assertWritable`. A new tool must also be added to
`WRITE_TOOLS`, which `dispatch-audit.test.ts` checks by pinning the list of
read tools.

Two top-level folders are closed to every write tool, whatever the policy
allows: `.seekstone/`, which holds the write journal, and `.trash/`, which
holds deleted notes. Without this an agent could overwrite or delete its own
undo history. The check runs in `assertWritable` on the normalized path, so
`notes/../.seekstone/x`, an absolute path into the vault, a different case
(`.Trash/`) and a folder name with trailing dots or spaces are refused too.
Only the first path segment counts, so `notes/.trash/x.md` stays writable.
`move_note` checks both ends, with one exception: its source may be inside
`.trash/`, because moving a deleted note back out is how it is restored. Its
destination may not be in `.trash/`, and neither end may be in `.seekstone/`.
`delete_note`'s own move into `.trash/` is internal and skips the check.
`undo_write` may write into `.trash/` when the path comes from the journal
entry it is undoing, so undoing a restore puts the note back in `.trash/`. The
caller never supplies those paths, and an entry that names `.seekstone/` is
still refused. A refusal is audited as
`policy_denied` with `policy: "reserved_path"`. The check reads the path as
written and does not follow symlinks, like `containVaultPath`: a
symlink the user creates inside the vault that points into `.seekstone/` is
not caught. The `SEEKSTONE_WRITE_PATHS` and `SEEKSTONE_READ_PATHS` globs are
matched the same way, so a symlink inside an allowed folder can route a write
to a folder the globs exclude. No tool can create a symlink. (Tracked as SHA-575.)

`SEEKSTONE_READ_PATHS` hides everything outside its globs (a leading `!`
excludes, so `!Journal/**` means everything except `Journal/`). Hidden files
are never walked, indexed, embedded or watched, so search, listings, tags,
tasks, links and backlinks never see them, and a link to one resolves like a
link to nothing. Every tool that reads a file by path goes through
`resolveVaultPath`, which answers for a hidden file with the same ENOENT error
a missing file gets, so a hidden note can't be told apart from a nonexistent
one. A path is writable only if it is also readable; writes are checked before
the path is resolved, so a refused write reveals nothing about what exists.
Write-history entries that touched a hidden path are left out of `list_writes`
and reported as not found by `undo_write` (they stay in the journal and come
back if the scope is widened). Two consequences to know: moving a visible note
does not rewrite links inside hidden notes, since that would write to files the
agent can't see, and a periodic-note template outside the scope is treated as
missing (boot logs a warning for this and for write globs that reach outside
the read scope).

- Enforced by: [`policy.ts`](../packages/server/src/policy.ts),
  [`dispatch.ts`](../packages/server/src/dispatch.ts) (`WRITE_TOOLS`),
  [`tool-list.ts`](../packages/server/src/tool-list.ts) (`visibleTools`),
  [`vault-path.ts`](../packages/server/src/vault-path.ts) (`resolveVaultPath`),
  [`index/build.ts`](../packages/server/src/index/build.ts) and
  [`watcher.ts`](../packages/server/src/watcher.ts).
- Proven by: [`policy.test.ts`](../packages/server/src/policy.test.ts),
  [`reserved-paths.test.ts`](../packages/server/src/tools/reserved-paths.test.ts)
  (every write tool against `.seekstone/` and `.trash/`, the `move_note`
  restore, and delete then undo),
  [`tool-list.test.ts`](../packages/server/src/tool-list.test.ts), the
  read-only dispatch tests,
  [`read-scope.test.ts`](../packages/server/src/read-scope.test.ts) (every
  tool, hidden vs missing, links, journal, watcher),
  [`path-guard.test.ts`](../packages/server/src/tools/path-guard.test.ts)
  (no tool reads a file without the guard), and the harness `read-scope`
  check, which boots the built server and greps every response for a marker
  planted in a hidden note
  ([`read-scope-seekstone.md`](../packages/harness/fixtures/baseline-reports/read-scope-seekstone.md)).

### 9. Every write is reversible

Before any write tool changes a byte, it journals the **pre-image of every
file it is about to touch** under `<vault>/.seekstone/history/` —
content-addressed blobs (identical states are stored once) plus a JSONL
manifest row `{ seq, ts, tool, files: [{ path, preHash, postHash }] }`.
`list_writes` lists the journal; `undo_write` restores byte-identically. A
multi-file `move_note` or `rename_heading` is journaled under one `seq`, and
its undo restores every file in it (the note *and* every link rewrite); a
`delete_note` is restored even when it was `permanent: true`. Undo is CAS
against the journal: before writing anything, it checks every file in the
entry, and if any one changed after the journaled write, the whole undo is
refused with a structured `undo_conflict` (expected/actual hashes and byte
counts) unless `force: true` — and even then the clobbered state is journaled
first. Only that check is all-or-nothing. The restore itself writes the files
one at a time, so a failure partway through (a full disk, say) can leave some
files restored and others not. The undo's own journal entry, which holds
every file's state from before the undo, is committed before the first file is
written, so that state can still be put back. It does not hold the original
write's pre-images. Committing it can evict the original entry under the
retention caps, and if that happened, the files not yet restored can't be
taken back to their pre-write state through the journal. Undoing a partial
undo reports `undo_conflict` for the files that weren't restored; `force: true`
is safe once those conflicts have been checked. The undo is itself
journaled, so `undo_write({ seq })` on an undo entry
redoes it; the default target skips undo entries, so repeated undos walk
backwards through history.

Crash window: the blob **and** the manifest row are fsync'd before the vault
write starts. A crash after the journal commit but before the vault write
leaves an entry whose `postHash` does not match disk — `undo_write` reports
that as a conflict rather than restoring blindly. A journal write failure
aborts the vault write: while the journal is enabled, an unjournalable write
does not proceed. Retention has two caps, and they evict differently. Over
`SEEKSTONE_HISTORY_MAX_SIZE` (default 50 MB of stored pre-images), the oldest
entries' pre-images are deleted but their rows stay, listed with
`undoable: false`; the entry just committed is never evicted this way. Over
`SEEKSTONE_HISTORY_MAX_ENTRIES` (default 1000), the oldest rows are deleted
from the manifest along with their pre-images, so they no longer appear in
`list_writes` and `undo_write` reports them as not found. `SEEKSTONE_HISTORY=0`
disables the journal. `.seekstone/` is excluded from indexing and search like
`.trash/`. Several server processes can share one journal: each manifest change
holds `.seekstone/history/manifest.lock`, and a waiting process removes that
lock only when its owner's pid on the same host has exited (or, where that
can't be checked, when the lock file is over 30 seconds old). A live owner
keeps the lock however long it pauses. Two limits follow: if a crashed lock
holder's pid is reused by another process, writes fail after 60 seconds with an
error that names the lock file; and a lock held from another host is reclaimed
after 30 seconds, even if its owner is only paused. Before deleting the lock
file by hand, stop every seekstone server that shares the vault: a server that
is still running may have taken the lock again in the meantime. This
complements git and Obsidian's File Recovery — it is the recovery path the
agent itself can drive.

- Enforced by: [`journal.ts`](../packages/server/src/journal.ts) (blob store,
  manifest, retention) called from every write tool before its first disk
  write, and [`undo_write.ts`](../packages/server/src/tools/undo_write.ts)
  (conflict check over every file before any write, self-journaling before
  the restore).
- Proven by: [`journal.test.ts`](../packages/server/src/journal.test.ts),
  [`undo_write.test.ts`](../packages/server/src/tools/undo_write.test.ts)
  (write → undo → byte-identical for every write tool, a conflict on one
  file of a multi-file entry refuses the whole undo, conflict/force/redo,
  eviction, journal-failure abort),
  [`journal-multiprocess.test.ts`](../packages/server/src/journal-multiprocess.test.ts)
  (shared journal, lock takeover and waiting) and
  [`journal-short-write.test.ts`](../packages/server/src/journal-short-write.test.ts)
  (short and failed manifest writes), and the harness `undo-roundtrip` op — a
  write through the server, then `undo_write`, must leave the note
  byte-identical to its original. `journal.test.ts` covers both caps: the
  byte cap marks rows `undoable: false`, and the entry cap drops rows and
  compacts the manifest. No test forces a failure partway through a restore.

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
earlier ones; a torn trailing line is skipped by `jq -R 'fromjson?'`. The
append doesn't check for a short write (tracked in SHA-580): one can leave a
partial line while the call reports success, the next record is then appended
to that line, and `jq -R 'fromjson?'` skips both. So the parsed file is not
guaranteed to be a complete trail. The file rotates to `<file>.1` when the next record would exceed
`SEEKSTONE_AUDIT_MAX_SIZE` (default 10 MB). The path is used as given: a
relative path resolves against the server's working directory, which the MCP
client chooses, so use an absolute path. An unwritable audit path fails
boot, and a failed append turns the (already completed) call into a structured
`audit_failed` error — an unauditable write is never reported as a clean
success. If the call itself succeeded, its write has already happened; a
refused call (a read-only rejection, say) wrote nothing. A call that returned
`audit_failed` may or may not have a record in the audit file, and a missing
record doesn't prove the write didn't happen. The write journal still has the
entry of a write that happened, when the journal is on.

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
| task-toggle | ✅ 25/25 | ✅ 25/25 | — n/a | — n/a | — n/a |

<sup>The cas-conflict op was extended on 2026-08-19 to also exercise stale-hash
**move** and **delete** guards (seekstone and the fs reference declare and pass
all three). The competitor rows are unchanged: their reports are dated
snapshots from 2026-08-03, and none of those servers exposed a CAS surface for
the op to drive in the first place. The task-toggle op (SHA-285) was added in
2026-10: it seeds a checkbox, toggles it through the server's `update_task`,
requires the post-file to differ at **exactly one byte**, then requires a wrong
`expectText` to be refused with the file untouched. The same dated-snapshot
caveat applies to its competitor columns — none of those servers exposed a
line-guarded task-toggle surface for the op to drive.</sup>

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
