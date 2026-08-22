# Security Policy

## Supported versions

Seekstone is pre-1.0. Fixes are applied to the latest published version on npm. Please make sure you're on the most recent release before reporting an issue.

## Reporting a problem

Please report security-sensitive issues **privately** — do not open a public issue for them.

- Preferred: open a [GitHub Security Advisory](https://github.com/shaqmughal/seekstone/security/advisories/new) (Security → Advisories → Report).

Please include the version, your environment (OS, Node version), and steps to reproduce. We aim to acknowledge a report within a few days and will keep you updated as we work on a fix.

## What Seekstone can and cannot do

Seekstone is designed to be conservative with your data. The published server:

- **Reads and writes only under `SEEKSTONE_VAULT`.** Every tool handler resolves its path through a shared containment guard with a proper directory-boundary check. It does not touch files outside the vault directory you configure, with two optional exceptions: if you set `SEEKSTONE_LOG_FILE`, the log file and its single size-rotation sibling `<file>.1` are written at that path; and with `SEEKSTONE_SEMANTIC=1`, the server reads the local embedding model and maintains a per-vault embedding cache (vectors derived from your notes — never sent anywhere) under `SEEKSTONE_CACHE_DIR`, default `~/.cache/seekstone`.
- **Makes no outbound network connections while running, and collects no telemetry.** Indexing and search — including semantic search — run entirely on your machine. The one network path in the package is the explicit `seekstone fetch-model` subcommand, which downloads the optional embedding model (URLs and SHA-256 hashes pinned in the source; a checksum mismatch aborts) and exits before any serving starts. It uploads nothing, and the running server never invokes it.
- **Only modifies your vault through explicit tool calls** — the 9 write tools: `create_note`, `delete_note`, `move_note`, `rename_heading`, `append_note`, `patch_note`, `patch_frontmatter`, `replace_in_note`, `append_periodic_note`. One read tool has a documented write side effect: `get_periodic_note` creates the periodic note when `createIfMissing` is set (neutralized in read-only mode). It never makes background edits.
- **Can be locked down further.** `SEEKSTONE_READ_ONLY=1` runs the server read-only — the 9 write tools are removed from the advertised tool list entirely and rejected at dispatch if called anyway. `SEEKSTONE_WRITE_PATHS` (comma-separated vault-relative globs, e.g. `journal/**,inbox/*.md`) restricts writes to matching paths while the rest of the vault stays read-only. Both are enforced at the dispatch layer plus a shared per-handler check, so a new tool cannot forget them.
- **Guards against lost updates.** Every read returns a `contentHash`; every write tool — including `move_note` and `delete_note` — accepts an optional `prevHash` and fails with a structured `hash_conflict` error instead of silently overwriting, moving, or deleting a concurrent change (compare-and-swap).
- **Preserves file fidelity on writes.** Frontmatter edits keep key order, quote style, and comments; body appends leave the frontmatter region byte-identical. Writes are atomic (write-to-temp then rename).

`delete_note` moves the note to the vault's `.trash/` folder by default (Obsidian-compatible — restore by moving it back). Pass `permanent: true` for an unrecoverable delete. The full, tested write-safety guarantees are documented in [docs/WRITE-SAFETY.md](docs/WRITE-SAFETY.md).

## Logs and privacy

Logging is metadata-only by default (tool name, vault-relative paths, timings). Note contents and raw query text are only included at the `debug` log level, which you opt into via `SEEKSTONE_LOG_LEVEL=debug`. Logs are written to stderr, and to a file only if you set `SEEKSTONE_LOG_FILE`. Nothing is ever sent off-device.

## A note on the benchmark harness

The dev-only harness (`packages/harness`, not published) includes an adapter for the Obsidian Local REST API plugin, which ships a self-signed certificate. That adapter trusts the certificate through an isolated HTTP agent scoped to that one client — it never disables TLS verification globally (it does not set `NODE_TLS_REJECT_UNAUTHORIZED`). This affects the harness only, not the published server.
