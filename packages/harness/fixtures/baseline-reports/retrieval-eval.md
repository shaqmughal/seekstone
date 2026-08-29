# Retrieval-quality eval (SHA-257 spike)

- **Snapshot:** 2026-08-29T21:46:35.590Z
- **Machine:** darwin/arm64, node v25.9.0, 16 cpus
- **Vault:** packages/harness/fixtures/vault (10000 notes)
- **Query set:** 150 queries (90 semantic, 30 lexical, 30 topical), 20 latency runs/query
- **Splits:** dev 90 (54/18/18), holdout 60 (36/12/12) — tuning reads dev only; gate v2 reports on holdout
- **Lexical index build:** 43833.00 ms
- **potion-retrieval-32M:** dim 512, 45964 chunks, index build 25453.25 ms, model load 90.27 ms
- **potion-base-8M:** dim 256, 45964 chunks, index build 27335.28 ms, model load 16.55 ms

## Retrieval quality

| Condition | Subset | hit@5 | MRR@10 | n |
| --- | --- | ---: | ---: | ---: |
| lexical | overall | 34.7% | 0.282 | 150 |
| lexical | semantic | 17.8% | 0.100 | 90 |
| lexical | lexical | 100.0% | 0.983 | 30 |
| lexical | topical | 20.0% | 0.125 | 30 |
| semantic:potion-retrieval-32M | overall | 82.7% | 0.641 | 150 |
| semantic:potion-retrieval-32M | semantic | 83.3% | 0.623 | 90 |
| semantic:potion-retrieval-32M | lexical | 100.0% | 0.942 | 30 |
| semantic:potion-retrieval-32M | topical | 63.3% | 0.395 | 30 |
| hybrid-rrf:potion-retrieval-32M | overall | 54.7% | 0.393 | 150 |
| hybrid-rrf:potion-retrieval-32M | semantic | 44.4% | 0.276 | 90 |
| hybrid-rrf:potion-retrieval-32M | lexical | 100.0% | 0.967 | 30 |
| hybrid-rrf:potion-retrieval-32M | topical | 40.0% | 0.170 | 30 |
| semantic:potion-base-8M | overall | 74.0% | 0.539 | 150 |
| semantic:potion-base-8M | semantic | 74.4% | 0.558 | 90 |
| semantic:potion-base-8M | lexical | 90.0% | 0.748 | 30 |
| semantic:potion-base-8M | topical | 56.7% | 0.274 | 30 |
| hybrid-rrf:potion-base-8M | overall | 52.0% | 0.391 | 150 |
| hybrid-rrf:potion-base-8M | semantic | 43.3% | 0.270 | 90 |
| hybrid-rrf:potion-base-8M | lexical | 100.0% | 0.983 | 30 |
| hybrid-rrf:potion-base-8M | topical | 30.0% | 0.162 | 30 |
| shipped-semantic:potion-retrieval-32M | overall | 82.7% | 0.641 | 150 |
| shipped-semantic:potion-retrieval-32M | semantic | 83.3% | 0.623 | 90 |
| shipped-semantic:potion-retrieval-32M | lexical | 100.0% | 0.942 | 30 |
| shipped-semantic:potion-retrieval-32M | topical | 63.3% | 0.395 | 30 |
| shipped-hybrid:potion-retrieval-32M | overall | 82.7% | 0.653 | 150 |
| shipped-hybrid:potion-retrieval-32M | semantic | 83.3% | 0.623 | 90 |
| shipped-hybrid:potion-retrieval-32M | lexical | 100.0% | 1.000 | 30 |
| shipped-hybrid:potion-retrieval-32M | topical | 63.3% | 0.395 | 30 |

## Retrieval quality by split (SHA-312)

Dev is the tuning split; holdout is the reporting split for gate v2.

