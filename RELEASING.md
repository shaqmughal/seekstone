# Releasing

Releases are driven by [Changesets](https://github.com/changesets/changesets). The normal flow is:

1. Add a changeset for each PR: `npx changeset`
2. CI opens a "Version Packages" PR automatically on the next push to `main`.
3. Merging that PR publishes to npm (OIDC provenance), creates GitHub Releases, and attaches the `.mcpb` bundle — all without manual steps.

## Post-publish: Glama

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
