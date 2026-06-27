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

## Authentication — OIDC trusted publishing (no token)

The workflow publishes via **OIDC trusted publishing**: no npm token is stored, and provenance is automatic. It needs `id-token: write` (set) and npm ≥ 11.5.1 (the workflow runs `npm install -g npm@latest`).

**One-time setup on npmjs.com** (required before the first OIDC publish):

- The `seekstone` package → **Settings → Trusted Publisher** → **GitHub Actions** → repository `shaqmughal/seekstone`, workflow filename `release.yml`.

Once configured, the publish step authenticates automatically — there is no `NODE_AUTH_TOKEN`. The old `NPM_TOKEN` secret is no longer used and can be deleted.

## Post-publish: Glama (manual)

After every npm publish you need to create a new release on the Glama listing manually:

1. Open <https://glama.ai/mcp/servers/shaqmughal/seekstone/admin/dockerfile>
2. Click **"Create Release"** (or the equivalent button in the admin UI).
3. Verify the new version appears on <https://glama.ai/mcp/servers/shaqmughal/seekstone>.

**Why this isn't automated yet:** Glama has no public REST API or documented webhook for programmatic release creation (investigated in SHA-85, June 2026). The build spec uses `"pinnedCommit": null`, so the build itself always pulls the latest commit — only the release creation step is missing. If Glama adds an API or webhook in the future, the step would slot into `release.yml` after the MCPB upload:

```yaml
- name: Trigger Glama release
  if: steps.changesets.outputs.published == 'true'
  run: |
    VERSION=$(node -p "require('./packages/server/package.json').version")
    curl -fsSL -X POST "https://glama.ai/api/..." \
      -H "Authorization: Bearer ${{ secrets.GLAMA_API_TOKEN }}" \
      -d "{\"version\": \"${VERSION}\"}"
```

Until then, the manual step above is required to keep the Glama listing current.
