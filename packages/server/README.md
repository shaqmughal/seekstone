# seekstone

**The Obsidian MCP server that needs no plugin, no running Obsidian app — and doesn't blow your context window.**

Seekstone is an Obsidian MCP server that gives Claude (and any [Model Context Protocol](https://modelcontextprotocol.io) client) direct read and write access to your Obsidian vault. No Obsidian app needs to be running, no plugins are required, and nothing leaves your machine.

It reads your vault **directly from disk** instead of routing through the Obsidian Local REST API plugin, and holds a warm full-text index in-process. The practical difference: keyword searches return in **single-digit milliseconds** (semantic search in **~14 ms**) with **~2 KB payloads** that stay flat as your vault grows — a broad query that costs tens of megabytes of context through a REST-proxy server (up to **95 MB** at 10k notes) costs ~2 KB through Seekstone, up to a **~47,000× reduction**. Benchmarked against 7 other Obsidian MCP servers across committed 1k/5k/10k-note vaults — [fully reproducible](https://github.com/shaqmughal/seekstone/tree/main/packages/harness), full results at [seekstone.dev/benchmarks](https://seekstone.dev/benchmarks).

(Previously also published as `obsidian-mcp-seekstone` — that alias is deprecated; existing installs keep working, but install `seekstone` going forward.)

[![Install in Claude Desktop](https://img.shields.io/badge/Install_in-Claude_Desktop-D97757?style=for-the-badge&logo=anthropic&logoColor=white)](https://github.com/shaqmughal/seekstone/releases/latest/download/seekstone.mcpb) [![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=seekstone&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInNlZWtzdG9uZSJdLCJlbnYiOnsiU0VFS1NUT05FX1ZBVUxUIjoiL2Fic29sdXRlL3BhdGgvdG8veW91ci92YXVsdCJ9fQ%3D%3D) [![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Server-0098FF?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://vscode.dev/redirect?url=vscode:mcp/install?%7B%22name%22%3A%22seekstone%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22seekstone%22%5D%2C%22env%22%3A%7B%22SEEKSTONE_VAULT%22%3A%22%2Fabsolute%2Fpath%2Fto%2Fyour%2Fvault%22%7D%7D)

---

## Install

Choose the method that suits you best.

### Using an AI agent? Paste this prompt

If you use Claude Code, Cursor, or another coding agent, paste this prompt and the agent does the install:

> Install the **seekstone** MCP server for this editor. Run `npx -y seekstone init --client code --write` (use `desktop`, `cursor`, or `vscode` for other clients). It auto-detects my Obsidian vault; if it lists several, ask me which one and re-run with `--vault "<path>"`. Relay any errors to me, then tell me to restart this session so the seekstone tools load.

### Option 1 — One-click (Claude Desktop, no terminal needed)

Download `seekstone.mcpb` from [GitHub Releases](https://github.com/shaqmughal/seekstone/releases/latest), double-click it in Claude Desktop, and pick your Obsidian vault folder when prompted. No JSON editing, no terminal, no Node.js setup required.

### Option 2 — Guided setup (recommended for CLI users)

Run the setup helper and let Seekstone find your vault automatically:

```bash
npx -y seekstone init
```

Seekstone reads Obsidian's own vault registry to detect your vault, validates it, and either prints the config to paste or patches the client config directly:

```bash
# Auto-detect vault, print config to paste
npx -y seekstone init

# Auto-detect vault, patch Claude Desktop in place (with backup)
npx -y seekstone init --write

# Specify vault explicitly if you have multiple
npx -y seekstone init --vault "/path/to/vault"

# Auto-configure Claude Code / Cursor / VS Code in one step
npx -y seekstone init --client code --write
npx -y seekstone init --client cursor --write
npx -y seekstone init --client vscode --write
```

### Option 3 — Manual config (Claude Desktop)

Add to `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "seekstone": {
      "command": "npx",
      "args": ["-y", "seekstone"],
      "env": { "SEEKSTONE_VAULT": "/absolute/path/to/your/vault" }
    }
  }
}
```

### Option 4 — Claude Code

```bash
claude mcp add seekstone --env SEEKSTONE_VAULT=/absolute/path/to/your/vault -- npx -y seekstone
```

### Option 5 — Cursor

One-click via the [Install in Cursor](https://cursor.com/install-mcp?name=seekstone&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInNlZWtzdG9uZSJdLCJlbnYiOnsiU0VFS1NUT05FX1ZBVUxUIjoiL2Fic29sdXRlL3BhdGgvdG8veW91ci92YXVsdCJ9fQ%3D%3D) link above (then set `SEEKSTONE_VAULT` to your vault path), or let the CLI auto-detect your vault:

```bash
npx -y seekstone init --client cursor --write
```

Or add the Option 3 JSON block to `~/.cursor/mcp.json`.

### Option 6 — VS Code

One-click via the [Install in VS Code](https://vscode.dev/redirect?url=vscode:mcp/install?%7B%22name%22%3A%22seekstone%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22seekstone%22%5D%2C%22env%22%3A%7B%22SEEKSTONE_VAULT%22%3A%22%2Fabsolute%2Fpath%2Fto%2Fyour%2Fvault%22%7D%7D) link above (then set `SEEKSTONE_VAULT` to your vault path), or from the terminal:

```bash
code --add-mcp '{"name":"seekstone","command":"npx","args":["-y","seekstone"],"env":{"SEEKSTONE_VAULT":"/absolute/path/to/your/vault"}}'
```

Or auto-detect and write the workspace config:

```bash
npx -y seekstone init --client vscode --write
```

Other MCP clients (Windsurf, Cline, …) take the Option 3 JSON block in their own MCP config file.

---

## Tools

21 tools: 11 read, 10 write.

### Read

| Tool | Description |
|---|---|
| `search` | Full-text search. Returns ranked excerpts (default ~120 chars, tunable via `excerptLength`), not full notes. Fuzzy and prefix matching; with `SEEKSTONE_SEMANTIC=1`, `mode: "semantic"`/`"hybrid"` searches by meaning via a local embedding model (nothing leaves your machine). |
| `query_notes` | Structured metadata query. Filter by frontmatter key/value predicates (`eq`, `ne`, `contains`, `exists`, `missing`, `gt`/`gte`/`lt`/`lte`), tag, folder, modified time, and size; sort and select the fields you need. Returns compact rows, not note content. |
| `context_pack` | Answer-ready context for a natural-language question in one call, hard-capped at a byte budget (default 2 KB): ranked excerpts, linked neighbor notes with one-line summaries, and follow-up source paths — replaces a search → read → get_backlinks round-trip loop. |
| `read_note` | Read the full content of a note by vault-relative path. Supports returning a single section, block, or line range. |
| `list_notes` | List notes, optionally filtered by folder prefix or tag. |
| `list_tags` | List all tags in the vault sorted by usage count (or alphabetically). |
| `outline_note` | Return a note's heading and block structure without its full content. |
| `get_backlinks` | Find all notes that link to a given note. |
| `get_links` | List all outgoing wikilinks and markdown links from a note. |
| `get_periodic_note` | Read a daily/weekly/monthly/quarterly/yearly note — path resolved from your vault config, no Obsidian required. |
| `list_writes` | Recent writes from the journal — seq, timestamp, tool, touched paths, and whether each is still undoable. Metadata only, never note content. |

### Write

| Tool | Description |
|---|---|
| `create_note` | Create a note (optional frontmatter + body); parent dirs created automatically. Never clobbers an existing note unless you pass `overwrite: true`. |
| `delete_note` | Move a note to the vault's `.trash/` folder (Obsidian-compatible, restorable). Pass `permanent: true` to skip the trash — the write journal still lets `undo_write` restore it. |
| `move_note` | Move/rename a note — wikilinks and markdown links in other notes that point at it are rewritten so nothing breaks; destination dirs created automatically. |
| `rename_heading` | Rename a heading in a note — every `[[note#heading]]` wikilink and embed across the vault is rewritten so references keep working (aliases preserved, fenced code blocks left alone). |
| `append_note` | Append to a note body without touching frontmatter. |
| `patch_frontmatter` | Set/update/delete frontmatter keys without reordering existing keys or changing quote style. |
| `patch_note` | Append, prepend, or replace text at a heading or block reference (`createIfMissing` to add the section) — frontmatter untouched. |
| `replace_in_note` | Find and replace text in the note body — literal or regex, whole-word, case sensitivity, optional `limit` (replaces **all** occurrences by default), dry-run preview. |
| `append_periodic_note` | Append to today's periodic note, creating it from a template if it doesn't yet exist. |
| `undo_write` | Revert a journaled write: every file it touched goes back to its byte-identical pre-write state (a multi-file move or heading rename is restored whole; a delete is restored even if it was `permanent`). Defaults to the most recent write; refuses with `undo_conflict` if a file changed since, unless `force: true`. The undo is itself journaled — `undo_write({ seq })` on the undo entry redoes it. |

Every write tool (`append_note`, `patch_note`, `patch_frontmatter`, `replace_in_note`, `rename_heading`, `move_note`, `delete_note`, `append_periodic_note`, and `create_note` with `overwrite: true`) supports optional **compare-and-swap**: pass the `contentHash` you got from `read_note` as `prevHash` and the call fails cleanly if the note changed underneath you — no silently discarded concurrent edit, no moving or deleting content you haven't seen. Every mutating result returns the new `contentHash`, so chained edits need no re-reads.

---

## Configuration

| Env var | Required | Description |
|---|---|---|
| `SEEKSTONE_VAULT` | yes | Absolute path to your Obsidian vault. |
| `SEEKSTONE_LOG_LEVEL` | no | `error` \| `warn` \| `info` (default) \| `debug`. |
| `SEEKSTONE_LOG_FILE` | no | Absolute path; when set, JSON-line logs are appended here (size-rotated). |
| `SEEKSTONE_WATCH_POLL` | no | Set to `1` to stat-poll for changes instead of native OS events — reliable on network drives, WSL, containers. |
| `SEEKSTONE_WATCH_POLL_INTERVAL` | no | Stat-poll interval in ms (default `10000`). Only used with `SEEKSTONE_WATCH_POLL=1`. Lower = faster pickup of external edits, higher CPU. |
| `SEEKSTONE_LOG_MAX_SIZE` | no | Log-rotation threshold for `SEEKSTONE_LOG_FILE` (e.g. `10mb`; default 5 MB). |
| `SEEKSTONE_READ_ONLY` | no | Set to `1` to run read-only: the 10 write tools are unregistered entirely (and rejected if called anyway), so the session provably cannot modify your vault. |
| `SEEKSTONE_WRITE_PATHS` | no | Comma-separated vault-relative globs (e.g. `journal/**,inbox/*.md`). Writes are permitted only under matching paths; the rest of the vault stays read-only. |
| `SEEKSTONE_HISTORY` | no | Set to `0` to disable the write journal (default on). With it on, every write tool stores the pre-image of each file it touches under `<vault>/.seekstone/history/` so `undo_write` can restore it byte-for-byte. |
| `SEEKSTONE_HISTORY_MAX_SIZE` | no | Cap on stored pre-images (e.g. `100mb`; default 50 MB). Oldest entries are evicted first and then show `undoable: false` in `list_writes` — never silently. |
| `SEEKSTONE_HISTORY_MAX_ENTRIES` | no | Cap on journal entries (default `1000`); the oldest are dropped past it. |
| `SEEKSTONE_AUDIT_FILE` | no | Absolute path; off unless set. Appends one JSON-line audit record per write-tool call — ok or refused — with the tool, paths, sha-256 before/after, outcome, and op metadata. Never note content. |
| `SEEKSTONE_AUDIT_MAX_SIZE` | no | Rotate the audit file to `<file>.1` past this size (e.g. `10mb`; default 10 MB). |
| `SEEKSTONE_SEMANTIC` | no | Set to `1` to enable semantic search (`search` gains `mode: "semantic"` and `"hybrid"`). Download the local model once with `npx -y seekstone fetch-model`; the running server never touches the network. |
| `SEEKSTONE_SEMANTIC_MODEL` | no | `potion-base-8M` (default, ~30 MB) or `potion-retrieval-32M` (~129 MB, more accurate, ~2× query latency). Fetch it first: `npx -y seekstone fetch-model --model potion-retrieval-32M`. |
| `SEEKSTONE_MODEL_PATH` | no | Directory holding the Model2Vec embedding model (default: where `fetch-model` puts the selected model). |
| `SEEKSTONE_CACHE_DIR` | no | Cache root for the model and per-vault embedding caches (default `~/.cache/seekstone`). |

---

## Write safety

Giving an AI write access to your notes deserves more than "trust us." Seekstone ships the [Write-Safety Contract](https://github.com/shaqmughal/seekstone/blob/main/docs/WRITE-SAFETY.md): **ten named guarantees, each linked to the code that enforces it and the test that proves it**, verified byte-by-byte in CI on every commit and release — zero network, vault sandbox, byte-identical frontmatter on body edits, atomic writes, no-clobber creates, recoverable deletes, optional compare-and-swap, write scoping / read-only mode, a write journal that makes every write reversible, and an opt-in audit log that gives every write a hash-verifiable receipt.

**Every write is reversible.** Before any write tool changes a byte, it journals the pre-image of every file it is about to touch under `<vault>/.seekstone/history/` — content-addressed (identical states are stored once) and fsync'd before the vault write commits. `list_writes` shows the journal; `undo_write` restores byte-identically: a multi-file `move_note` or `rename_heading` is restored whole (the note *and* every link rewrite), and a `delete_note` comes back even if it was `permanent`. An undo after an external edit is refused with a structured `undo_conflict` unless you pass `force: true` — and even then the clobbered state is journaled first, so nothing is ever lost. Undo is itself journaled: repeated default undos walk backwards through the history, and `undo_write({ seq })` on an undo entry redoes it. `.seekstone/` is excluded from indexing and search like `.trash/`; add it to your vault's `.gitignore`. This complements git and Obsidian's File Recovery rather than replacing them — it is the recovery path the *agent* can drive.

**Every write leaves a receipt.** Set `SEEKSTONE_AUDIT_FILE` and every write-tool call — successful *or refused* — appends one JSON line: tool, vault-relative paths, sha-256 before/after, outcome (`ok`, `hash_conflict`, `undo_conflict`, `policy_denied`, `error`), and op metadata such as replacement counts or the `.trash/` destination — never note content, frontmatter values, or search queries, so the file is safe to attach to a bug report.

```jsonl
{"v":1,"ts":"2026-08-29T21:02:11.042Z","tool":"replace_in_note","outcome":"ok","durationMs":1.8,"seq":42,"files":[{"path":"notes/a.md","hashBefore":"3f9c…","hashAfter":"b71e…"}],"path":"notes/a.md","replacements":3}
```

The hashes are the same `contentHash` values `read_note` returns, so any record can be checked against the vault; `seq` is the journal entry the call committed, so a row indexes straight into `list_writes` / `undo_write`. Records are appended and fsync'd after the vault write commits, the file rotates to `<file>.1` past `SEEKSTONE_AUDIT_MAX_SIZE`, an unwritable audit path fails boot, and a failed append reports the call as a structured `audit_failed` error rather than a clean success. A few `jq` recipes:

```bash
jq -r '[.tool, .outcome] | @tsv' audit.jsonl | sort | uniq -c            # session summary by tool + outcome
jq -c 'select(.files[]?.path == "notes/a.md")' audit.jsonl              # history of one note
jq -c 'select(.ts > "2026-08-29T21:00:00Z" and .outcome == "ok")' audit.jsonl   # what changed since a timestamp
```

---

## Frequently asked questions

**Does the Obsidian app need to be running?**
No — Seekstone reads the vault folder from disk directly.

**Do I need the Local REST API plugin?**
No — Seekstone bypasses it entirely (that's the source of the up-to-~47,000× payload reduction).

**How does `seekstone init` find my vault automatically?**
It reads Obsidian's own vault registry (`obsidian.json`) — the same file Obsidian uses to track your known vaults. One vault → auto-selected. Multiple → lists them and asks you to pick with `--vault`.

**What is the `.mcpb` file?**
An MCP Bundle — a zip containing the server and its manifest. Claude Desktop installs it with a double-click, no terminal required.

**Which AI clients does it support?**
Any MCP-over-stdio client: Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, Continue, and others.

**Does it work on Windows?**
Yes — tested on macOS, Linux, and Windows in CI on every commit.

**Is it safe?**
No network calls while running, no telemetry (the optional semantic-search model is downloaded once by the explicit `fetch-model` subcommand, SHA-256-verified, before any serving starts). The vault path is sandboxed — no tool reads or writes outside it. Writes are covered by the tested Write-Safety Contract above, and `SEEKSTONE_READ_ONLY=1` removes the write tools entirely.

---

## Requirements

- Node.js ≥ 22 (for CLI install options; the `.mcpb` bundle has no external requirements)
- macOS, Linux, or Windows

---

## License

MIT © Shaq Mughal · [seekstone.dev](https://seekstone.dev) · [GitHub](https://github.com/shaqmughal/seekstone) · [Issues](https://github.com/shaqmughal/seekstone/issues)
