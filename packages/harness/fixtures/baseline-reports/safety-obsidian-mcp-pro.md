# Write Safety — obsidian-mcp-pro

- **Adapter:** obsidian-mcp-pro (rps321321, filesystem-direct, no Obsidian required)
- **Snapshot:** 2026-08-03T03:22:05.318Z
- **Sample:** 25 frontmatter-heavy notes
- **Vault copy:** `<tmpdir>/seekstone-safety-8oYPyj`
- **Original (read-only, untouched):** `packages/harness/fixtures/vault`

## Summary

| Op | Pass | Fail | Skipped | Verdict |
| --- | ---: | ---: | ---: | --- |
| identity | 0 | 25 | 0 | ❌ **Fail — all 25 attempted notes** (systemic) |
| body-append | 0 | 25 | 0 | ❌ **Fail — all 25 attempted notes** (systemic) |
| fm-edit | 0 | 25 | 0 | ❌ **Fail — all 25 attempted notes** (systemic) |
| patch-note | 0 | 25 | 0 | ❌ **Fail — all 25 attempted notes** (systemic) |
| replace-in-note | 0 | 25 | 0 | ❌ **Fail — all 25 attempted notes** (systemic) |
| recoverable-delete | 0 | 0 | 25 | — n/a (unsupported by adapter) |
| create-no-clobber | 25 | 0 | 0 | ✅ Pass |
| cas-conflict | 0 | 0 | 25 | — n/a (unsupported by adapter) |

> Skipped = the adapter does not expose the capability (delete/create/CAS), or the op does not apply to a note's shape. Skips are the capability matrix, not failures.

> [!CAUTION]
> **Systemic failure on identity (25/25 notes, 100%)**
>
> First failure reason: `write call errored: obsidian-mcp-pro create_note: Error: Note already exists at '0 Inbox/Antelope.md'. Use append or update tools instead.`

> [!CAUTION]
> **Systemic failure on body-append (25/25 notes, 100%)**
>
> First failure reason: `write call errored: obsidian-mcp-pro create_note: Error: Note already exists at '0 Inbox/Antelope.md'. Use append or update tools instead.`

> [!CAUTION]
> **Systemic failure on fm-edit (25/25 notes, 100%)**
>
> First failure reason: `write call errored: obsidian-mcp-pro create_note: Error: Note already exists at '0 Inbox/Antelope.md'. Use append or update tools instead.`

> [!CAUTION]
> **Systemic failure on patch-note (25/25 notes, 100%)**
>
> First failure reason: `write call errored: obsidian-mcp-pro create_note: Error: Note already exists at '0 Inbox/Antelope.md'. Use append or update tools instead.`

> [!CAUTION]
> **Systemic failure on replace-in-note (25/25 notes, 100%)**
>
> First failure reason: `write call errored: obsidian-mcp-pro create_note: Error: Note already exists at '0 Inbox/Antelope.md'. Use append or update tools instead.`

## Failing notes