| Condition | Split | Subset | hit@5 | MRR@10 | n |
| --- | --- | --- | ---: | ---: | ---: |
| lexical | dev | overall | 37.8% | 0.282 | 90 |
| lexical | dev | semantic | 24.1% | 0.122 | 54 |
| lexical | dev | lexical | 100.0% | 0.972 | 18 |
| lexical | dev | topical | 16.7% | 0.075 | 18 |
| lexical | holdout | overall | 30.0% | 0.281 | 60 |
| lexical | holdout | semantic | 8.3% | 0.068 | 36 |
| lexical | holdout | lexical | 100.0% | 1.000 | 12 |
| lexical | holdout | topical | 25.0% | 0.201 | 12 |
| semantic:potion-retrieval-32M | dev | overall | 81.1% | 0.634 | 90 |
| semantic:potion-retrieval-32M | dev | semantic | 81.5% | 0.608 | 54 |
| semantic:potion-retrieval-32M | dev | lexical | 100.0% | 0.931 | 18 |
| semantic:potion-retrieval-32M | dev | topical | 61.1% | 0.417 | 18 |
| semantic:potion-retrieval-32M | holdout | overall | 85.0% | 0.651 | 60 |
| semantic:potion-retrieval-32M | holdout | semantic | 86.1% | 0.645 | 36 |
| semantic:potion-retrieval-32M | holdout | lexical | 100.0% | 0.958 | 12 |
| semantic:potion-retrieval-32M | holdout | topical | 66.7% | 0.361 | 12 |
| hybrid-rrf:potion-retrieval-32M | dev | overall | 54.4% | 0.397 | 90 |
| hybrid-rrf:potion-retrieval-32M | dev | semantic | 46.3% | 0.303 | 54 |
| hybrid-rrf:potion-retrieval-32M | dev | lexical | 100.0% | 0.944 | 18 |
| hybrid-rrf:potion-retrieval-32M | dev | topical | 33.3% | 0.129 | 18 |
| hybrid-rrf:potion-retrieval-32M | holdout | overall | 55.0% | 0.388 | 60 |
| hybrid-rrf:potion-retrieval-32M | holdout | semantic | 41.7% | 0.236 | 36 |
| hybrid-rrf:potion-retrieval-32M | holdout | lexical | 100.0% | 1.000 | 12 |
| hybrid-rrf:potion-retrieval-32M | holdout | topical | 50.0% | 0.231 | 12 |
| semantic:potion-base-8M | dev | overall | 68.9% | 0.531 | 90 |
| semantic:potion-base-8M | dev | semantic | 70.4% | 0.542 | 54 |
| semantic:potion-base-8M | dev | lexical | 83.3% | 0.727 | 18 |
| semantic:potion-base-8M | dev | topical | 50.0% | 0.305 | 18 |
| semantic:potion-base-8M | holdout | overall | 81.7% | 0.551 | 60 |
| semantic:potion-base-8M | holdout | semantic | 80.6% | 0.582 | 36 |
| semantic:potion-base-8M | holdout | lexical | 100.0% | 0.781 | 12 |
| semantic:potion-base-8M | holdout | topical | 66.7% | 0.227 | 12 |
| hybrid-rrf:potion-base-8M | dev | overall | 50.0% | 0.388 | 90 |
| hybrid-rrf:potion-base-8M | dev | semantic | 42.6% | 0.286 | 54 |
| hybrid-rrf:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-rrf:potion-base-8M | dev | topical | 22.2% | 0.110 | 18 |
| hybrid-rrf:potion-base-8M | holdout | overall | 55.0% | 0.396 | 60 |
| hybrid-rrf:potion-base-8M | holdout | semantic | 44.4% | 0.246 | 36 |
| hybrid-rrf:potion-base-8M | holdout | lexical | 100.0% | 1.000 | 12 |
| hybrid-rrf:potion-base-8M | holdout | topical | 41.7% | 0.240 | 12 |
| shipped-semantic:potion-retrieval-32M | dev | overall | 81.1% | 0.634 | 90 |
| shipped-semantic:potion-retrieval-32M | dev | semantic | 81.5% | 0.608 | 54 |
| shipped-semantic:potion-retrieval-32M | dev | lexical | 100.0% | 0.931 | 18 |
| shipped-semantic:potion-retrieval-32M | dev | topical | 61.1% | 0.417 | 18 |
| shipped-semantic:potion-retrieval-32M | holdout | overall | 85.0% | 0.651 | 60 |
| shipped-semantic:potion-retrieval-32M | holdout | semantic | 86.1% | 0.645 | 36 |
| shipped-semantic:potion-retrieval-32M | holdout | lexical | 100.0% | 0.958 | 12 |
| shipped-semantic:potion-retrieval-32M | holdout | topical | 66.7% | 0.361 | 12 |
| shipped-hybrid:potion-retrieval-32M | dev | overall | 81.1% | 0.648 | 90 |
| shipped-hybrid:potion-retrieval-32M | dev | semantic | 81.5% | 0.608 | 54 |
| shipped-hybrid:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| shipped-hybrid:potion-retrieval-32M | dev | topical | 61.1% | 0.417 | 18 |
| shipped-hybrid:potion-retrieval-32M | holdout | overall | 85.0% | 0.659 | 60 |
| shipped-hybrid:potion-retrieval-32M | holdout | semantic | 86.1% | 0.645 | 36 |
| shipped-hybrid:potion-retrieval-32M | holdout | lexical | 100.0% | 1.000 | 12 |
| shipped-hybrid:potion-retrieval-32M | holdout | topical | 66.7% | 0.361 | 12 |

## Query latency (warm) & payload

| Condition | p50 | p90 | p95 | p99 | payload/query |
| --- | ---: | ---: | ---: | ---: | ---: |
| lexical | 49.91 ms | 220.56 ms | 266.63 ms | 490.70 ms | in-process |
| semantic:potion-retrieval-32M | 22.41 ms | 23.36 ms | 23.79 ms | 24.76 ms | in-process |
| hybrid-rrf:potion-retrieval-32M | 80.64 ms | 275.12 ms | 313.53 ms | 601.63 ms | in-process |
| semantic:potion-base-8M | 13.00 ms | 14.20 ms | 14.60 ms | 16.07 ms | in-process |
| hybrid-rrf:potion-base-8M | 62.73 ms | 231.51 ms | 263.54 ms | 476.63 ms | in-process |
| shipped-semantic:potion-retrieval-32M | 25.77 ms | 27.40 ms | 28.07 ms | 30.36 ms | in-process |
| shipped-hybrid:potion-retrieval-32M | 25.40 ms | 49.66 ms | 59.13 ms | 115.65 ms | in-process |

## Hybrid misses at 5 (error-analysis material)

