# Architecture

How seekstone is put together: the packages, the layers inside the MCP server,
how a request flows end-to-end, and how the measurement harness mirrors the
server's surface to produce the benchmark numbers.

> **Scope.** This is a snapshot of the code as it stands. The diagrams below are
> verified against `packages/*/src`. When you add a layer, a tool, or an adapter,
> update the matching diagram here — same "guard against drift" discipline the
> repo already applies to `server.json` and `docs/REGISTRIES.md`.

---

## 1. Workspace / package graph

seekstone is an npm workspace (`packages/*`) of three packages. Only one is
published to npm; the other two are a private primitives library and the
dev-only measurement harness. (A fourth package, the `obsidian-mcp-seekstone`
discovery alias, was published through 0.7.x and is now deprecated on npm.)

```mermaid
flowchart TD
    core["@seekstone/core<br/>(private, never published)<br/>walk · frontmatter · extract<br/>outline · percentiles · pmap"]
    server["seekstone<br/>(packages/server) — THE PRODUCT<br/>filesystem-direct MCP server"]
    harness["@seekstone/harness<br/>(dev-only, runs via tsx, not published)<br/>profiler · bench · safety · fixtures"]

    server -->|"devDep, bundled in via tsup noExternal"| core
    harness -->|"dependency"| core
    harness -.->|"relative import of server/src<br/>(in-process 'seekstone' adapter)"| server

    classDef product fill:#1f6feb,stroke:#0b3d91,color:#fff;
    classDef dev fill:#6e7681,stroke:#30363d,color:#fff;
    class server product;
    class harness,core dev;
```

- **`@seekstone/core`** — pure, dependency-free primitives shared by the server
  and the harness. Exposed as subpath exports (`@seekstone/core/frontmatter`,
  `/extract`, `/outline`, `/walk`, `/percentiles`, `/pmap`). It is **private and
  never published**, so the server's build inlines it (see below).
- **`seekstone`** (`packages/server`) — the product. The only runtime npm
  dependencies are `@modelcontextprotocol/sdk`, `chokidar`, `fast-glob`,
  `minisearch`, `yaml`, and `zod`. `tsup` bundles `src/index.ts` **plus the
  `@seekstone/core` workspace package** into a single self-contained
  `dist/index.js` (ESM, `#!/usr/bin/env node` shebang); the npm deps stay
  external and install normally. This is why `@seekstone/core` is a *devDep*
  with `noExternal: [/^@seekstone\//]` in `tsup.config.ts`.
- **`@seekstone/harness`** — the measurement suite. Runs from source via `tsx`
  (no build step; `tsc` is typecheck-only). It depends on `@seekstone/core` and
  also imports `packages/server/src` **directly** to benchmark the server's own
  tool functions in-process (the `seekstone` adapter).

---

## 2. Server — layered architecture

Inside `packages/server/src`, the server is five layers. State lives in one
`ServerContext` object that the bootstrap builds once and the watcher keeps
fresh; every tool reads from it.

```mermaid
flowchart TD
    subgraph boot["① Bootstrap / entry — index.ts"]
        cliargs["cli-args.ts<br/>version · help · init intents"]
        init["init.ts<br/>setup wizard"]
        guards["process-guards.ts"]
        log["log.ts<br/>structured logger"]
    end

    subgraph idx["② Index layer — index/"]
        build["build.ts<br/>buildIndex(vaultRoot)"]
        doc["doc.ts · excerpt.ts<br/>resolve.ts · types.ts"]
    end

    ctx["③ ServerContext (context.ts)<br/>vaultRoot · index (MiniSearch)<br/>notes Map · backlinks Map"]

    watch["④ Watcher — watcher.ts<br/>chokidar → incremental re-index"]

    subgraph disp["⑤ Dispatch — dispatch.ts"]
        dispatcher["dispatch(): timing · logging · errors<br/>HANDLED_TOOLS (16) → run() switch"]
    end

    subgraph tools["Tools layer — tools/ (16)"]
        reads["READ-ONLY<br/>search · read_note · list_notes<br/>list_tags · outline_note<br/>get_backlinks · get_links · get_periodic_note"]
        writes["WRITES (filesystem-direct)<br/>create_note · delete_note · move_note<br/>append_note · patch_note · patch_frontmatter<br/>replace_in_note · append_periodic_note"]
    end

    vault[("Obsidian vault<br/>(filesystem)")]
    core2["@seekstone/core<br/>frontmatter · extract · outline · walk"]

    boot --> build
    build --> ctx
    build -. uses .-> core2
    ctx --> watch
    watch -. maintains .-> ctx
    boot --> dispatcher
    dispatcher --> reads
    dispatcher --> writes
    reads --> ctx
    writes --> vault
    writes -. uses .-> core2
    reads -. read body .-> vault
    build -. walk .-> vault
    watch -. watch .-> vault
```

**Layer responsibilities**

