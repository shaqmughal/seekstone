<!--
HOW TO USE THIS TEMPLATE
========================
Copy everything below the line into a new PRD (a Linear issue description, or a
docs/prd/<slug>.md file). Fill every section; if a section truly doesn't apply,
write "N/A — <reason>" rather than deleting it, so reviewers know it was
considered.

This template is optimized to be EXECUTION-READY for an autonomous coding agent
while staying readable by engineers, QA, design, and non-technical
stakeholders. The rule of thumb: someone who has never seen the codebase should
be able to read the PRD top-to-bottom and know exactly what to build, why, how
to verify it, and when it's done.

Keep prose tight. Prefer lists, tables, and code blocks over paragraphs.
Every claim about the codebase should name a real file/symbol so it can be checked.
-->

---

# PRD: <Feature name>

> **One-liner:** <one sentence a non-engineer can understand: what this is and who it's for.>

| | |
|---|---|
| **Status** | Draft · In Review · Approved · In Progress · Shipped |
| **Owner** | <name> |
| **Linear issue** | <SHA-XX or link> |
| **Priority** | Urgent · High · Medium · Low |
| **Estimate** | <t-shirt size or points> |
| **Target version** | <e.g. 0.3.0 / N/A> |
| **Decision needed?** | No · **Yes — see "Open decisions"** |

---

## 1. Summary
<2–4 sentences. What are we building and what changes for the user once it ships? Written so anyone — engineer, QA, or a stakeholder — gets the gist without reading further.>

## 2. Problem & motivation
<Why does this matter NOW? What's broken, missing, or painful today? Cite specifics: current behavior, the file/flow responsible, user feedback, or a metric. Make the cost of NOT doing this concrete.>

- **Today:** <current state>
- **Pain:** <who hurts and how>
- **Evidence:** <link / quote / data / file reference>

## 3. Goals & non-goals
**Goals** (what success includes):
- [ ] <goal 1>
- [ ] <goal 2>

**Non-goals** (explicitly out of scope — prevents scope creep):
- <non-goal 1>
- <non-goal 2>

## 4. Users & use cases
<Who uses this and the concrete scenarios. A short "As a <role>, I want <X>, so that <Y>" list, or a couple of named walkthroughs.>

## 5. Proposed solution
<The approach in plain language first, then specifics. Diagrams/ASCII welcome. If there's a public surface (CLI, API, tool, config), show it exactly.>

**Surface / contract** (the exact shape users or callers see):
```
<CLI signature, tool schema, function signature, config keys, or API request/response>
```

**Behavior / rules:**
- <rule 1 — edge cases, ordering, defaults>
- <rule 2>

## 6. Alternatives considered
<Briefly: what else could solve this, and why the proposed approach wins. One row per option.>

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| <A> | | | chosen / rejected |

---

## 7. Implementation plan (for the implementer)
<This is the execution heart of the PRD. An agent should be able to follow this without further design decisions.>

**Where the work lives:**
| Area | Path | Change |
|---|---|---|
| <e.g. new module> | `packages/server/src/<x>.ts` | <create/edit> |
| <tests> | `packages/server/src/<x>.test.ts` | new |
| <docs> | `README.md`, `packages/server/README.md` | update |

**Steps:**
1. <ordered, concrete step — name files & functions>
2. <…>
3. <…>

**Reuse / prior art in this repo** (don't reinvent):
- <e.g. follow the testable-core pattern in `init.ts`/`cli-args.ts`: pure logic + a thin IO wrapper with injected `env`/`platform`/`timestamp`>
- <relevant existing helper to call>

**Conventions to honor** (from CONTRIBUTING.md):
- `.js` import extensions on TS sources; NodeNext.
- Run `npm run format`; LF line endings; biome must pass.
- Server makes **no network calls / no telemetry** — keep it that way.
- Cross-platform path code keys off `path.posix`/`path.win32` by target platform, not the host.
- Add a **changeset** (`npx changeset`) for any user-facing change.

## 8. Acceptance criteria
<Binary, testable checklist. Each item is something QA or CI can verify pass/fail. These ARE the definition of done for the feature behavior.>

- [ ] <observable behavior 1>
- [ ] <observable behavior 2>
- [ ] <error/edge case is handled as specified>

## 9. Test plan
**Automated** (co-located `*.test.ts`, the project standard):
- [ ] <unit: pure logic — list the cases incl. at least one negative/error case>
- [ ] <integration: the wired path>
- [ ] Coverage stays above the server gate (thresholds in `packages/server/vitest.config.ts`).

**Manual / verification** (record results in the PR):
- [ ] <command to run + expected output>
- [ ] <real-world smoke check>

## 10. Non-functional requirements
<The cross-cutting constraints. Seekstone's defaults below — keep, tighten, or mark N/A.>

- **Performance / payload (the thesis):** <latency target; payload must stay small — name the budget.>
- **No network / no telemetry:** <assert it still holds; or justify + test.>
- **Write-safety:** <if it writes: atomic, byte-faithful frontmatter, backup/no-clobber.>
- **Cross-platform:** <works on macOS/Linux/Windows; covered by CI matrix.>
- **Determinism:** <same input → same output; no `Math.random()`/wall-clock in core paths.>
- **Footprint:** <new deps justified; bundle impact noted.>

## 11. Rollout & docs
- **Release:** <changeset bump level; any migration; feature-flagged?>
- **Docs to update:** <README sections, docs/*, tool descriptions, CHANGELOG via changeset>
- **Backward compatibility:** <any breaking change? default behavior preserved?>

## 12. Risks & open decisions
| Risk / question | Impact | Mitigation / who decides |
|---|---|---|
| <risk> | | |

**Open decisions** (must be resolved before / during build — call out if this PRD is blocked on a human choice):
- [ ] <decision 1 — options + recommendation>

## 13. Dependencies & references
- **Depends on:** <issues, infra, accounts>
- **Unblocks:** <downstream work>
- **References:** <prior art, external docs, related PRDs, design links>
