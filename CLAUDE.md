# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

**seekstone** is an Obsidian MCP server, published to npm as [`seekstone`](https://www.npmjs.com/package/seekstone). The MCP server (`packages/server`) is the product: filesystem-direct vault access with low context-tax, shipped as a built single-file bundle. Alongside it lives the **measurement harness** (`packages/harness`) — a profiler + benchmark + write-safety suite that produced the payload numbers the server is designed around. The harness shares `packages/core` primitives with the server and is dev-only (run from source, not published).

The product story behind the harness (kept in version control because it's how the project will be evaluated): **filesystem-direct beats REST-proxy, and the win is mostly payload size ("context tax"), not raw CPU**. The harness exists to produce reproducible numbers that demonstrate that.

## Commands

Harness commands (profile, bench, scenarios, safety, retrieval, fixture generation) live in `packages/harness/CLAUDE.md`.

The **server** has a real build — `npm run build -w seekstone` bundles it (and `packages/core`) to `dist/index.js` via tsup for publishing. The **harness** has no build step; it runs via `tsx`. `tsc` is used for typecheck only. Tests are co-located as `*.test.ts` next to source.

The **server** reads its own env vars — see the README's Configuration table. Write behavior to know before editing tools: deletes are recoverable (`.trash/`), every write tool supports optional `prevHash` compare-and-swap (moves and deletes included since 0.14.0; every mutating result returns a `contentHash`), moves rewrite inbound links, every write is policy-gated + atomic, and every write tool journals pre-images via `journalWrite` (single-file) or `ctx.journal.begin()` (multi-file: compute all rewrites first, journal them under one `seq`, then write) BEFORE the first vault byte changes so `undo_write` can restore the whole operation; `.seekstone/` is excluded from the walker like `.trash/`; and dispatch audits every write-tool call when `SEEKSTONE_AUDIT_FILE` is set — a new write tool must return an `audit` detail object from its dispatch case (paths/counts only, never content) or its calls are not recorded (see `docs/ARCHITECTURE.md` §2).

## Architecture

For the full picture — package graph, the server's five layers, the end-to-end request flow, and the harness — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (Mermaid diagrams). Keep it in sync when you add a layer, tool, or adapter. Harness internals (Backend interface, profiler, benchmark runner, write-safety, retrieval eval, adding a backend) live in `packages/harness/CLAUDE.md`, loaded when working under that package.

## Conventions

- **Module imports use `.js` extensions** even when importing TS sources — that's what NodeNext + tsx + tsc emit all agree on. `*.ts` extensions in imports require `allowImportingTsExtensions` and are avoided.
- **Never mutate the live vault.** Anything touching writes routes through the safety harness or an adapter pointed at a scratch copy. The CLI's `safety` command enforces this explicitly.

