---
name: prd
description: Write or upgrade a Seekstone PRD from a Linear issue (e.g. SHA-290) or a feature idea, using docs/PRD_TEMPLATE.md and the repo's admission bar, write-safety and docs-sync gates. Use before implementing any new tool, prompt, resource, or user-facing behavior.
argument-hint: "<SHA-XX | feature idea>"
---

# /prd

Turns a Linear issue or a feature idea into an execution-ready PRD in the shape of
[`docs/PRD_TEMPLATE.md`](../../../docs/PRD_TEMPLATE.md), then stores it as the
issue's description. The template is the format. This skill is the process for
filling it in so the result holds up against the repo's real gates.

## 1. Gather context

For a Linear issue (`$ARGUMENTS` looks like `SHA-123`):

- Read the issue (`get_issue`), its comments (`list_comments`) and relations
  (blocks, blocked-by, duplicates). Read the parent epic too. Its description
  sets the strategic lens.
- Keep everything already decided. Merged-duplicate notes, acceptance criteria
  and constraints in the old description carry over into the new PRD. Don't
  drop them.
- Find sibling PRDs this one depends on or feeds (for example `vault_stats`
  shows counts that `find_orphans` computes) and link them in §13.

For a feature idea, search Linear for an existing issue first (`list_issues`
with `query`). If one exists, use it. If not, ask before creating one.

## 2. Ground it in the code

Every claim about the codebase names a real file or symbol, and you check each
one before writing it:

- What already exists. Read `packages/server/src/tool-list.ts` and the
  relevant `packages/server/src/tools/*.ts`. The index likely already holds the
  data (link graph, tags, mtimes). Say which structure the tool reads from.
- Overlap. Find the closest existing tool. If a parameter on it would do the
  job, the PRD proposes that instead of a new tool (CONTRIBUTING.md: "If no
  task shows a win, the capability probably belongs as a parameter on an
  existing tool").
- For write tools, read `docs/WRITE-SAFETY.md` and one existing write tool of
  the same shape (one file: `patch_note.ts`; several files: `move_note.ts`).

## 3. Draft against the template

Fill every section of `docs/PRD_TEMPLATE.md`. If a section doesn't apply, write
`N/A: <reason>`. These sections must not be thin:

- **§5 Surface / contract.** The exact zod-style input schema and the output
  shape, with a realistic example response. Keep descriptions short: every
  word in a tool description is schema tax, paid in every session.
- **§7 Surfaces table.** Keep only the rows that apply.
- **§8 Acceptance criteria.** Binary and testable. Include at least one error
  or edge case and one payload-size criterion.
- **§10 Non-functional.** A latency target (warm p95) and a payload budget in
  bytes. Retrieval-path work holds p95 ≤ 30 ms and about 2 KB per payload.
  Write tools list every write-safety item from the template.
- **§10a Admission bar.** Required for any new tool, prompt, or resource: why
  not a parameter, the `tasks.json` task, the expected token win, and the
  estimated schema-tax cost.
- **§12 Open decisions.** Every real choice the implementer would otherwise
  make alone (naming, prefix vs exact matching, one tool or two), each with
  options and a recommendation. Don't include questions the code already
  answers.

Header table: Status `Draft`, Owner the issue's assignee or Shaq, the issue ID,
its current Linear priority and milestone.

## 4. Review with the user

Show the full draft before writing it anywhere. List the open decisions
separately so they can be answered in one pass. Revise until it's approved.

## 5. Publish

- Run the prose through `humanizer:humanizer` first. Code, identifiers,
  numbers and commands stay exact.
- Replace the Linear issue description with the approved PRD (`save_issue`),
  set its Status row to `Approved`, and keep any "merged from SHA-XX" note at
  the end.
- Prefix the title with `PRD: ` if it doesn't have it yet.
- Leave the issue's workflow state alone unless the user asks to change it.

## Don'ts

- No marketing figures from memory. Benchmark numbers come from
  `benchmarks.json` or the committed baseline reports.
- No implementation in this step. `/prd` ends at an approved PRD.
