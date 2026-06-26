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
  against the checksum in `manifest.json`, guaranteeing byte-identical regeneration.

The generated vault under `../vault/` is the **canonical artifact** committed to the
repo. Running the benchmark needs only that vault — the corpus is required solely to
*regenerate* it.

## Boilerplate handling

The Project Gutenberg header and license footer (everything outside the
`*** START … ***` / `*** END … ***` markers) is stripped at parse time
(`parse-volume.ts`). Only the public-domain article text enters the vault.

## Regenerating

```bash
npm run harness -- fetch-corpus            # download + checksum-verify raw volumes
npm run harness -- gen-vault --count 10000 # regenerate the canonical vault
```
