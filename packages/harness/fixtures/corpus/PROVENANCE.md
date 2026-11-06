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
  Run `npm run harness -- fetch-corpus` to download them; each file is verified
  against the checksum in `manifest.json`, so a drifted upstream file is rejected
  rather than silently used.

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
- **The pinned copy is archived off-repo.** A complete, checksum-verified archive of
  all 125 volumes is kept outside this repository; its location is recorded on
  SHA-340. A public mirror with a `fetch-corpus` fallback is planned, so a fresh clone
  can fetch the full pinned set again. Until then, regenerating needs a copy of that
  archive placed in `raw/`.

An earlier version of this section said the committed vaults could no longer be
regenerated from source and that a re-pin (fixture v3) would be needed. That was
wrong: the re-issued text parses differently, but the pinned text survived, and it
reproduces the vaults exactly.

**Changing a fixture.** With the pinned corpus in `raw/`, change the generator and
rerun `gen-vault`, as before. Without it, use a migration over the committed files
that draws from an isolated PRNG stream, and prove it byte-exact against the
generator: generate with the old and the new generator from the same corpus, and the
migration applied to the old output must equal the new output.
`src/fixtures/plant-tasks.ts`, which produced fixture v2.1, is the example.

Running the benchmarks never needs the corpus. The committed vaults are the canonical
artifact, and every published number is measured against them.

## Boilerplate handling

The Project Gutenberg header and license footer (everything outside the
`*** START … ***` / `*** END … ***` markers) is stripped at parse time
(`parse-volume.ts`). Only the public-domain article text enters the vault.

## Regenerating

```bash
npm run harness -- fetch-corpus            # download + checksum-verify raw volumes
npm run harness -- gen-vault --count 10000 # regenerate the canonical vault
```

`fetch-corpus` currently fails on the volumes Project Gutenberg has re-issued (see
"Reproducibility status" above). With the archived pinned corpus copied into `raw/`,
`gen-vault` reproduces the committed vaults exactly.