- **sem-anemometer** (semantic): "instrument that measures the speed and pressure of wind" → expected Notes/Anemometer.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Hydraulics.md, Notes/Japan.md, Encyclopedia/H/Horn.md, Reference/Cloaca.md, Encyclopedia/L/Ligao.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Hydraulics.md, Encyclopedia/H/Horn.md, 0 Inbox/Mecca.md, Encyclopedia/L/Ligao.md, Reference/Cloaca.md
- **sem-anglesite** (semantic): "mineral composed of lead sulphate" → expected Encyclopedia/A/Anglesite.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Copper.md, Encyclopedia/I/Irnerius.md, Encyclopedia/C/Chemistry.md, Encyclopedia/C/Calcite.md, Encyclopedia/B/Barytes.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Copper.md, Encyclopedia/I/Irnerius.md, Encyclopedia/C/Chemistry.md, Encyclopedia/C/Calcite.md, Encyclopedia/M/Magnesite.md
- **sem-jaguar** (semantic): "largest wild cat found on the American continent" → expected Encyclopedia/J/Jaguar.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/India.md, Encyclopedia/F/Fur.md, Reference/Australia.md, 0 Inbox/Mammalia.md, Notes/Argentina.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Canachus.md, Reference/India.md, Encyclopedia/G/Geography.md, Reference/Australia.md, Encyclopedia/I/Indo-China.md
- **sem-dahlia** (semantic): "Mexican garden flower named after a pupil of Linnaeus" → expected Sources/Dahlia.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Notes/Japan.md, Sources/Cotton.md, 0 Inbox/Flower.md, Encyclopedia/I/Italy.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Notes/Japan.md, 0 Inbox/Flower.md, Sources/Europe.md, Encyclopedia/I/Italy.md
- **sem-geyser** (semantic): "natural hot spring that periodically erupts a column of boiling water and steam" → expected Sources/Geyser.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Notes/Japan.md, Reference/Hydraulics.md, Reference/Australia.md, Encyclopedia/E/Electric Eel.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Encyclopedia/E/Electric Eel.md, Sources/Cotton.md, Encyclopedia/B/Bacsanyi.md, Encyclopedia/D/Daille.md
- **sem-giraffe** (semantic): "the tallest living mammal, an African ruminant with a long neck" → expected Encyclopedia/G/Giraffe.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Australia.md, 0 Inbox/Mammalia.md, Encyclopedia/A/Asia.md, Reference/India.md, Sources/Evidence.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Reference/India.md, Encyclopedia/M/Madagascar.md, Encyclopedia/C/Chile.md, 0 Inbox/Mammalia.md
- **sem-guillotine** (semantic): "beheading machine of the French Revolution" → expected Sources/Guillotine.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/F/French Revolution.md, Notes/French Revolutionary Wars.md, Sources/Europe.md, Notes/History.md, Encyclopedia/I/Italy.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/F/French Revolution.md, Notes/French Revolutionary Wars.md, Notes/History.md, Sources/Europe.md, Encyclopedia/I/Italy.md
- **sem-hurricane** (semantic): "violent tropical wind storm of the West Indies" → expected Reference/Hurricane.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Reference/India.md, Sources/Europe.md, Reference/Hydraulics.md, Notes/Argentina.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/Australia.md, Reference/India.md, Notes/Argentina.md, Encyclopedia/A/Asia.md
- **sem-kite-bird** (semantic): "bird of prey once the most familiar in Great Britain, now among its rarest" → expected Encyclopedia/K/Kite.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Reference/India.md, Notes/Canachus.md, Encyclopedia/F/Flycatcher.md, Notes/Japan.md
- **sem-comet** (semantic): "nebulous celestial body travelling a highly eccentric orbit around the sun" → expected Reference/Comet.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Astronomy.md, Sources/Hindostani.md, 0 Inbox/Mecca.md, Notes/Japan.md, Encyclopedia/L/Ligao.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Astronomy.md, Notes/Japan.md, 0 Inbox/Mecca.md, Notes/Horse.md, Encyclopedia/B/Babylon.md
- **sem-fog** (semantic): "suspended particles near the ground that make surrounding objects invisible" → expected Reference/Fog.md
  - hybrid-rrf:potion-retrieval-32M top 5: 0 Inbox/Mecca.md, Encyclopedia/L/Ligao.md, Reference/Astronomy.md, Encyclopedia/M/Magnesite.md, Encyclopedia/E/Electric Eel.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Encyclopedia/E/Electric Eel.md, Encyclopedia/M/Magnesite.md, 0 Inbox/Cap Haitien.md, Reference/Astronomy.md
- **sem-llama** (semantic): "domesticated South American pack animal of the camel family" → expected Notes/Llama.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Australia.md, Reference/India.md, Sources/Family.md, Encyclopedia/I/Indo-China.md, Encyclopedia/C/Civilis.md
  - hybrid-rrf:potion-base-8M top 5: Reference/India.md, Reference/Australia.md, Encyclopedia/A/Asia.md, Notes/Horse.md, Encyclopedia/I/Indo-China.md
- **sem-fox-statesman** (semantic): "eighteenth century British statesman and orator, son of Lord Holland" → expected Encyclopedia/F/Fox.md
  - hybrid-rrf:potion-base-8M top 5: Reference/George.md, Encyclopedia/B/Belgium.md, Encyclopedia/L/Leeds.md, Encyclopedia/H/Harrowby.md, Notes/Japan.md
