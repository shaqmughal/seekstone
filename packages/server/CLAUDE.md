# Server (packages/server)

The published `seekstone` MCP server. Repo-wide rules are in the root `CLAUDE.md`; the layer diagram and request flow are in `docs/ARCHITECTURE.md`.

The server reads its own env vars; the README's Configuration table lists them.

## Write tools

Every rule here protects someone's notes. Tests enforce most of them, but read them before you touch a write path.

- **Check the policy first.** Call `assertWritable` (`policy.ts`) before resolving the path.
- **Journal before the first byte changes.** One file: `journalWrite`. Several files: work out every rewrite first, journal them all under one `ctx.journal.begin()` `seq`, then write. A write that lands before its journal entry can't be undone by `undo_write`.
- **Write atomically.** Use `atomicWrite` (`atomic-write.ts`), never a bare `writeFile` on a vault path.
- **Compare-and-swap.** Every write tool takes an optional `prevHash` (moves and deletes included) and returns a `contentHash`.
- **Deletes are recoverable** (moved to `.trash/`), and **moves rewrite inbound links**.
- **Update the index through the helpers.** `upsertDoc`, `removeDoc`, `replaceDoc` and `refreshCachedNote` in `index/doc.ts`, and the `index/backlinks.ts` helpers, bump `ctx.generation`, which `list_tags`, `vault_stats` and `get_links` cache by. A direct `ctx.notes`/`ctx.backlinks` `set` or `delete` elsewhere serves stale results, and `index/index-guard.test.ts` fails on it.
- **Audit.** A write tool's dispatch case in `dispatch.ts` returns an `audit` detail object with paths and counts only, never note content. Without it, calls aren't recorded when `SEEKSTONE_AUDIT_FILE` is set. See `docs/ARCHITECTURE.md` §2.
- `.seekstone/` and `.trash/` are excluded from the walker.
- **Reserved folders.** `assertWritable` refuses any path whose first segment is `.seekstone` or `.trash` (case-insensitive, after normalization). Pass `ctx.vaultRoot` as its third argument so absolute paths are caught too. Two callers pass `'.trash'` as the `allow` argument: `move_note` for its source, so a deleted note can be restored by moving it back, and `undo_write` for the journal entry's paths, so a restore can be undone. Don't pass it for any other agent-supplied path. `delete_note`'s internal move into `.trash/` doesn't go through the check.

## Reads

- Every tool that reads a file by path goes through `resolveVaultPath` (`vault-path.ts`). That is how `SEEKSTONE_READ_PATHS` hides files consistently; the index hides them too. `tools/path-guard.test.ts` enforces it.
- **Symlinks** (`symlinks.ts`). `resolveVaultPath` and `assertWritable` (when given `ctx.vaultRoot`) check where a path really lands: a link out of the vault is refused unless `SEEKSTONE_FOLLOW_SYMLINKS=1`, a dangling one always, and the scopes and reserved folders run again on a real path inside the vault. The fast path is one `lstat` per segment, so don't add a second pass. The index walk and the watcher never follow symlinks.

## Adding a tool, prompt or resource

Every tool costs context in every session, called or not. A PR that adds one must include (SHA-341; CONTRIBUTING.md has the detail):

1. A task in `packages/harness/queries/tasks.json` that the addition answers in fewer tokens than the existing tools, with before and after numbers from `npm run harness -- scenarios`.
2. The schema-tax delta: `npm run build -w seekstone`, then `npm run harness -- schema-tax --out packages/harness/fixtures/baseline-reports` and `npm run build:benchmarks`. Commit both outputs and fix any README figure `npm run check:docs` flags.

CI's `schema-tax --check` fails when any served name, description or schema differs from the committed baseline, so even a one-word description edit needs the regenerate step. That includes `.describe()` text on input schemas.

## Speed

`src/bench/` holds the CodSpeed hot-path benchmarks (index build, search, read, links, journaled write). They run on every PR and fail it on a regression. A new hot path gets a bench case in the same PR.
