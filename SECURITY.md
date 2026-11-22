# Security Policy

## Supported versions

Seekstone is pre-1.0. Fixes are applied to the latest published version on npm. Please make sure you're on the most recent release before reporting an issue.

## Reporting a problem

Please report security-sensitive issues **privately** — do not open a public issue for them.

- Preferred: open a [GitHub Security Advisory](https://github.com/shaqmughal/seekstone/security/advisories/new) (Security → Advisories → Report).

Please include the version, your environment (OS, Node version), and steps to reproduce. We aim to acknowledge a report within a few days and will keep you updated as we work on a fix.

## What Seekstone can and cannot do

Seekstone is designed to be conservative with your data. The published server:

- **Reads and writes only under `SEEKSTONE_VAULT`.** Every tool handler resolves its path through a shared containment guard with a proper directory-boundary check. It does not touch files outside the vault directory you configure, with these optional exceptions: if you set `SEEKSTONE_LOG_FILE` or `SEEKSTONE_AUDIT_FILE`, that file and its single size-rotation sibling `<file>.1` are written at that path; if you set `SEEKSTONE_INSTRUCTIONS` to a path outside the vault, that file is read once at boot; and with `SEEKSTONE_SEMANTIC=1`, the server reads the local embedding model and maintains a per-vault embedding cache (vectors derived from your notes — never sent anywhere) under `SEEKSTONE_CACHE_DIR`, default `~/.cache/seekstone`. The guard checks the path as written and doesn't resolve symlinks, so a symlink you put inside the vault that points outside it is followed. The `SEEKSTONE_WRITE_PATHS` and `SEEKSTONE_READ_PATHS` globs are matched the same way.
- **Makes no outbound network connections while running, and collects no telemetry.** Indexing and search — including semantic search — run entirely on your machine. The one network path in the package is the explicit `seekstone fetch-model` subcommand, which downloads the optional embedding model (URLs and SHA-256 hashes pinned in the source; a checksum mismatch aborts) and exits before any serving starts. It uploads nothing, and the running server never invokes it.
- **Only modifies your vault through explicit tool calls** — the 11 write tools: `create_note`, `delete_note`, `move_note`, `rename_heading`, `append_note`, `patch_note`, `patch_frontmatter`, `replace_in_note`, `append_periodic_note`, `update_task`, `undo_write`. Every one of them journals the pre-image of each file it touches under `<vault>/.seekstone/history/` first, so `undo_write` can restore it byte-for-byte (`SEEKSTONE_HISTORY=0` disables the journal). One read tool has a documented write side effect: `get_periodic_note` creates the periodic note when `createIfMissing` is set (neutralized in read-only mode). It never makes background edits.
- **Can be locked down further.** `SEEKSTONE_READ_ONLY=1` runs the server read-only — the 11 write tools are removed from the advertised tool list entirely and rejected at dispatch if called anyway. `SEEKSTONE_WRITE_PATHS` (comma-separated vault-relative globs, e.g. `journal/**,inbox/*.md`) restricts writes to matching paths while the rest of the vault stays read-only. Read-only mode is enforced at dispatch. The write-path scope is checked inside each write tool by a shared `assertWritable` call; nothing in the code forces a new tool to make it, but tests drive every write tool at refused paths and fail if one doesn't. That same check refuses any write into `.seekstone/` (the write journal) or `.trash/` (deleted notes), so an agent can't overwrite or delete its own undo history; the exceptions are moving a note out of `.trash/` to restore it, and `undo_write` putting a note back into `.trash/` when the journal entry it is undoing says it was there. `SEEKSTONE_READ_PATHS` (same glob syntax; a leading `!` excludes, e.g. `!Journal/**`) hides everything outside it: those files are never indexed or watched, and every tool that reads a file by path goes through one helper that answers for a hidden file exactly as for a missing one. Writes are limited to the read scope too. `npm run harness -- read-scope` boots the built server with a folder hidden, calls every tool, and checks that a marker planted in the hidden note never appears in a response.
- **Leaves a receipt for every write.** With `SEEKSTONE_AUDIT_FILE` set, every write-tool call — including ones refused by policy or compare-and-swap — appends one JSON-line record (tool, paths, sha-256 before/after, outcome, op metadata; never note content) fsync'd after the vault write commits. An unwritable audit file fails boot and a failed append surfaces as a structured `audit_failed` error, so an unauditable write never passes silently.
- **Detects concurrent edits.** Every read returns a `contentHash`; every write tool except `undo_write`, `move_note` and `delete_note` included, accepts an optional `prevHash` and fails with a structured `hash_conflict` error instead of silently overwriting, moving, or deleting a concurrent change it detects (compare-and-swap). The check runs just before the write and doesn't lock the note, so an edit that lands in between is overwritten without a conflict. `undo_write`'s journal check works the same way. `create_note` accepts `prevHash` only with `overwrite: true`, and `move_note`'s guards the source note, not an existing destination it replaces with `overwrite: true`. `undo_write` checks every file against the journal instead and refuses with `undo_conflict`.
- **Preserves file fidelity on writes.** Frontmatter edits keep key order, quote style, and comments; body appends leave the frontmatter region byte-identical. Writes are atomic: each goes to a temp file, which is fsynced before it is renamed over the note.

`delete_note` moves the note to the vault's `.trash/` folder by default (Obsidian-compatible — restore by moving it back with `move_note`). Pass `permanent: true` for an unrecoverable delete. The full, tested write-safety guarantees are documented in [docs/WRITE-SAFETY.md](docs/WRITE-SAFETY.md).

## How releases are built

- **npm publishes use OIDC trusted publishing.** No npm token exists. The release job runs in a protected `release` environment that only `main` can use, and every npm version carries provenance.
- **The `.mcpb` bundles have a SLSA build-provenance attestation.** Check one with `gh attestation verify seekstone.mcpb --repo shaqmughal/seekstone`.
- **CI is locked down.** Every action is pinned to a commit SHA, every job starts with Harden-Runner (it currently logs outbound network calls without blocking them), and CodeQL and OpenSSF Scorecard run on `main`. Dependabot keeps dependencies and actions current.

[`docs/QUALITY-GATES.md`](docs/QUALITY-GATES.md) has the full list of checks.

## Logs and privacy

Logging is metadata-only by default (tool name, vault-relative paths, timings). Note contents and raw query text are only included at the `debug` log level, which you opt into via `SEEKSTONE_LOG_LEVEL=debug`. Logs are written to stderr, and to a file only if you set `SEEKSTONE_LOG_FILE`. Nothing is ever sent off-device.

## A note on the benchmark harness

The dev-only harness (`packages/harness`, not published) includes an adapter for the Obsidian Local REST API plugin, which ships a self-signed certificate. That adapter trusts the certificate through an isolated HTTP agent scoped to that one client — it never disables TLS verification globally (it does not set `NODE_TLS_REJECT_UNAUTHORIZED`). This affects the harness only, not the published server.