- **sem-darwin** (semantic): "Victorian naturalist who developed the theory of evolution by natural selection" → expected Sources/Darwin.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Evidence.md, Reference/Ethics.md, Encyclopedia/E/Embrun.md, Encyclopedia/F/Fine Arts.md, Sources/Aristotle.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Evidence.md, Reference/Ethics.md, Sources/Aristotle.md, Reference/Australia.md, Encyclopedia/E/Embrun.md
- **sem-faraday** (semantic): "English scientist famous for discoveries in electromagnetism and electrochemistry" → expected Reference/Faraday.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/E/Electric Eel.md, Encyclopedia/C/Chemistry.md, Encyclopedia/M/Magnesite.md, Notes/Japan.md, Encyclopedia/I/Italy.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/E/Electric Eel.md, Encyclopedia/C/Chemistry.md, Encyclopedia/M/Magnesite.md, Encyclopedia/L/Ligao.md, Notes/Japan.md
- **sem-machiavelli** (semantic): "Florentine political theorist whose name became a byword for cunning statecraft" → expected Encyclopedia/M/Machiavelli.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/I/Italy.md, Encyclopedia/E/English Law.md, Sources/Europe.md, Encyclopedia/F/Florence.md, Sources/Aristotle.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/I/Italy.md, Encyclopedia/E/English Law.md, Encyclopedia/F/Florence.md, Sources/Germanium.md, Notes/Japan.md
- **top-birds-of-prey** (topical): "birds of prey" → expected Reference/Eagle.md, Encyclopedia/H/Hawk.md, Encyclopedia/K/Kite.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/India.md, Notes/Humming-Bird.md, Encyclopedia/F/Frigate-Bird.md, Reference/Australia.md, Encyclopedia/K/Kestrel.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/I/Italy.md, Reference/India.md, Notes/Humming-Bird.md, Reference/Australia.md, Encyclopedia/F/Frigate-Bird.md
- **top-big-cats** (topical): "large wild cats" → expected Encyclopedia/J/Jaguar.md, Encyclopedia/L/Leopard.md, Reference/Lynx.md
  - hybrid-rrf:potion-base-8M top 5: Reference/India.md, Encyclopedia/F/Fur.md, Encyclopedia/H/Himalaya.md, Reference/Australia.md, Notes/Canachus.md
- **top-green-gemstones** (topical): "green gemstones" → expected Encyclopedia/E/Emerald.md, Notes/Jade.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Green Bay.md, Notes/Green Ribbon Club.md, Encyclopedia/B/Bowling Green.md, Notes/Greenockite.md, Reference/Greensand.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Greenockite.md, Encyclopedia/E/Epidote.md, Reference/Greensand.md, Notes/Marble.md, Reference/Apatite.md
- **top-weather** (topical): "violent weather phenomena" → expected Reference/Hurricane.md, Encyclopedia/H/Hail.md, Reference/Fog.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Encyclopedia/C/Chile.md, Reference/India.md, Encyclopedia/B/Breaking Bulk.md, Reference/Australia.md
  - hybrid-rrf:potion-base-8M top 5: Reference/India.md, Notes/Japan.md, Encyclopedia/C/Chile.md, Reference/Australia.md, Sources/Influenza.md
- **top-instruments** (topical): "musical instruments" → expected Reference/Flute.md, Sources/Drum.md
  - hybrid-rrf:potion-retrieval-32M top 5: 0 Inbox/Instrument.md, Encyclopedia/G/Guitar.md, Encyclopedia/H/Horn.md, Reference/Keyboard.md, Reference/Bombardon.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Instrument.md, Encyclopedia/G/Guitar.md, Encyclopedia/C/Clarinet.md, Encyclopedia/K/Kettle.md, Encyclopedia/H/Harmonica.md
- **top-composers** (topical): "great German composers" → expected Sources/Beethoven.md, Encyclopedia/H/Handel.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Germanium.md, Notes/History.md, Reference/Bastian.md, Sources/Hymettus.md, Encyclopedia/C/Chorale.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Germanium.md, Sources/Hymettus.md, Notes/History.md, Encyclopedia/C/Chorale.md, Reference/Encyclical.md
- **top-dairy** (topical): "foods made from milk" → expected Encyclopedia/C/Cheese.md, Encyclopedia/B/Butter.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/D/Daille.md, Reference/Cattle.md, Notes/Dietetics.md, Notes/Canachus.md, Reference/India.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/D/Daille.md, Reference/Cattle.md, Notes/Canachus.md, Notes/Dietetics.md, Reference/India.md
- **sem-astrolabe** (semantic): "ancient instrument for taking the altitude of stars, sun and moon" → expected Encyclopedia/A/Astrolabe.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Astronomy.md, Sources/Hindostani.md, Notes/Japan.md, Sources/Aristotle.md, Encyclopedia/L/Ligao.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Astronomy.md, Sources/Hindostani.md, Notes/Japan.md, Reference/India.md, Encyclopedia/I/Italy.md
- **sem-astrology** (semantic): "art of divining human fate from the positions of the heavenly bodies" → expected Encyclopedia/A/Astrology.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Reference/Astronomy.md, Reference/Ethics.md, Encyclopedia/B/Babylon.md, Sources/Aristotle.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Aristotle.md, Notes/Japan.md, Encyclopedia/E/English Law.md, Encyclopedia/B/Babylon.md, Encyclopedia/H/Hinduism.md
- **sem-avalanche** (semantic): "mass of snow and ice rushing down a mountainside carrying everything before it" → expected Encyclopedia/A/Avalanche.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Europe.md, Encyclopedia/I/Ireland.md, Notes/Japan.md, Encyclopedia/I/Italy.md, Notes/Canachus.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Sources/Europe.md, Encyclopedia/I/Ireland.md, Reference/India.md, Reference/Australia.md
- **sem-brick** (semantic): "artificial stone of burnt clay used as a building material" → expected Encyclopedia/B/Brick.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Encyclopedia/B/Babylon.md, Encyclopedia/F/Fine Arts.md, Encyclopedia/I/Ireland.md, 0 Inbox/Mecca.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Encyclopedia/F/Fine Arts.md, Encyclopedia/B/Babylon.md, Encyclopedia/M/Magnesite.md, Encyclopedia/F/Fire Brat.md
- **sem-mars** (semantic): "the reddish fourth planet in order of distance from the sun" → expected Reference/Mars.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Astronomy.md, Sources/Aristotle.md, Sources/Hindostani.md, Encyclopedia/L/Ligao.md, Sources/Map.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Astronomy.md, Notes/Japan.md, Sources/Europe.md, Encyclopedia/L/Ligao.md, Sources/Map.md
- **sem-caravan** (semantic): "body of traders travelling together for security against robbers" → expected Reference/Caravan.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/India.md, Notes/Japan.md, Reference/Labour Exchange.md, Encyclopedia/I/Italy.md, Sources/Cotton.md
  - hybrid-rrf:potion-base-8M top 5: Reference/India.md, Reference/Labour Exchange.md, Notes/Japan.md, Encyclopedia/I/Italy.md, Sources/Cotton.md
