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

**The committed vaults can no longer be regenerated from source.** Project Gutenberg
has re-issued 28 of the 125 pinned volume files since the manifest was committed
(2026-06-26). The canonical URLs, the mirror network, and the Wayback Machine were all
checked: no byte-identical copy of those 28 remains publicly fetchable, so
`fetch-corpus` fails checksum verification on them. The re-issued files parse to a
different article pool, so generating from the current upstream text does not
reproduce the committed article notes.

What this means in practice:

- **Running the benchmarks is unaffected.** The committed vaults (`../vault`,
  `../vault-1k`, `../vault-5k`) are the canonical artifact, and every published number
  is measured against them.
- **Fixtures ≤ v2.1 are not regenerable.** Until the corpus is re-pinned (fixture v3),
  a fixture change must be a migration over the committed files that draws from an
  isolated PRNG stream and is proven byte-exact against the generator (generate with
  the old and the new generator from the same corpus; the migration applied to the old
  output must equal the new output). `src/fixtures/plant-tasks.ts`, which produced
  fixture v2.1, is the exemplar.
- The 97 volumes that still match their pins, plus dated snapshots of the 28
  re-issues, are archived off-repo (location recorded on SHA-340).

## Boilerplate handling

The Project Gutenberg header and license footer (everything outside the
`*** START … ***` / `*** END … ***` markers) is stripped at parse time
(`parse-volume.ts`). Only the public-domain article text enters the vault.

## Regenerating

```bash
npm run harness -- fetch-corpus            # download + checksum-verify raw volumes
npm run harness -- gen-vault --count 10000 # regenerate the canonical vault
```

See "Reproducibility status" above: with the manifest as currently pinned,
`fetch-corpus` fails on the 28 re-issued volumes, so these commands do not reproduce
the committed vaults until the fixture-v3 re-pin.