1. **Bootstrap (`index.ts`)** — the executable entry. Handles `version` / `help`
   / `init` CLI intents (which print and exit before any server starts), then
   for an MCP session: requires `SEEKSTONE_VAULT`, installs process guards
   (a stray unhandled rejection must not kill a long-lived stdio session),
   builds the index, constructs the `ServerContext`, starts the watcher, and
   wires the `@modelcontextprotocol/sdk` `Server` to a `StdioServerTransport`
   with `ListTools` + `CallTool` handlers.
2. **Index layer (`index/`)** — `buildIndex(vaultRoot)` walks the vault, parses
   each note, and returns a `MiniSearch` full-text index, a `notes` map
   (path → `IndexedNote`), and a `backlinks` reverse-link map. This is the
   in-memory model every read tool queries.
3. **`ServerContext` (`context.ts`)** — the single shared state bag:
   `{ vaultRoot, index, notes, backlinks }`. No globals; it's threaded into every
   tool call.
4. **Watcher (`watcher.ts`)** — chokidar watches the vault and incrementally
   updates `index` / `notes` / `backlinks` so the in-memory model never goes
   stale during a session.
5. **Dispatch (`dispatch.ts`)** — the routing seam. `dispatch()` wraps the
   per-tool `run()` switch with `performance.now()` timing, structured logging
   (content/query args are debug-only — never logged at info), payload-byte
   measurement, and uniform error-to-`isError` handling. `HANDLED_TOOLS` is the
   16-name source of truth, kept in sync with the `ListTools` schema.

The **tools** themselves are thin: read tools answer from `ServerContext`
(and read note bodies straight off disk when needed); write tools mutate the
vault filesystem directly, using `@seekstone/core` to preserve frontmatter
byte-for-byte.

---

## 3. Request flow (a `tools/call`)

```mermaid
sequenceDiagram
    autonumber
    participant Client as MCP client<br/>(Claude Desktop, etc.)
    participant SDK as MCP SDK Server<br/>(stdio transport)
    participant D as dispatch()
    participant T as tool handler
    participant Ctx as ServerContext<br/>(index · notes · backlinks)
    participant FS as Vault (filesystem)

    Note over SDK,Ctx: Boot once — buildIndex(vaultRoot) populates ServerContext.<br/>Watcher keeps it fresh thereafter.

    Client->>SDK: CallToolRequest { name, args }
    SDK->>D: dispatch(ctx, name, args, log)
    D->>D: start timer · safe-meta log
    D->>T: run() switch → tool(ctx, args)
    alt read tool (search, read_note, …)
        T->>Ctx: query index / notes / backlinks
        T-->>FS: read note body (only if needed)
    else write tool (append_note, patch_note, …)
        T->>FS: write bytes directly (frontmatter preserved)
    end
    T-->>D: ToolResult { content }
    D->>D: log tool ok { durationMs, resultBytes }
    D-->>SDK: ToolResult
    SDK-->>Client: CallToolResult
```

`ListToolsRequest` is answered directly from the bootstrap's static schema list
(the 16 tools). On error, `dispatch()` catches and returns
`{ isError: true, content: [...] }` rather than throwing — the session stays
alive.

---

## 4. Harness — measurement architecture

The harness is three modules behind one CLI, all speaking the same `Backend`
contract — the same `search / read / write / list` surface the server exposes.
That symmetry is deliberate: it lets every competing Obsidian-MCP approach be
measured against seekstone on equal footing, with **payload bytes captured at
the boundary** as the headline "context tax" metric.

```mermaid
flowchart TD
    cli["CLI — cli.ts (cac)<br/>profile · bench · safety · compare<br/>scale-render · gen-vault · fetch-corpus"]

    backend["Backend contract — bench/backend.ts<br/>search · read · write · list (+ optional tools)<br/>every method → BackendResponse{ result, payloadBytes }"]

    subgraph inproc["In-process adapters"]
        fs["fs<br/>standalone MiniSearch"]
        seek["seekstone<br/>calls server tool fns in-process"]
    end
    subgraph extern["Process / network adapters"]
        rest["rest → Local REST API plugin<br/>(undici, self-signed TLS)"]
        mcp["mcpvault · mcp-obsidian · obsidian-mcp<br/>obsidian-mcp-pro · obsidian-mcp-server<br/>(MCP-over-stdio via McpSubprocess)"]
    end

    subgraph modules["Three measurement modules"]
        profiler["profiler/<br/>walk · classify · aggregate → VaultStats"]
        bench["bench/<br/>runN cold/warm → BenchmarkSummary<br/>report · compare · scaling · timer"]
        safety["safety/<br/>copyVault → runSafety ops → SafetySummary<br/>identity · body-append · fm-edit · patch · replace"]
    end

    fixtures["fixtures/<br/>EB1911 corpus → 10k-note synthetic vault<br/>generate · prng · tags · parse-volume · corpus"]
    reports["reports & committed baselines<br/>*.json + *.md"]

    cli --> profiler
    cli --> bench
    cli --> safety
    cli --> backend
    backend --> inproc
    backend --> extern
    bench --> backend
    safety --> backend
    bench --> reports
    safety --> reports
    profiler --> reports
    fixtures -. generates .-> profiler
    seek -. imports .-> bench
```

