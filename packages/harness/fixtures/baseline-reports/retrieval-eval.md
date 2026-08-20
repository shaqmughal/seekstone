# Retrieval-quality eval (SHA-257 spike)

- **Snapshot:** 2026-08-20T01:06:53.554Z
- **Machine:** darwin/arm64, node v25.9.0, 16 cpus
- **Vault:** packages/harness/fixtures/vault (10000 notes)
- **Query set:** 50 queries (30 semantic, 10 lexical, 10 topical), 20 latency runs/query
- **Lexical index build:** 42479.00 ms
- **potion-base-8M:** dim 256, 45964 chunks, index build 22161.48 ms, model load 15.11 ms

## Retrieval quality

| Condition | Subset | hit@5 | MRR@10 | n |
| --- | --- | ---: | ---: | ---: |
| lexical | overall | 44.0% | 0.304 | 50 |
| lexical | semantic | 30.0% | 0.150 | 30 |
| lexical | lexical | 100.0% | 0.950 | 10 |
| lexical | topical | 30.0% | 0.120 | 10 |
| semantic:potion-base-8M | overall | 68.0% | 0.521 | 50 |
| semantic:potion-base-8M | semantic | 70.0% | 0.498 | 30 |
| semantic:potion-base-8M | lexical | 80.0% | 0.761 | 10 |
| semantic:potion-base-8M | topical | 50.0% | 0.349 | 10 |
| hybrid-rrf:potion-base-8M | overall | 54.0% | 0.400 | 50 |
| hybrid-rrf:potion-base-8M | semantic | 46.7% | 0.300 | 30 |
| hybrid-rrf:potion-base-8M | lexical | 100.0% | 0.950 | 10 |
| hybrid-rrf:potion-base-8M | topical | 30.0% | 0.152 | 10 |
| shipped-semantic:potion-base-8M | overall | 68.0% | 0.521 | 50 |
| shipped-semantic:potion-base-8M | semantic | 70.0% | 0.498 | 30 |
| shipped-semantic:potion-base-8M | lexical | 80.0% | 0.761 | 10 |
| shipped-semantic:potion-base-8M | topical | 50.0% | 0.349 | 10 |
| shipped-hybrid:potion-base-8M | overall | 72.0% | 0.559 | 50 |
| shipped-hybrid:potion-base-8M | semantic | 70.0% | 0.498 | 30 |
| shipped-hybrid:potion-base-8M | lexical | 100.0% | 0.950 | 10 |
| shipped-hybrid:potion-base-8M | topical | 50.0% | 0.349 | 10 |

## Query latency (warm)

| Condition | p50 | p90 | p95 | p99 |
| --- | ---: | ---: | ---: | ---: |
| lexical | 33.84 ms | 199.96 ms | 220.42 ms | 240.05 ms |
| semantic:potion-base-8M | 12.79 ms | 13.36 ms | 13.94 ms | 14.26 ms |
| hybrid-rrf:potion-base-8M | 46.76 ms | 210.69 ms | 236.05 ms | 270.27 ms |
| shipped-semantic:potion-base-8M | 13.61 ms | 14.02 ms | 14.44 ms | 15.00 ms |
| shipped-hybrid:potion-base-8M | 13.75 ms | 35.04 ms | 41.26 ms | 56.43 ms |

## Hybrid misses at 5 (error-analysis material)

- **sem-anemometer** (semantic): "instrument that measures the speed and pressure of wind" → expected Notes/Anemometer.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Hydraulics.md, Encyclopedia/H/Horn.md, 0 Inbox/Mecca.md, Encyclopedia/L/Ligao.md, Reference/Cloaca.md
- **sem-anglesite** (semantic): "mineral composed of lead sulphate" → expected Encyclopedia/A/Anglesite.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Copper.md, Encyclopedia/I/Irnerius.md, Encyclopedia/C/Chemistry.md, Encyclopedia/C/Calcite.md, Encyclopedia/M/Magnesite.md
- **sem-jaguar** (semantic): "largest wild cat found on the American continent" → expected Encyclopedia/J/Jaguar.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Canachus.md, Reference/India.md, Encyclopedia/G/Geography.md, Reference/Australia.md, Encyclopedia/I/Indo-China.md
- **sem-dahlia** (semantic): "Mexican garden flower named after a pupil of Linnaeus" → expected Sources/Dahlia.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Notes/Japan.md, 0 Inbox/Flower.md, Sources/Europe.md, Encyclopedia/I/Italy.md
- **sem-geyser** (semantic): "natural hot spring that periodically erupts a column of boiling water and steam" → expected Sources/Geyser.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Encyclopedia/E/Electric Eel.md, Sources/Cotton.md, Encyclopedia/B/Bacsanyi.md, Encyclopedia/D/Daille.md
- **sem-giraffe** (semantic): "the tallest living mammal, an African ruminant with a long neck" → expected Encyclopedia/G/Giraffe.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Reference/India.md, Encyclopedia/M/Madagascar.md, Encyclopedia/C/Chile.md, 0 Inbox/Mammalia.md
- **sem-guillotine** (semantic): "beheading machine of the French Revolution" → expected Sources/Guillotine.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/F/French Revolution.md, Notes/French Revolutionary Wars.md, Notes/History.md, Sources/Europe.md, Encyclopedia/I/Italy.md
- **sem-hurricane** (semantic): "violent tropical wind storm of the West Indies" → expected Reference/Hurricane.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/Australia.md, Reference/India.md, Notes/Argentina.md, Encyclopedia/A/Asia.md
- **sem-kite-bird** (semantic): "bird of prey once the most familiar in Great Britain, now among its rarest" → expected Encyclopedia/K/Kite.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Reference/India.md, Notes/Canachus.md, Encyclopedia/F/Flycatcher.md, Notes/Japan.md
- **sem-comet** (semantic): "nebulous celestial body travelling a highly eccentric orbit around the sun" → expected Reference/Comet.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Astronomy.md, Notes/Japan.md, 0 Inbox/Mecca.md, Notes/Horse.md, Encyclopedia/B/Babylon.md
- **sem-fog** (semantic): "suspended particles near the ground that make surrounding objects invisible" → expected Reference/Fog.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Encyclopedia/E/Electric Eel.md, Encyclopedia/M/Magnesite.md, 0 Inbox/Cap Haitien.md, Reference/Astronomy.md
- **sem-llama** (semantic): "domesticated South American pack animal of the camel family" → expected Notes/Llama.md
  - hybrid-rrf:potion-base-8M top 5: Reference/India.md, Reference/Australia.md, Encyclopedia/A/Asia.md, Notes/Horse.md, Encyclopedia/I/Indo-China.md