- **sem-carnival** (semantic): "days of feasting and merrymaking before Lent" → expected Notes/Carnival.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Lent.md, Encyclopedia/F/Fasting.md, Encyclopedia/E/Eucharist.md, 0 Inbox/Mecca.md, Encyclopedia/C/Crusades.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Lent.md, Encyclopedia/F/Fasting.md, Encyclopedia/E/Eucharist.md, Encyclopedia/M/Madagascar.md, Encyclopedia/D/Daille.md
- **sem-clover** (semantic): "plant of the pea family named for its three leaflets" → expected Sources/Clover.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Sources/Cotton.md, Encyclopedia/L/Leaf.md, Encyclopedia/I/Italy.md, 0 Inbox/Flower.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Encyclopedia/I/Italy.md, Reference/Australia.md, Encyclopedia/L/Leaf.md, Sources/Cotton.md
- **sem-cormorant** (semantic): "large sea fowl named from the Latin for sea raven" → expected Encyclopedia/C/Cormorant.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Encyclopedia/I/Italy.md, Encyclopedia/L/Latium.md, Reference/India.md, Sources/Europe.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Encyclopedia/G/Geography.md, Reference/Australia.md, Encyclopedia/I/Italy.md, Encyclopedia/B/Baltic Sea.md
- **sem-crown-coin** (semantic): "English silver coin of the value of five shillings" → expected Reference/Crown.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Reference/India.md, Encyclopedia/C/Coin.md, Notes/Canachus.md, Notes/History.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Encyclopedia/E/Exchange.md, Reference/India.md, Notes/History.md, Encyclopedia/C/Coin.md
- **sem-desert** (semantic): "land too barren of vegetation to support a human population" → expected Encyclopedia/D/Desert.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Australia.md, Reference/India.md, Encyclopedia/I/Ireland.md, Encyclopedia/G/Geography.md, Encyclopedia/C/Chile.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Encyclopedia/G/Geography.md, Encyclopedia/A/Asia.md, Encyclopedia/I/Italy.md, Notes/Argentina.md
- **sem-equator** (semantic): "great circle equidistant from the two poles dividing the hemispheres" → expected Encyclopedia/E/Equator.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Map.md, 0 Inbox/Mecca.md, Reference/Astronomy.md, Reference/Geodesy.md, Encyclopedia/M/Magnesite.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Map.md, Reference/Astronomy.md, 0 Inbox/Mecca.md, Encyclopedia/M/Magnesite.md, Encyclopedia/E/Electrokinetics.md
- **sem-feather** (semantic): "horny outgrowth of the skin that distinguishes birds from all other animals" → expected Encyclopedia/F/Feather.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/E/Embrun.md, Reference/India.md, 0 Inbox/Mammalia.md, Reference/Australia.md, Encyclopedia/I/Italy.md
  - hybrid-rrf:potion-base-8M top 5: Reference/India.md, Reference/Australia.md, Encyclopedia/I/Italy.md, 0 Inbox/Mammalia.md, Encyclopedia/M/Madagascar.md