- **`Backend` contract** (`bench/backend.ts`) — intentionally tiny:
  `search`, `read`, `write`, `list`, plus optional extended tools
  (`listTags`, `outline`, `getBacklinks`, `getLinks`, `getPeriodicNote`,
  `searchStream`, `close`). Every call returns
  `BackendResponse<T> = { result, payloadBytes, payloadText? }`, so the raw
  bytes a backend served are recorded at the boundary.
- **Adapters** split into **in-process** (`fs`, `seekstone` — zero IPC, the most
  honest measure of seekstone's own algorithms) and **process/network**
  (`rest` over undici; the MCP-over-stdio family sharing one `McpSubprocess`
  transport helper).
- **profiler** walks a vault and aggregates a content-shape `VaultStats`.
- **bench** runs each measurement N times, splitting **cold** (run 1) from
  **warm** (runs 2..N) so a cheap warm number can't hide a brutal cold start,
  and renders per-adapter + cross-adapter (`compare`) + multi-scale (`scaling`)
  reports.
- **safety** copies the vault to a scratch dir and round-trips write ops,
  proving frontmatter stays byte-identical.
- **fixtures** generate the committed, personal-data-free 10k-note synthetic
  vault from the public-domain 1911 Encyclopædia Britannica (deterministic,
  seed 42 — hence the custom `prng`, since `Math.random()` is banned harness-wide).

---

## 5. The thesis: filesystem-direct vs REST-proxy

The whole project exists to demonstrate one claim: **filesystem-direct beats the
REST-proxy approach, and the win is mostly payload size ("context tax"), not raw
CPU.** This is the shape the harness measures.

```mermaid
flowchart LR
    agent["LLM agent"]

    subgraph seekpath["seekstone — filesystem-direct"]
        direction TB
        s1["in-process MCP server"]
        s2["in-memory index (MiniSearch)<br/>+ direct file reads"]
        s3["slim payload<br/>~200-char ranked excerpts,<br/>not whole notes"]
        s1 --> s2 --> s3
    end

    subgraph restpath["REST-proxy — the common approach"]
        direction TB
        r1["MCP server"]
        r2["HTTP round-trip → Obsidian<br/>Local REST API plugin"]
        r3["fat payload<br/>full-note JSON, plugin envelope"]
        r1 --> r2 --> r3
    end

    vault[("Obsidian vault")]

    agent --> s1
    agent --> r1
    s2 --> vault
    r2 --> vault
    s3 -->|"low context tax ✅"| agent
    r3 -->|"high context tax ❌"| agent

    classDef good fill:#1a7f37,stroke:#0b3d91,color:#fff;
    classDef bad fill:#cf222e,stroke:#82071e,color:#fff;
    class s3 good;
    class r3 bad;
```

seekstone needs **no running Obsidian instance and no plugin** — it reads the
vault directly and returns only what the agent needs. The REST-proxy path
requires Obsidian open with the Local REST API plugin, and tends to return
whole-note payloads through an HTTP envelope. The harness quantifies the gap;
the committed baseline reports under
[`packages/harness/fixtures/baseline-reports/`](../packages/harness/fixtures/baseline-reports)
are the receipts.

---

## The 16 tools

| Tool | Kind | Purpose |
| --- | --- | --- |
| `search` | read | Ranked full-text search; returns ~200-char excerpts, not full notes |
| `read_note` | read | Read a note (with optional outline/frontmatter metadata) |
| `list_notes` | read | Enumerate notes, optionally by folder |
| `list_tags` | read | All tags with usage counts |
| `outline_note` | read | Heading tree + block anchors, no body |
| `get_backlinks` | read | Reverse-link lookup for a note |
| `get_links` | read | Outgoing wikilinks/embeds of a note |
| `get_periodic_note` | read | Resolve today's / a given date's periodic note |
| `create_note` | write | Create a new note |
| `delete_note` | write | Delete a note |
| `move_note` | write | Move/rename a note |
| `append_note` | write | Append to a note body |
| `patch_note` | write | Targeted body edit by heading/block |
| `patch_frontmatter` | write | Edit frontmatter, preserving key order/comments |
| `replace_in_note` | write | Find/replace within a note |
| `append_periodic_note` | write | Append to today's / a given date's periodic note |

The list is mirrored in `dispatch.ts` (`HANDLED_TOOLS`) and the `ListTools`
schema in `index.ts`; `docs/REGISTRIES.md` carries the same count and a CI guard
keeps them in sync.
