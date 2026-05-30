# Releasing

Seekstone publishes the `seekstone` npm package via [Changesets](https://github.com/changesets/changesets) and GitHub Actions. Releases are automated — no manual `npm publish` from a laptop.

## How to cut a release

1. **Add a changeset** with your change (on the PR branch):
   ```bash
   npx changeset
   ```
   Pick `seekstone`, choose the bump (patch / minor / major), and write a short summary — it becomes the CHANGELOG entry. Commit the generated `.changeset/*.md` file.

2. **Merge your PR to `main`.** The `Release` workflow sees the pending changeset and opens (or updates) a **"chore: version packages"** PR that bumps the version and updates `packages/server/CHANGELOG.md`.

3. **Merge the version PR.** That push has no pending changesets, so the workflow **publishes to npm** with provenance.

Re-running a release for an already-published version is a no-op, so the workflow is safe to re-run.

## Gates (must pass before publish)

The `Release` workflow runs typecheck → `npm test` → `npm run lint` → **`npm run smoke`** before the publish step. `smoke` packs the tarball, installs it into a throwaway project, and boots the `seekstone` bin to confirm `npx seekstone` works for a real user. A failure at any gate blocks the publish.

CI (the `CI` workflow) additionally enforces a **coverage gate** on the server's logic modules (thresholds in `packages/server/vitest.config.ts`).

## One-time repo setting

Settings → Actions → General → Workflow permissions → enable **"Allow GitHub Actions to create and approve pull requests"** (so Changesets can open the version PR).

## Authentication

Today the workflow authenticates with the `NPM_TOKEN` repo secret (a granular token scoped to `seekstone`) plus `id-token: write` + `NPM_CONFIG_PROVENANCE=true` for provenance.

### Recommended upgrade: OIDC trusted publishing (no token)

npm granular tokens expire every 90 days. To remove the token (and the rotation chore) entirely, configure **trusted publishing**:

1. On npmjs.com → the `seekstone` package → **Settings → Trusted Publisher** → GitHub Actions, repo `shaqmughal/seekstone`, workflow `release.yml`.
2. Ensure the workflow runs an OIDC-capable npm (`npm install -g npm@latest`).
3. Remove `NODE_AUTH_TOKEN` from the publish step — npm uses OIDC automatically, and provenance is implicit.

After that the `NPM_TOKEN` secret can be deleted.