- **sem-flag** (semantic): "piece of bunting waved from a staff as a standard, ensign or signal" → expected Encyclopedia/F/Flag.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Hydraulics.md, 0 Inbox/Mecca.md, Encyclopedia/K/Knight.md, Sources/Cotton.md, Reference/Astronomy.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Notes/Japan.md, Reference/Astronomy.md, Reference/Hydraulics.md, Encyclopedia/L/Ligao.md
- **sem-flood-statesman** (semantic): "Irish statesman, son of a chief justice of the king's bench in Ireland" → expected Notes/Flood.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/I/Ireland.md, Encyclopedia/C/Celt.md, Encyclopedia/C/Crimea.md, Encyclopedia/C/Cromwell.md, Notes/Japan.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/I/Ireland.md, Reference/Australia.md, Encyclopedia/C/Crimea.md, Encyclopedia/C/Celt.md, Notes/Canachus.md
- **sem-gong** (semantic): "broad thin bronze disk with a deep rim struck as an instrument of Chinese origin" → expected Encyclopedia/G/Gong.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Reference/Astronomy.md, Reference/Hydraulics.md, Encyclopedia/A/Asia.md, Notes/Horse.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/Hydraulics.md, Encyclopedia/F/Fine Arts.md, Reference/Australia.md, Encyclopedia/D/Drama.md
- **sem-grasshopper** (semantic): "leaping insect with powerful hind legs that stridulates" → expected Encyclopedia/G/Grasshopper.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/C/Coleoptera.md, Encyclopedia/H/Hexapoda.md, Encyclopedia/I/Insect.md, Encyclopedia/E/Entomology.md, Encyclopedia/B/Bee.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/C/Coleoptera.md, Encyclopedia/H/Hexapoda.md, Encyclopedia/I/Insect.md, Sources/Lepidoptera.md, Encyclopedia/I/Insectivora.md
- **sem-gravitation** (semantic): "mutual attraction between masses varying inversely as the square of their distance" → expected Encyclopedia/G/Gravitation.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Astronomy.md, Encyclopedia/M/Magnesite.md, 0 Inbox/Mecca.md, Encyclopedia/E/Electric Eel.md, 0 Inbox/Cap Haitien.md
- **sem-hibernation** (semantic): "dormant state in which animals pass the winter" → expected Encyclopedia/H/Hibernation.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Europe.md, Notes/Japan.md, Sources/Horticulture.md, Notes/Canachus.md, Reference/India.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Europe.md, Encyclopedia/I/Italy.md, Notes/Japan.md, Sources/Horticulture.md, Reference/India.md
- **sem-ice** (semantic): "solid crystalline form that water assumes at low temperature" → expected 0 Inbox/Ice.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/C/Chemistry.md, Encyclopedia/F/Fusion.md, Encyclopedia/M/Magnesite.md, 0 Inbox/Cap Haitien.md, Reference/Hydraulics.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/C/Chemistry.md, Encyclopedia/F/Fusion.md, Encyclopedia/M/Magnesite.md, Sources/Horticulture.md, 0 Inbox/Cap Haitien.md
- **sem-jury** (semantic): "body of laymen sworn to ascertain the truth of facts under the guidance of a judge" → expected Reference/Jury.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Evidence.md, Encyclopedia/C/Crimea.md, Reference/India.md, Encyclopedia/I/Ireland.md, Encyclopedia/C/Chile.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Evidence.md, Encyclopedia/E/English Law.md, Encyclopedia/C/Crimea.md, Encyclopedia/E/Edric.md, Encyclopedia/E/England.md
- **sem-lagoon** (semantic): "sheet of shallow water near the sea or enclosed by an atoll" → expected Reference/Lagoon.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Reference/Australia.md, Encyclopedia/A/Asia.md, Encyclopedia/G/Geography.md, Encyclopedia/A/Athenry.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Notes/Japan.md, Encyclopedia/I/Ireland.md, Encyclopedia/G/Geography.md, Encyclopedia/C/Chile.md
- **sem-lantern** (semantic): "case of transparent material protecting a light from rain and wind" → expected Reference/Lantern.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Sources/Horticulture.md, Sources/Europe.md, Reference/India.md, Encyclopedia/E/Electric Eel.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Notes/Japan.md, Sources/Europe.md, Sources/Cotton.md, Encyclopedia/A/Asia.md
- **sem-lithography** (semantic): "printing from a design drawn on stone, relying on the antagonism of grease and water" → expected Reference/Lithography.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Sources/Horticulture.md, Sources/Map.md, Sources/Cotton.md, 0 Inbox/Mecca.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/C/Chemistry.md, Notes/Japan.md, Sources/Map.md, Sources/Evidence.md, Reference/Ethics.md
- **sem-marble** (semantic): "limestone close enough in texture to admit of being polished" → expected Notes/Marble.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/I/Ireland.md, Encyclopedia/M/Magnesite.md, Sources/Horticulture.md, Encyclopedia/L/Limestone.md, Notes/Japan.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/Ethics.md, Sources/Horticulture.md, Encyclopedia/E/Edric.md, Encyclopedia/F/Fine Arts.md
- **sem-mead-physician** (semantic): "English physician, eleventh child of an Independent divine, who graduated at Padua" → expected Reference/Mead.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/H/Harvey.md, Reference/Ethics.md, Encyclopedia/I/Italy.md, Sources/Macedonian Empire.md, Encyclopedia/D/Dante.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/H/Harvey.md, Reference/Leonardo Da Vinci.md, Encyclopedia/I/Italy.md, Notes/Assarotti.md, Notes/Japan.md
- **sem-helium** (semantic): "gaseous element named after the sun, discovered soon after argon" → expected Encyclopedia/H/Helium.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/C/Chemistry.md, Encyclopedia/A/Argon.md, Sources/Aristotle.md, Reference/Astronomy.md, Encyclopedia/A/Atom.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/C/Chemistry.md, Encyclopedia/A/Argon.md, Encyclopedia/M/Magnesite.md, Reference/Astronomy.md, Sources/Germanium.md
- **sem-hare** (semantic): "well-known English rodent allied to the rabbit, with an Alpine mountain relative" → expected Notes/Hare.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Australia.md, Encyclopedia/I/Italy.md, Notes/Canachus.md, Notes/Japan.md, 0 Inbox/Mammalia.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Encyclopedia/I/Italy.md, Notes/Japan.md, Encyclopedia/C/Chile.md, Reference/India.md
- **sem-lamprey** (semantic): "jawless stone-sucking fish with a cartilaginous skeleton" → expected Sources/Lamprey.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/C/Cephalopoda.md, Reference/Australia.md, Encyclopedia/A/Asia.md, Encyclopedia/H/Hexapoda.md, Sources/Archaeology.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/C/Cephalopoda.md, Notes/Japan.md, Encyclopedia/H/Hexapoda.md, Notes/Horse.md, Encyclopedia/I/Ireland.md
- **sem-lacrosse** (semantic): "national ball game of Canada played with a curved netted stick" → expected 0 Inbox/Lacrosse.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Reference/Hydraulics.md, 0 Inbox/Mecca.md, Reference/Australia.md, Notes/Canachus.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Reference/Hydraulics.md, Notes/Canachus.md, Encyclopedia/D/Daille.md, Encyclopedia/B/Billiards.md
- **sem-haydn** (semantic): "Austrian composer of Croatian stock born at Rohrau" → expected Notes/Haydn.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Croatia-Slavonia.md, Notes/History.md, Sources/Europe.md, Reference/Australia.md, Encyclopedia/D/Dalmatia.md
- **sem-gray-poet** (semantic): "English poet whose mother kept a millinery shop in Cornhill" → expected 0 Inbox/Gray.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/C/Celt.md, Encyclopedia/E/English Law.md, Sources/Cotton.md, Encyclopedia/I/Ireland.md, Sources/Horticulture.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/C/Celt.md, Encyclopedia/I/Ireland.md, Encyclopedia/E/English Law.md, Sources/Hindostani.md, Notes/Japan.md
- **sem-edison** (semantic): "American inventor who began as a railway news-boy experimenting in chemistry" → expected Encyclopedia/E/Edison.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/C/Chemistry.md, Sources/Cotton.md, Encyclopedia/E/Electric Eel.md, Encyclopedia/M/Magnesite.md, Encyclopedia/D/Deadwood.md
- **sem-matterhorn** (semantic): "famous Alpine peak above Zermatt on the frontier of Switzerland and Italy" → expected Encyclopedia/M/Matterhorn.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/I/Italy.md, Sources/Europe.md, Notes/French Revolutionary Wars.md, Reference/Australia.md, Notes/History.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/I/Italy.md, Sources/Europe.md, Notes/Japan.md, Reference/Australia.md, Reference/India.md
- **sem-lemming** (semantic): "small Scandinavian rodent of the mouse tribe related to the voles" → expected Encyclopedia/L/Lemming.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Australia.md, Notes/Japan.md, 0 Inbox/Mammalia.md, Encyclopedia/F/Fur.md, Reference/India.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mammalia.md, Encyclopedia/I/Ireland.md, Encyclopedia/A/Asia.md, Reference/Australia.md, Encyclopedia/F/Fur.md
- **sem-anvil** (semantic): "mass of iron on which material is supported while shaped under the hammer" → expected Reference/Anvil.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Encyclopedia/M/Magnesite.md, Reference/Australia.md, Encyclopedia/I/Italy.md, Reference/Cloaca.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/Australia.md, Encyclopedia/M/Magnesite.md, 0 Inbox/Mecca.md, Sources/Europe.md
- **sem-catapult** (semantic): "warlike engine of the cross-bow type used by the ancients" → expected 0 Inbox/Catapult.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Encyclopedia/C/Cross.md, Reference/Hydraulics.md, Encyclopedia/I/Inscriptions.md, Sources/Dream.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Sources/Europe.md, Encyclopedia/C/Cross.md, Encyclopedia/I/Ireland.md, Sources/Hymettus.md
- **top-orchard-fruits** (topical): "fruits grown in gardens and orchards" → expected Reference/Apple.md, Sources/Gooseberry.md, Sources/Lemon.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Notes/Canachus.md, Encyclopedia/I/Italy.md, Reference/India.md, Notes/Japan.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Notes/Canachus.md, Encyclopedia/I/Italy.md, Sources/Europe.md, Sources/Guiana.md
- **top-english-poets** (topical): "lives of the English poets" → expected Encyclopedia/B/Byron.md, Notes/Chaucer.md, Encyclopedia/D/Dryden.md, 0 Inbox/Gray.md, Notes/Cowper.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/C/Celt.md, Encyclopedia/E/English Law.md, Encyclopedia/D/Drama.md, Notes/Japan.md, Sources/Arnold.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/E/English Law.md, Encyclopedia/C/Celt.md, Notes/Japan.md, Encyclopedia/I/Iceland.md, Sources/Hindostani.md
- **top-british-philosophers** (topical): "British philosophers of the seventeenth and eighteenth centuries" → expected Encyclopedia/L/Locke.md, Reference/Berkeley.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Aristotle.md, Reference/Ethics.md, Encyclopedia/E/English Law.md, Sources/Germanium.md, Encyclopedia/E/Edric.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/I/Ireland.md, Sources/Europe.md, Sources/Germanium.md, Reference/Astronomy.md, Encyclopedia/F/Folkes.md
- **top-classical-deities** (topical): "gods and goddesses of Greek and Roman mythology" → expected Sources/Apollo.md, Sources/Hermes.md, Notes/Dionysus.md, Reference/Hera.md, Encyclopedia/J/Juno.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/A/Aphrodite.md, Reference/Ares.md, Encyclopedia/D/Drama.md, Reference/Hephaestus.md, Encyclopedia/I/Isis.md
- **top-trees** (topical): "broad-leaved and evergreen trees" → expected Sources/Beech.md, Encyclopedia/B/Birch.md, Encyclopedia/E/Elm.md, Encyclopedia/M/Maple.md, Encyclopedia/C/Cypress.md, Encyclopedia/H/Holly.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Encyclopedia/F/Forest Laws.md, Sources/Laureate.md, Sources/Lebanon.md, Sources/Bosnia And Herzegovina.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/F/Forest Laws.md, Sources/Laureate.md, Sources/Bosnia And Herzegovina.md, Sources/Horticulture.md, Sources/Lebanon.md
- **top-great-rivers** (topical): "great rivers of the world" → expected Encyclopedia/E/Euphrates.md, Encyclopedia/G/Ganges.md, Encyclopedia/E/Elbe.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Europe.md, Notes/Japan.md, Reference/Australia.md, Reference/India.md, Reference/Hydraulics.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Europe.md, Reference/Australia.md, Notes/Canachus.md, Encyclopedia/G/Geography.md, Sources/Germanium.md
- **top-outdoor-ball-games** (topical): "outdoor games played with a ball" → expected Encyclopedia/G/Golf.md, Encyclopedia/C/Croquet.md, 0 Inbox/Lacrosse.md
  - hybrid-rrf:potion-retrieval-32M top 5: 0 Inbox/Mecca.md, Encyclopedia/G/Games.md, Encyclopedia/F/Fine Arts.md, Encyclopedia/B/Billiards.md, Encyclopedia/I/Italy.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/G/Games.md, Encyclopedia/B/Billiards.md, Encyclopedia/I/Italy.md, Encyclopedia/B/Bagatelle.md, Notes/Japan.md
