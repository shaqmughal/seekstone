# Security Policy

## Supported versions

Seekstone is pre-1.0. Fixes are applied to the latest published version on npm. Please make sure you're on the most recent release before reporting an issue.

## Reporting a problem

Please report security-sensitive issues **privately** — do not open a public issue for them.

- Preferred: open a [GitHub Security Advisory](https://github.com/shaqmughal/seekstone/security/advisories/new) (Security → Advisories → Report).

Please include the version, your environment (OS, Node version), and steps to reproduce. We aim to acknowledge a report within a few days and will keep you updated as we work on a fix.

## What Seekstone can and cannot do

Seekstone is designed to be conservative with your data. The published server:

- **Reads and writes only under `SEEKSTONE_VAULT`.** It does not touch files outside the vault directory you configure (the one optional exception is a log file, only if you set `SEEKSTONE_LOG_FILE`).
- **Makes no outbound network connections and collects no telemetry.** Indexing and search run entirely on your machine.
- **Only modifies your vault through explicit tool calls** (`create_note`, `delete_note`, `move_note`, `append_note`, `patch_frontmatter`). It never makes background edits.
- **Preserves file fidelity on writes.** Frontmatter edits keep key order, quote style, and comments; body appends leave the frontmatter region byte-identical. Writes are atomic (write-to-temp then rename).

`delete_note` permanently removes a file and cannot be undone — treat it accordingly.

## Logs and privacy

Logging is metadata-only by default (tool name, vault-relative paths, timings). Note contents and raw query text are only included at the `debug` log level, which you opt into via `SEEKSTONE_LOG_LEVEL=debug`. Logs are written to stderr, and to a file only if you set `SEEKSTONE_LOG_FILE`. Nothing is ever sent off-device.

## A note on the benchmark harness

The dev-only harness (`packages/harness`, not published) includes an adapter for the Obsidian Local REST API plugin, which ships a self-signed certificate. That adapter trusts the certificate through an isolated HTTP agent scoped to that one client — it never disables TLS verification globally (it does not set `NODE_TLS_REJECT_UNAUTHORIZED`). This affects the harness only, not the published server.