| Note | Op | Reason |
| --- | --- | --- |
| `0 Inbox/Antelope.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at '0 Inbox/Antelope.md'. Use append or update tools instead. |
| `0 Inbox/Antelope.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at '0 Inbox/Antelope.md'. Use append or update tools instead. |
| `0 Inbox/Antelope.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at '0 Inbox/Antelope.md'. Use append or update tools instead. |
| `0 Inbox/Antelope.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at '0 Inbox/Antelope.md'. Use append or update tools instead. |
| `0 Inbox/Antelope.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at '0 Inbox/Antelope.md'. Use append or update tools instead. |
| `Encyclopedia/A/Arch.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/A/Arch.md'. Use append or update tools instead. |
| `Encyclopedia/A/Arch.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/A/Arch.md'. Use append or update tools instead. |
| `Encyclopedia/A/Arch.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/A/Arch.md'. Use append or update tools instead. |
| `Encyclopedia/A/Arch.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/A/Arch.md'. Use append or update tools instead. |
| `Encyclopedia/A/Arch.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/A/Arch.md'. Use append or update tools instead. |
| `Encyclopedia/B/Barker'S Mill.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/B/Barker'S Mill.md'. Use append or update tools instead. |
| `Encyclopedia/B/Barker'S Mill.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/B/Barker'S Mill.md'. Use append or update tools instead. |
| `Encyclopedia/B/Barker'S Mill.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/B/Barker'S Mill.md'. Use append or update tools instead. |
| `Encyclopedia/B/Barker'S Mill.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/B/Barker'S Mill.md'. Use append or update tools instead. |
| `Encyclopedia/B/Barker'S Mill.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/B/Barker'S Mill.md'. Use append or update tools instead. |
| `Encyclopedia/B/Bonstetten.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/B/Bonstetten.md'. Use append or update tools instead. |
| `Encyclopedia/B/Bonstetten.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/B/Bonstetten.md'. Use append or update tools instead. |
| `Encyclopedia/B/Bonstetten.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/B/Bonstetten.md'. Use append or update tools instead. |
| `Encyclopedia/B/Bonstetten.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/B/Bonstetten.md'. Use append or update tools instead. |
| `Encyclopedia/B/Bonstetten.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/B/Bonstetten.md'. Use append or update tools instead. |
| `Encyclopedia/C/Cape Town.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/C/Cape Town.md'. Use append or update tools instead. |
| `Encyclopedia/C/Cape Town.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/C/Cape Town.md'. Use append or update tools instead. |
| `Encyclopedia/C/Cape Town.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/C/Cape Town.md'. Use append or update tools instead. |
| `Encyclopedia/C/Cape Town.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/C/Cape Town.md'. Use append or update tools instead. |
| `Encyclopedia/C/Cape Town.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/C/Cape Town.md'. Use append or update tools instead. |
| `Encyclopedia/C/Chrysoberyl.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/C/Chrysoberyl.md'. Use append or update tools instead. |
| `Encyclopedia/C/Chrysoberyl.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/C/Chrysoberyl.md'. Use append or update tools instead. |
| `Encyclopedia/C/Chrysoberyl.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/C/Chrysoberyl.md'. Use append or update tools instead. |
| `Encyclopedia/C/Chrysoberyl.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/C/Chrysoberyl.md'. Use append or update tools instead. |
| `Encyclopedia/C/Chrysoberyl.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/C/Chrysoberyl.md'. Use append or update tools instead. |
| `Encyclopedia/C/Cross.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/C/Cross.md'. Use append or update tools instead. |
| `Encyclopedia/C/Cross.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/C/Cross.md'. Use append or update tools instead. |
| `Encyclopedia/C/Cross.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/C/Cross.md'. Use append or update tools instead. |
| `Encyclopedia/C/Cross.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/C/Cross.md'. Use append or update tools instead. |
| `Encyclopedia/C/Cross.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/C/Cross.md'. Use append or update tools instead. |
| `Encyclopedia/D/Docket.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/D/Docket.md'. Use append or update tools instead. |
| `Encyclopedia/D/Docket.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/D/Docket.md'. Use append or update tools instead. |
| `Encyclopedia/D/Docket.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/D/Docket.md'. Use append or update tools instead. |
| `Encyclopedia/D/Docket.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/D/Docket.md'. Use append or update tools instead. |
| `Encyclopedia/D/Docket.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/D/Docket.md'. Use append or update tools instead. |
| `Encyclopedia/E/Espinay.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/E/Espinay.md'. Use append or update tools instead. |
| `Encyclopedia/E/Espinay.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/E/Espinay.md'. Use append or update tools instead. |
| `Encyclopedia/E/Espinay.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/E/Espinay.md'. Use append or update tools instead. |
| `Encyclopedia/E/Espinay.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/E/Espinay.md'. Use append or update tools instead. |
| `Encyclopedia/E/Espinay.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/E/Espinay.md'. Use append or update tools instead. |
| `Encyclopedia/F/Fraternities.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/F/Fraternities.md'. Use append or update tools instead. |
| `Encyclopedia/F/Fraternities.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/F/Fraternities.md'. Use append or update tools instead. |
| `Encyclopedia/F/Fraternities.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/F/Fraternities.md'. Use append or update tools instead. |
| `Encyclopedia/F/Fraternities.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/F/Fraternities.md'. Use append or update tools instead. |
| `Encyclopedia/F/Fraternities.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/F/Fraternities.md'. Use append or update tools instead. |
| `Encyclopedia/G/Gotter.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/G/Gotter.md'. Use append or update tools instead. |
| `Encyclopedia/G/Gotter.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/G/Gotter.md'. Use append or update tools instead. |
| `Encyclopedia/G/Gotter.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/G/Gotter.md'. Use append or update tools instead. |
| `Encyclopedia/G/Gotter.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/G/Gotter.md'. Use append or update tools instead. |
| `Encyclopedia/G/Gotter.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/G/Gotter.md'. Use append or update tools instead. |
| `Encyclopedia/H/Hesperides.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/H/Hesperides.md'. Use append or update tools instead. |
| `Encyclopedia/H/Hesperides.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/H/Hesperides.md'. Use append or update tools instead. |
| `Encyclopedia/H/Hesperides.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/H/Hesperides.md'. Use append or update tools instead. |
| `Encyclopedia/H/Hesperides.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/H/Hesperides.md'. Use append or update tools instead. |
| `Encyclopedia/H/Hesperides.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/H/Hesperides.md'. Use append or update tools instead. |
| `Encyclopedia/I/Irbit.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/I/Irbit.md'. Use append or update tools instead. |
| `Encyclopedia/I/Irbit.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/I/Irbit.md'. Use append or update tools instead. |
| `Encyclopedia/I/Irbit.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/I/Irbit.md'. Use append or update tools instead. |
| `Encyclopedia/I/Irbit.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/I/Irbit.md'. Use append or update tools instead. |
| `Encyclopedia/I/Irbit.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/I/Irbit.md'. Use append or update tools instead. |
| `Encyclopedia/K/Kingston.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/K/Kingston.md'. Use append or update tools instead. |
| `Encyclopedia/K/Kingston.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/K/Kingston.md'. Use append or update tools instead. |
| `Encyclopedia/K/Kingston.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/K/Kingston.md'. Use append or update tools instead. |
| `Encyclopedia/K/Kingston.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/K/Kingston.md'. Use append or update tools instead. |
| `Encyclopedia/K/Kingston.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/K/Kingston.md'. Use append or update tools instead. |
| `Encyclopedia/L/Lewes.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/L/Lewes.md'. Use append or update tools instead. |
| `Encyclopedia/L/Lewes.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/L/Lewes.md'. Use append or update tools instead. |
| `Encyclopedia/L/Lewes.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/L/Lewes.md'. Use append or update tools instead. |
| `Encyclopedia/L/Lewes.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/L/Lewes.md'. Use append or update tools instead. |
| `Encyclopedia/L/Lewes.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/L/Lewes.md'. Use append or update tools instead. |
| `Encyclopedia/M/Marquetry.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/M/Marquetry.md'. Use append or update tools instead. |
| `Encyclopedia/M/Marquetry.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/M/Marquetry.md'. Use append or update tools instead. |
| `Encyclopedia/M/Marquetry.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/M/Marquetry.md'. Use append or update tools instead. |
| `Encyclopedia/M/Marquetry.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/M/Marquetry.md'. Use append or update tools instead. |
| `Encyclopedia/M/Marquetry.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Encyclopedia/M/Marquetry.md'. Use append or update tools instead. |
| `MOCs/science-studies MOC.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'MOCs/science-studies MOC.md'. Use append or update tools instead. |
| `MOCs/science-studies MOC.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'MOCs/science-studies MOC.md'. Use append or update tools instead. |
| `MOCs/science-studies MOC.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'MOCs/science-studies MOC.md'. Use append or update tools instead. |
| `MOCs/science-studies MOC.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'MOCs/science-studies MOC.md'. Use append or update tools instead. |
| `MOCs/science-studies MOC.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'MOCs/science-studies MOC.md'. Use append or update tools instead. |
| `Notes/Curacao.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Notes/Curacao.md'. Use append or update tools instead. |
| `Notes/Curacao.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Notes/Curacao.md'. Use append or update tools instead. |
| `Notes/Curacao.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Notes/Curacao.md'. Use append or update tools instead. |
| `Notes/Curacao.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Notes/Curacao.md'. Use append or update tools instead. |
| `Notes/Curacao.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Notes/Curacao.md'. Use append or update tools instead. |
| `Notes/Isfahan.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Notes/Isfahan.md'. Use append or update tools instead. |
| `Notes/Isfahan.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Notes/Isfahan.md'. Use append or update tools instead. |
| `Notes/Isfahan.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Notes/Isfahan.md'. Use append or update tools instead. |
| `Notes/Isfahan.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Notes/Isfahan.md'. Use append or update tools instead. |
| `Notes/Isfahan.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Notes/Isfahan.md'. Use append or update tools instead. |
| `Reference/Berdyansk.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Reference/Berdyansk.md'. Use append or update tools instead. |
| `Reference/Berdyansk.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Reference/Berdyansk.md'. Use append or update tools instead. |
| `Reference/Berdyansk.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Reference/Berdyansk.md'. Use append or update tools instead. |
| `Reference/Berdyansk.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Reference/Berdyansk.md'. Use append or update tools instead. |
| `Reference/Berdyansk.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Reference/Berdyansk.md'. Use append or update tools instead. |
| `Reference/Descriptive Poetry.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Reference/Descriptive Poetry.md'. Use append or update tools instead. |
| `Reference/Descriptive Poetry.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Reference/Descriptive Poetry.md'. Use append or update tools instead. |
| `Reference/Descriptive Poetry.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Reference/Descriptive Poetry.md'. Use append or update tools instead. |
| `Reference/Descriptive Poetry.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Reference/Descriptive Poetry.md'. Use append or update tools instead. |
| `Reference/Descriptive Poetry.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Reference/Descriptive Poetry.md'. Use append or update tools instead. |
| `Reference/Henry V..md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Reference/Henry V..md'. Use append or update tools instead. |
| `Reference/Henry V..md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Reference/Henry V..md'. Use append or update tools instead. |
| `Reference/Henry V..md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Reference/Henry V..md'. Use append or update tools instead. |
| `Reference/Henry V..md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Reference/Henry V..md'. Use append or update tools instead. |
| `Reference/Henry V..md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Reference/Henry V..md'. Use append or update tools instead. |
| `Reference/Market Harborough.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Reference/Market Harborough.md'. Use append or update tools instead. |
| `Reference/Market Harborough.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Reference/Market Harborough.md'. Use append or update tools instead. |
| `Reference/Market Harborough.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Reference/Market Harborough.md'. Use append or update tools instead. |
| `Reference/Market Harborough.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Reference/Market Harborough.md'. Use append or update tools instead. |
| `Reference/Market Harborough.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Reference/Market Harborough.md'. Use append or update tools instead. |
| `Sources/Chieti.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Sources/Chieti.md'. Use append or update tools instead. |
| `Sources/Chieti.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Sources/Chieti.md'. Use append or update tools instead. |
| `Sources/Chieti.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Sources/Chieti.md'. Use append or update tools instead. |
| `Sources/Chieti.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Sources/Chieti.md'. Use append or update tools instead. |
| `Sources/Chieti.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Sources/Chieti.md'. Use append or update tools instead. |
| `Sources/Gervex.md` | identity | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Sources/Gervex.md'. Use append or update tools instead. |
| `Sources/Gervex.md` | body-append | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Sources/Gervex.md'. Use append or update tools instead. |
| `Sources/Gervex.md` | fm-edit | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Sources/Gervex.md'. Use append or update tools instead. |
| `Sources/Gervex.md` | patch-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Sources/Gervex.md'. Use append or update tools instead. |
| `Sources/Gervex.md` | replace-in-note | write call errored: obsidian-mcp-pro create_note: Error: Note already exists at 'Sources/Gervex.md'. Use append or update tools instead. |