- **top-indoor-games** (topical): "indoor games of skill played on a table or board" → expected Encyclopedia/B/Billiards.md, Encyclopedia/D/Draughts.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/G/Games.md, Encyclopedia/I/Ireland.md, Encyclopedia/F/Fine Arts.md, Encyclopedia/D/Drama.md, Encyclopedia/H/Halma.md
- **top-british-birds** (topical): "familiar birds of the British countryside" → expected Reference/Cuckoo.md, Encyclopedia/M/Magpie.md, Encyclopedia/L/Lark.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Humming-Bird.md, Reference/India.md, Reference/Australia.md, Notes/Canachus.md, Notes/Japan.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Notes/Canachus.md, Sources/Europe.md, Encyclopedia/E/English Law.md, Encyclopedia/F/Flycatcher.md
- **top-sea-fishes** (topical): "fishes of the open sea" → expected Encyclopedia/C/Cod.md, Notes/Mackerel.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Reference/India.md, Encyclopedia/I/Ireland.md, Reference/Australia.md, Sources/Caspian Sea.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/India.md, Reference/Australia.md, Encyclopedia/I/Italy.md, Sources/Caspian Sea.md
- **top-building-stones** (topical): "stones and materials used in building" → expected Encyclopedia/B/Brick.md, Notes/Marble.md, Encyclopedia/L/Limestone.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/I/Ireland.md, Sources/Horticulture.md, Encyclopedia/F/Fine Arts.md, 0 Inbox/Mecca.md, Encyclopedia/I/Inscriptions.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/F/Fine Arts.md, Notes/Japan.md, Encyclopedia/M/Magnesite.md, Encyclopedia/I/Ireland.md, Encyclopedia/I/Inscriptions.md
- **top-funerary-customs** (topical): "burial customs and monuments to the dead" → expected Sources/Cremation.md, Sources/Mausoleum.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Notes/Funeral Rites.md, Reference/Australia.md, Encyclopedia/A/Athenry.md, Sources/Archaeology.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Notes/Funeral Rites.md, Encyclopedia/I/Inscriptions.md, Reference/Australia.md, Encyclopedia/A/Athenry.md
- **top-light-sources** (topical): "devices for holding and carrying a light" → expected Encyclopedia/L/Lamp.md, Reference/Lantern.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Encyclopedia/L/Ligao.md, Encyclopedia/E/Electric Eel.md, Reference/Astronomy.md, Encyclopedia/F/Fine Arts.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Sources/Cotton.md, Reference/Hydraulics.md, Encyclopedia/E/Electric Eel.md, Sources/Dream.md
- **top-lead-ores** (topical): "minerals that are ores of lead" → expected Encyclopedia/C/Cerussite.md, Encyclopedia/A/Anglesite.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Australia.md, Encyclopedia/L/Leadville.md, Notes/Japan.md, Notes/Copper.md, Reference/India.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Notes/Canachus.md, Notes/Japan.md, Encyclopedia/L/Leadville.md, Encyclopedia/C/Chile.md

## Gate verdict

> **Pre-registered gate:** hybrid RRF must beat lexical-only by ≥10 points hit@5 on the semantic subset, regress ≤2 points on the exact-term subset, and warm end-to-end semantic query (embed + scan) p95 ≤ 15 ms at 10k notes. +5..+10 points = discuss zone. Model choice = smallest model passing.

### potion-retrieval-32M — NO-SHIP

- semantic subset hit@5 +26.7 pts (gate ≥ +10): PASS
- lexical subset hit@5 0.0 pts (gate ≥ -2): PASS
- semantic warm p95 23.79 ms (gate ≤ 15 ms): FAIL

### potion-base-8M — SHIP

- semantic subset hit@5 +25.6 pts (gate ≥ +10): PASS
- lexical subset hit@5 0.0 pts (gate ≥ -2): PASS
- semantic warm p95 14.60 ms (gate ≤ 15 ms): PASS

**Overall: SHIP** — chosen model: potion-base-8M
