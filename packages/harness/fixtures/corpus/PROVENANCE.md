# Benchmark corpus provenance

The synthetic benchmark vault (`../vault/`) is generated from the body text of the
**Encyclopædia Britannica, 11th edition (1911)**, as digitised and proofread by
**Project Gutenberg**.

## Why this source

- **Public domain.** The 1911 Britannica's copyright has long expired; Project
  Gutenberg distributes these volumes with no usage restrictions in the US. This
  keeps the MIT-licensed repository clean — no copyleft, no attribution burden on
  downstream users of the benchmark.
- **Human-proofread.** Unlike OCR dumps, the PG text is clean, so the generated
  notes read like real prose.
- **Naturally note-shaped.** Each volume is a list of self-contained articles
  whose size distribution (median ~2 KB, long tail into the hundreds of KB) closely
  matches a real Obsidian vault's note-size distribution.

## What is committed vs fetched

- **Committed:** `manifest.json` — the pinned list of Project Gutenberg ebook IDs,
  their alphabetical ranges, source URLs, and SHA-256 checksums.
- **Fetched on demand (gitignored):** `raw/pg<id>.txt` — the volume text files.
  Run `npm run harness -- fetch-corpus` to download them. Each volume comes from
  Project Gutenberg, or from the mirror (see "Mirror" below) when Gutenberg's file no
  longer matches its pin. Either way it is verified against the checksum in
  `manifest.json`, so a drifted file is rejected rather than silently used.

The generated vault under `../vault/` is the **canonical artifact** committed to the
repo. Running the benchmark needs only that vault — the corpus is required solely to
*regenerate* it.

## Reproducibility status (SHA-340)

**The pinned corpus still regenerates the committed vaults byte for byte, but you
can't download all of it from Project Gutenberg any more.**

- **Regeneration works.** On 2026-11-06 all 125 local `raw/` files matched their
  `manifest.json` checksums, and `gen-vault` with `--count` 10000, 1000 and 5000
  produced output identical to `../vault`, `../vault-1k` and `../vault-5k`
  (`diff -r`, no differences).
- **Downloading doesn't.** Project Gutenberg has re-issued some pinned volumes since
  the manifest was committed (2026-06-26). On 2026-11-06, 16 of the 125 failed
  checksum verification: pg19699, pg19846, pg27478, pg27479, pg27480, pg33189,
  pg34702, pg34751, pg35092, pg35169, pg35236, pg35473, pg35561, pg35606, pg35747 and
  pg36735. The set changes over time (a check in October 2026 counted 28), so
  `fetch-corpus` doesn't hard-code it. It saves every volume that verifies, then
  names each one that didn't, with its range and the reason.
- **The mirror fills the gap.** All 125 pinned files are published as an immutable
  release of [`shaqmughal/seekstone-corpus`](https://github.com/shaqmughal/seekstone-corpus),
  and `fetch-corpus` falls back to it for any volume Gutenberg no longer serves
  byte-identically. A fresh clone can fetch the full pinned set and regenerate the
  vaults. A second, private archive is recorded on SHA-340.

An earlier version of this section said the committed vaults could no longer be
regenerated from source and that a re-pin (fixture v3) would be needed. That was
wrong: the re-issued text parses differently, but the pinned text survived, and it
reproduces the vaults exactly.

**Changing a fixture.** Run `fetch-corpus`, change the generator, and rerun
`gen-vault`. Fixture v2.1 was made differently, by a migration over the committed
files (`src/fixtures/plant-tasks.ts`), because at the time the pinned text was
believed lost. That pattern still works if you ever need to change a fixture
without the corpus: draw from an isolated PRNG stream, and prove the migration
byte-exact by generating with the old and the new generator from the same corpus.

Running the benchmarks never needs the corpus. The committed vaults are the canonical
artifact, and every published number is measured against them.

## Mirror (SHA-464)

`manifest.json` names the mirror in its `mirror` field (`repo` and release `tag`). The
release is immutable: once published, its files and tag can't be changed or deleted.
The mirror repository holds no checksums of its own, so `manifest.json` stays the
only source of truth.

**What keeps it correct.** The `Corpus mirror` workflow
(`.github/workflows/corpus-mirror.yml`) runs `npm run harness -- verify-corpus-mirror`.
That command makes one GitHub API call and checks that the release exists, isn't a
draft, is immutable, and holds exactly one file per manifest entry with a SHA-256
digest equal to its pin. It runs:

- on every pull request that changes `manifest.json` or `src/fixtures/corpus.ts`,
  where a failure blocks the merge;
- on pushes to `main` that change those files;
- on the 1st of each month, where a failure opens a GitHub issue (or comments on the
  open one);
- on demand, from the Actions tab.

**Re-pinning the corpus.** Nothing needs doing unless you deliberately change the
pins, for example to move to Project Gutenberg's current text. Then:

1. Put the new pin-exact files in `raw/` and update each entry's `sha256` and `bytes`
   in `manifest.json`.
2. Set `mirror.tag` to a new tag (`eb1911-v2`, and so on). A published release can't
   be changed, so a re-pin always gets a new one.
3. Run `npm run harness -- publish-corpus` (needs the GitHub CLI, logged in with write
   access to the mirror repository). It checks every local file against its pin,
   refuses to touch an existing release, uploads to a draft, publishes, and confirms
   the published digests.
4. Open the pull request. The `Corpus mirror` check passes only once the new release
   matches the manifest. If you forget step 3, the check fails and its message names
   the command.
5. Regenerate the vaults with `gen-vault` and refresh every baseline that depends on
   them, on the canon machine (see `../../README.md`, "Canon conditions").

## Boilerplate handling

The Project Gutenberg header and license footer (everything outside the
`*** START … ***` / `*** END … ***` markers) is stripped at parse time
(`parse-volume.ts`). Only the public-domain article text enters the vault.

## Regenerating

```bash
npm run harness -- fetch-corpus            # download + checksum-verify raw volumes
npm run harness -- gen-vault --count 10000 # regenerate the canonical vault
```

`fetch-corpus` takes re-issued volumes from the mirror, so these commands reproduce the
committed vaults exactly.
