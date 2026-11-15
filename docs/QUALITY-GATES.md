# Quality gates

This page lists every check a change to `main` has to get past, what each one guards, and how the factory turns a Linear ticket into a PR under the same rules. The workflow files and scripts named here are the source of truth. If this page and a workflow disagree, the workflow wins and this page needs a fix.

## Required checks

The `main protection (SHA-516)` ruleset blocks a merge until these pass, on a branch that is up to date with `main`:

| Check | Workflow | What it guards |
| --- | --- | --- |
| `test (ubuntu-latest)`, `test (macos-latest)`, `test (windows-latest)` | `ci.yml` | Build, typecheck, `npm test` and lint on all three OSes. The Linux leg runs the extra gates below. |
| `changeset check` | `ci.yml` | A PR touching `packages/server/src/` or `package.json` has a changeset, every changeset names only `seekstone`, and `changeset version` dry-runs cleanly. |
| `Analyze (javascript-typescript)` | `codeql.yml` | CodeQL static analysis. |
| `CodSpeed Performance Analysis` | `codspeed.yml` | No speed regression on the server's hot paths (see [Speed](#speed)). |
| `quality rules` | `quality.yml` | No weakened tests; for `factory` PRs, the scope lock and size limit (see [Quality rules](#quality-rules)). |
| `flaky check (ubuntu-latest)`, `(macos-latest)`, `(windows-latest)` | `quality.yml` | Every test file the PR adds or changes passes 10 runs in a row on each OS. |
| `failing test first` | `quality.yml` | Runs only on PRs labelled both `factory` and `bug`; otherwise it is skipped, which counts as passing. |

No approving review is required by the ruleset. The maintainer's merge is the review.

### Extra gates on the Linux test leg

`test (ubuntu-latest)` also runs, in order:

- `npm run conformance`: the MCP SDK reference client drives the built server (handshake, exact tool surface, a search and append round-trip).
- `node scripts/check-safety-baseline.mjs`: reruns the harness write-safety suite against the committed golden report.
- `node scripts/sync-server-json.mjs --check`: `server.json` version matches the package.
- `node scripts/check-registries-tools.mjs`: the tool list in `docs/REGISTRIES.md` matches the server.
- `node scripts/build-benchmarks-json.mjs --check`: `benchmarks.json` matches the committed harness baselines.
- `npm run harness -- schema-tax --check`: the tool list the built server serves matches the committed schema-tax baseline. A new or changed tool needs a re-measured baseline in the same PR (CONTRIBUTING, "Adding a tool, prompt, or resource").
- `node scripts/check-docs-sync.mjs`: docs agree with the code and every headline figure matches `benchmarks.json`.
- `node scripts/check-action-inputs.mjs`: inputs passed to pinned GitHub Actions exist on the pinned version.
- Coverage gates for server, harness and core, with thresholds in each package's `vitest.config.ts`.

### Coverage on Codecov

`codecov/patch` asks for 80% coverage of the lines a PR changes (`codecov.yml`). It shows red when a PR falls short but it is not a required check, because Codecov doesn't report on every Dependabot PR. The `ignore` list in `codecov.yml` mirrors the coverage excludes in each `vitest.config.ts`; change both together.

## Quality rules

`scripts/quality-rules.mjs` holds the logic and `scripts/check-quality-rules.mjs` runs it in the `quality rules` job. The workflow reruns when labels change, so adding an approval label takes effect without a new push.

On every PR:

- **No weakened tests.** The check fails when a PR deletes a test file, has fewer `it`/`test` declarations in a file than before, or adds `.skip`, `.only`, `.todo`, `.skipIf` or an `x`-prefixed test. Moving a test inside a file is fine. When the weakening is intended, for example a test for a removed feature, a maintainer adds the `tests-weakened:approved` label.
- **Flaky check.** Each test file the PR adds or changes runs 10 times on Linux, macOS and Windows. Run the same loop locally with `node scripts/run-test-files.mjs --times 10 '["path/to/x.test.ts"]'`.

On PRs labelled `factory`:

- **Scope lock.** The PR may not touch `.github/`, any `CLAUDE.md` or `AGENTS.md`, `.claude/`, `biome.json`, `codecov.yml` or `.coderabbit.yaml`. A `package-lock.json` change needs the `dependencies` label.
- **Size limit.** At most 400 changed lines. Lockfiles, `CHANGELOG.md`, `benchmarks.json`, `packages/harness/fixtures/baseline-reports/` and `.changeset/` don't count.
- **Failing test first** (with the `bug` label). CI puts the PR's source files back to the base commit, keeps the new tests and their helpers (stubs, mocks, fixtures), and requires the tests to fail. A bug fix whose test passes without the fix fails the check.

## Speed

Two checks cover speed: one on every PR and one weekly on real hardware.

- **CodSpeed, on every PR.** `codspeed.yml` runs the hot-path benchmarks in `packages/server/src/bench/` (index build, search, read, links, a journaled write) under CPU simulation, which counts instructions instead of timing them, and compares the result with `main`. A regression fails the required check. Run the same benchmarks locally with `npm run bench -w seekstone`; local numbers are plain timings. A new hot path should get a bench case in the same PR.
- **Weekly wall-clock bench, by hand.** CPU simulation leaves out disk I/O and system calls. `node scripts/weekly-bench.mjs` covers them: it keeps its own clone in `~/.local/share/seekstone-weekly-bench` (change with `--state-dir`), checks out `origin/main`, runs the harness benchmark on the committed 10k-note vault, and compares with the previous run. A regression is rerun once, and only regressions the rerun confirms count. Confirmed regressions become a Linear issue in Triage.
  - `SEEKSTONE_BENCH_LINEAR_TEAM`: the Linear team key to file in. Without it nothing is filed.
  - `SEEKSTONE_BENCH_KEYCHAIN`: the macOS Keychain service that holds the Linear API key (default `seekstone-weekly-bench`).
  - `SEEKSTONE_BENCH_PCT` and `SEEKSTONE_BENCH_MIN_MS`: regression thresholds (default 10% and 0.2 ms).
  - `--dry-run` prints what it would file.

  There is no workflow or schedule for it; where it should run is still open (SHA-519).

## Review and supply chain

- **CodeRabbit** reviews every non-draft PR against `main`. Its rules are in `.coderabbit.yaml`, and it also reads `CLAUDE.md`, `AGENTS.md` and `CONTRIBUTING.md`. Its comments are advice; a maintainer decides. It never pushes commits.
- **Harden-Runner** is the first step of every job in every workflow, in audit mode: it records outbound network calls but doesn't block them yet (SHA-517).
- **Pinned actions.** Every action is pinned to a commit SHA, and `check-action-inputs.mjs` checks the inputs against the pinned version.
- **Scorecard** (`scorecard.yml`) runs weekly, on pushes to `main` and on branch protection changes.
- **Releases** run in the protected `release` environment with OIDC trusted publishing to npm, so no npm token exists. See [`RELEASING.md`](RELEASING.md).

## The factory

The factory turns one Linear ticket into a PR with no person at the keyboard. The agent follows the playbook in [`.claude/skills/factory/SKILL.md`](../.claude/skills/factory/SKILL.md), and its PR goes through every check above plus the `factory` rules.

### Starting a run

```bash
gh workflow run factory.yml -f ticket=SHA-123
```

Before any model time is spent, `scripts/factory/factory.mjs prepare` checks that:

- the `FACTORY_ENABLED` repo variable is `"true"` (this is the off switch),
- fewer than 5 PRs labelled `factory` are open,
- the ticket has the `factory` label in Linear and is in **Todo**,
- no unfinished ticket blocks it,
- the ticket passes the readiness check below.

A ticket that fails the readiness check moves to **Blocked** with the problems as a comment. Otherwise it moves to **In Progress**. Runs queue and go one at a time.

### Ticket readiness

Write tickets from the Linear "Factory Ticket" template. `node scripts/factory-ticket.mjs <ticket.md>` passes a ticket when it has a `## Problem` section, a `## Acceptance criteria` section with at least one checklist item, and none of the template's placeholder text left in. The agent then checks that every criterion can be proven by a test or a command, and blocks with a question when one can't.

### Model and labels

The model comes from the ticket's Linear labels: `factory:opus` always gets Opus; `docs` or `chore` without `bug`, `feature` or `improvement` gets Sonnet; everything else gets Opus. The branch is `factory/<ID>-<slug>` from the ticket title. The PR is labelled `factory`, plus `bug` when the ticket has it, which turns on failing test first.

### What each job can reach

| Job | Holds | Does |
| --- | --- | --- |
| `prepare` | Linear key | Runs the gate, writes `ticket.md`, moves the ticket. |
| `work` | Claude Code token only | Runs the playbook. No Linear key, no write token, no web access, no `git push`. Its only output is an artifact with `pr.md` or `blocked.md` and a git bundle. The transcript is kept as an artifact for 14 days. |
| `deliver` | Linear key, factory app token | Pushes the branch and opens the PR as the factory GitHub App, or comments the agent's questions on the ticket and moves it to Blocked. |

### Setup

- A `factory` environment, limited to `main`, with secrets `CLAUDE_CODE_OAUTH_TOKEN`, `LINEAR_API_KEY` and `FACTORY_APP_PRIVATE_KEY`.
- Repo variables `FACTORY_APP_CLIENT_ID` and `FACTORY_APP_SLUG` for the factory GitHub App, which has contents and pull-request read/write on this repo only. PRs are opened as the App because PRs opened with the default token don't trigger CI.
- The repo variable `FACTORY_ENABLED`.
- In Linear: the `factory` label, the Todo, In Progress and Blocked statuses, and the "Factory Ticket" template (SHA-514).