- **sem-fox-statesman** (semantic): "eighteenth century British statesman and orator, son of Lord Holland" → expected Encyclopedia/F/Fox.md
  - hybrid-rrf:potion-base-8M top 5: Reference/George.md, Encyclopedia/B/Belgium.md, Encyclopedia/L/Leeds.md, Encyclopedia/H/Harrowby.md, Notes/Japan.md
- **sem-darwin** (semantic): "Victorian naturalist who developed the theory of evolution by natural selection" → expected Sources/Darwin.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Evidence.md, Reference/Ethics.md, Sources/Aristotle.md, Reference/Australia.md, Encyclopedia/E/Embrun.md
- **sem-faraday** (semantic): "English scientist famous for discoveries in electromagnetism and electrochemistry" → expected Reference/Faraday.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/E/Electric Eel.md, Encyclopedia/C/Chemistry.md, Encyclopedia/M/Magnesite.md, Encyclopedia/L/Ligao.md, Notes/Japan.md
- **sem-machiavelli** (semantic): "Florentine political theorist whose name became a byword for cunning statecraft" → expected Encyclopedia/M/Machiavelli.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/I/Italy.md, Encyclopedia/E/English Law.md, Encyclopedia/F/Florence.md, Sources/Germanium.md, Notes/Japan.md
- **top-birds-of-prey** (topical): "birds of prey" → expected Reference/Eagle.md, Encyclopedia/H/Hawk.md, Encyclopedia/K/Kite.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/I/Italy.md, Reference/India.md, Notes/Humming-Bird.md, Reference/Australia.md, Encyclopedia/F/Frigate-Bird.md
- **top-big-cats** (topical): "large wild cats" → expected Encyclopedia/J/Jaguar.md, Encyclopedia/L/Leopard.md, Reference/Lynx.md
  - hybrid-rrf:potion-base-8M top 5: Reference/India.md, Encyclopedia/F/Fur.md, Encyclopedia/H/Himalaya.md, Reference/Australia.md, Notes/Canachus.md
- **top-green-gemstones** (topical): "green gemstones" → expected Encyclopedia/E/Emerald.md, Notes/Jade.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Greenockite.md, Encyclopedia/E/Epidote.md, Reference/Greensand.md, Notes/Marble.md, Reference/Apatite.md
- **top-weather** (topical): "violent weather phenomena" → expected Reference/Hurricane.md, Encyclopedia/H/Hail.md, Reference/Fog.md
  - hybrid-rrf:potion-base-8M top 5: Reference/India.md, Notes/Japan.md, Encyclopedia/C/Chile.md, Reference/Australia.md, Sources/Influenza.md
- **top-instruments** (topical): "musical instruments" → expected Reference/Flute.md, Sources/Drum.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Instrument.md, Encyclopedia/G/Guitar.md, Encyclopedia/C/Clarinet.md, Encyclopedia/K/Kettle.md, Encyclopedia/H/Harmonica.md
- **top-composers** (topical): "great German composers" → expected Sources/Beethoven.md, Encyclopedia/H/Handel.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Germanium.md, Sources/Hymettus.md, Notes/History.md, Encyclopedia/C/Chorale.md, Reference/Encyclical.md
- **top-dairy** (topical): "foods made from milk" → expected Encyclopedia/C/Cheese.md, Encyclopedia/B/Butter.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/D/Daille.md, Reference/Cattle.md, Notes/Canachus.md, Notes/Dietetics.md, Reference/India.md

## Gate verdict

> **Pre-registered gate:** hybrid RRF must beat lexical-only by ≥10 points hit@5 on the semantic subset, regress ≤2 points on the exact-term subset, and warm end-to-end semantic query (embed + scan) p95 ≤ 15 ms at 10k notes. +5..+10 points = discuss zone. Model choice = smallest model passing.

### potion-base-8M — SHIP

- semantic subset hit@5 +16.7 pts (gate ≥ +10): PASS
- lexical subset hit@5 0.0 pts (gate ≥ -2): PASS
- semantic warm p95 13.94 ms (gate ≤ 15 ms): PASS

**Overall: SHIP** — chosen model: potion-base-8M
