<!-- Thanks for contributing! Keep PRs focused. See CONTRIBUTING.md. -->

## What & why

<!-- What does this change, and why? Link any related issue (e.g. "Closes #12"). -->

## How it was tested

<!-- Commands run, manual checks, new/updated tests. -->

## Checklist

- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] Typecheck passes (`npx tsc -p packages/<pkg>/tsconfig.json --noEmit`)
- [ ] Tests added/updated for the change
- [ ] Added a changeset (`npx changeset`) for any user-facing change — or this is docs/internal only
- [ ] No new network calls or telemetry in the server
- [ ] New tool, prompt or resource: the `tasks.json` token win and the old and new schema-tax totals are in the description (CONTRIBUTING.md, "Adding a tool, prompt, or resource")
- [ ] New hot path: a bench case in `packages/server/src/bench/`
- [ ] No tests deleted, skipped or removed, or the reason is given here for a maintainer to add `tests-weakened:approved`
