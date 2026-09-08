# Retrieval-quality eval (SHA-257 spike)

- **Snapshot:** 2026-09-05T20:57:26.230Z
- **Machine:** darwin/arm64, node v25.9.0, 16 cpus
- **Vault:** packages/harness/fixtures/vault (10000 notes)
- **Query set:** 90 queries (54 semantic, 18 lexical, 18 topical) [dev split only], 20 latency runs/query
- **Splits:** dev 90 (54/18/18), holdout 0 (0/0/0) — tuning reads dev only; gate v2 reports on holdout
- **Lexical index build:** 1982713.00 ms
- **potion-base-8M:** dim 256, 45972 chunks, index build 39468.88 ms, model load 23.97 ms
- **potion-retrieval-32M:** dim 512, 45972 chunks, index build 33214.69 ms, model load 71.10 ms

## Retrieval quality

| Condition | Subset | hit@5 | MRR@10 | n |
| --- | --- | ---: | ---: | ---: |
| lexical | overall | 37.8% | 0.276 | 90 |
| lexical | semantic | 24.1% | 0.111 | 54 |
| lexical | lexical | 100.0% | 0.972 | 18 |
| lexical | topical | 16.7% | 0.075 | 18 |
| semantic:potion-base-8M | overall | 67.8% | 0.505 | 90 |
| semantic:potion-base-8M | semantic | 68.5% | 0.497 | 54 |
| semantic:potion-base-8M | lexical | 83.3% | 0.704 | 18 |
| semantic:potion-base-8M | topical | 50.0% | 0.330 | 18 |
| hybrid-rrf:potion-base-8M | overall | 48.9% | 0.379 | 90 |
| hybrid-rrf:potion-base-8M | semantic | 40.7% | 0.267 | 54 |
| hybrid-rrf:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-rrf:potion-base-8M | topical | 22.2% | 0.122 | 18 |
| semantic-top2:potion-base-8M | overall | 67.8% | 0.490 | 90 |
| semantic-top2:potion-base-8M | semantic | 63.0% | 0.433 | 54 |
| semantic-top2:potion-base-8M | lexical | 94.4% | 0.819 | 18 |
| semantic-top2:potion-base-8M | topical | 55.6% | 0.331 | 18 |
| hybrid-route:potion-base-8M | overall | 71.1% | 0.559 | 90 |
| hybrid-route:potion-base-8M | semantic | 68.5% | 0.497 | 54 |
| hybrid-route:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route:potion-base-8M | topical | 50.0% | 0.330 | 18 |
| hybrid-route-top2:potion-base-8M | overall | 68.9% | 0.520 | 90 |
| hybrid-route-top2:potion-base-8M | semantic | 63.0% | 0.433 | 54 |
| hybrid-route-top2:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-top2:potion-base-8M | topical | 55.6% | 0.331 | 18 |
| hybrid-wsum70:potion-base-8M | overall | 68.9% | 0.520 | 90 |
| hybrid-wsum70:potion-base-8M | semantic | 63.0% | 0.489 | 54 |
| hybrid-wsum70:potion-base-8M | lexical | 100.0% | 0.889 | 18 |
| hybrid-wsum70:potion-base-8M | topical | 55.6% | 0.243 | 18 |
| hybrid-wsum85:potion-base-8M | overall | 67.8% | 0.515 | 90 |
| hybrid-wsum85:potion-base-8M | semantic | 64.8% | 0.502 | 54 |
| hybrid-wsum85:potion-base-8M | lexical | 88.9% | 0.767 | 18 |
| hybrid-wsum85:potion-base-8M | topical | 55.6% | 0.300 | 18 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | overall | 72.2% | 0.586 | 90 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | semantic | 70.4% | 0.546 | 54 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | topical | 50.0% | 0.319 | 18 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | overall | 72.2% | 0.565 | 90 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | semantic | 70.4% | 0.534 | 54 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | topical | 50.0% | 0.279 | 18 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | overall | 68.9% | 0.531 | 90 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | semantic | 68.5% | 0.493 | 54 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | lexical | 94.4% | 0.907 | 18 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | topical | 44.4% | 0.271 | 18 |
| hybrid-route-softmax-t0.02:potion-base-8M | overall | 71.1% | 0.553 | 90 |
| hybrid-route-softmax-t0.02:potion-base-8M | semantic | 68.5% | 0.503 | 54 |
| hybrid-route-softmax-t0.02:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-softmax-t0.02:potion-base-8M | topical | 50.0% | 0.281 | 18 |
| hybrid-route-softmax-t0.05:potion-base-8M | overall | 71.1% | 0.554 | 90 |
| hybrid-route-softmax-t0.05:potion-base-8M | semantic | 68.5% | 0.518 | 54 |
| hybrid-route-softmax-t0.05:potion-base-8M | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-softmax-t0.05:potion-base-8M | topical | 50.0% | 0.273 | 18 |
| hybrid-route-softmax-t0.1:potion-base-8M | overall | 71.1% | 0.549 | 90 |
| hybrid-route-softmax-t0.1:potion-base-8M | semantic | 70.4% | 0.511 | 54 |
| hybrid-route-softmax-t0.1:potion-base-8M | lexical | 94.4% | 0.917 | 18 |
| hybrid-route-softmax-t0.1:potion-base-8M | topical | 50.0% | 0.298 | 18 |
| hybrid-route-softmax-t0.2:potion-base-8M | overall | 71.1% | 0.509 | 90 |
| hybrid-route-softmax-t0.2:potion-base-8M | semantic | 66.7% | 0.436 | 54 |
| hybrid-route-softmax-t0.2:potion-base-8M | lexical | 94.4% | 0.907 | 18 |
| hybrid-route-softmax-t0.2:potion-base-8M | topical | 61.1% | 0.328 | 18 |
| hybrid-route-maxsim-sum:potion-base-8M | overall | 72.2% | 0.633 | 90 |
| hybrid-route-maxsim-sum:potion-base-8M | semantic | 75.9% | 0.692 | 54 |
| hybrid-route-maxsim-sum:potion-base-8M | lexical | 100.0% | 0.935 | 18 |
| hybrid-route-maxsim-sum:potion-base-8M | topical | 33.3% | 0.157 | 18 |
| hybrid-route-maxsim-mean:potion-base-8M | overall | 72.2% | 0.633 | 90 |
| hybrid-route-maxsim-mean:potion-base-8M | semantic | 75.9% | 0.692 | 54 |
| hybrid-route-maxsim-mean:potion-base-8M | lexical | 100.0% | 0.935 | 18 |
| hybrid-route-maxsim-mean:potion-base-8M | topical | 33.3% | 0.157 | 18 |
| hybrid-route-maxsim-idf:potion-base-8M | overall | 73.3% | 0.634 | 90 |
| hybrid-route-maxsim-idf:potion-base-8M | semantic | 75.9% | 0.698 | 54 |
| hybrid-route-maxsim-idf:potion-base-8M | lexical | 100.0% | 0.935 | 18 |
| hybrid-route-maxsim-idf:potion-base-8M | topical | 38.9% | 0.140 | 18 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | overall | 77.8% | 0.647 | 90 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | semantic | 75.9% | 0.654 | 54 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | topical | 61.1% | 0.301 | 18 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | overall | 80.0% | 0.657 | 90 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | semantic | 79.6% | 0.694 | 54 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | topical | 61.1% | 0.231 | 18 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | overall | 81.1% | 0.661 | 90 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | semantic | 79.6% | 0.694 | 54 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | topical | 66.7% | 0.254 | 18 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | overall | 77.8% | 0.669 | 90 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | semantic | 79.6% | 0.718 | 54 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | topical | 50.0% | 0.216 | 18 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | overall | 81.1% | 0.661 | 90 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | semantic | 79.6% | 0.694 | 54 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | topical | 66.7% | 0.254 | 18 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | overall | 81.1% | 0.661 | 90 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | semantic | 79.6% | 0.694 | 54 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | topical | 66.7% | 0.254 | 18 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | overall | 81.1% | 0.661 | 90 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | semantic | 79.6% | 0.694 | 54 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | topical | 66.7% | 0.254 | 18 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | overall | 81.1% | 0.661 | 90 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | semantic | 79.6% | 0.694 | 54 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | topical | 66.7% | 0.254 | 18 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | overall | 80.0% | 0.662 | 90 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | semantic | 79.6% | 0.697 | 54 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | topical | 61.1% | 0.250 | 18 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | overall | 80.0% | 0.662 | 90 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | semantic | 79.6% | 0.697 | 54 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | topical | 61.1% | 0.250 | 18 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | overall | 80.0% | 0.664 | 90 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | semantic | 79.6% | 0.697 | 54 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | topical | 61.1% | 0.258 | 18 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | overall | 77.8% | 0.660 | 90 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | semantic | 77.8% | 0.695 | 54 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | topical | 55.6% | 0.243 | 18 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | overall | 77.8% | 0.660 | 90 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | semantic | 77.8% | 0.695 | 54 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | topical | 55.6% | 0.243 | 18 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | overall | 74.4% | 0.495 | 90 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | semantic | 70.4% | 0.374 | 54 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | topical | 61.1% | 0.378 | 18 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | overall | 74.4% | 0.496 | 90 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | semantic | 70.4% | 0.391 | 54 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | topical | 61.1% | 0.361 | 18 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | overall | 74.4% | 0.466 | 90 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | semantic | 72.2% | 0.339 | 54 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | topical | 55.6% | 0.372 | 18 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | overall | 73.3% | 0.485 | 90 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | semantic | 68.5% | 0.367 | 54 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | topical | 61.1% | 0.377 | 18 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | overall | 74.4% | 0.495 | 90 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | semantic | 70.4% | 0.374 | 54 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | topical | 61.1% | 0.378 | 18 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | overall | 74.4% | 0.496 | 90 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | semantic | 70.4% | 0.391 | 54 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | topical | 61.1% | 0.361 | 18 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | overall | 74.4% | 0.466 | 90 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | semantic | 72.2% | 0.339 | 54 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | topical | 55.6% | 0.372 | 18 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | overall | 73.3% | 0.485 | 90 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | semantic | 68.5% | 0.367 | 54 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | topical | 61.1% | 0.377 | 18 |
| semantic:potion-retrieval-32M | overall | 78.9% | 0.620 | 90 |
| semantic:potion-retrieval-32M | semantic | 77.8% | 0.608 | 54 |
| semantic:potion-retrieval-32M | lexical | 100.0% | 0.872 | 18 |
| semantic:potion-retrieval-32M | topical | 61.1% | 0.403 | 18 |
| hybrid-rrf:potion-retrieval-32M | overall | 53.3% | 0.394 | 90 |
| hybrid-rrf:potion-retrieval-32M | semantic | 44.4% | 0.298 | 54 |
| hybrid-rrf:potion-retrieval-32M | lexical | 100.0% | 0.944 | 18 |
| hybrid-rrf:potion-retrieval-32M | topical | 33.3% | 0.135 | 18 |

## Retrieval quality by split (SHA-312)

Dev is the tuning split; holdout is the reporting split for gate v2.

| Condition | Split | Subset | hit@5 | MRR@10 | n |
| --- | --- | --- | ---: | ---: | ---: |
| lexical | dev | overall | 37.8% | 0.276 | 90 |
| lexical | dev | semantic | 24.1% | 0.111 | 54 |
| lexical | dev | lexical | 100.0% | 0.972 | 18 |
| lexical | dev | topical | 16.7% | 0.075 | 18 |
| lexical | holdout | overall | 0.0% | 0.000 | 0 |
| lexical | holdout | semantic | 0.0% | 0.000 | 0 |
| lexical | holdout | lexical | 0.0% | 0.000 | 0 |
| lexical | holdout | topical | 0.0% | 0.000 | 0 |
| semantic:potion-base-8M | dev | overall | 67.8% | 0.505 | 90 |
| semantic:potion-base-8M | dev | semantic | 68.5% | 0.497 | 54 |
| semantic:potion-base-8M | dev | lexical | 83.3% | 0.704 | 18 |
| semantic:potion-base-8M | dev | topical | 50.0% | 0.330 | 18 |
| semantic:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| semantic:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| semantic:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| semantic:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-rrf:potion-base-8M | dev | overall | 48.9% | 0.379 | 90 |
| hybrid-rrf:potion-base-8M | dev | semantic | 40.7% | 0.267 | 54 |
| hybrid-rrf:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-rrf:potion-base-8M | dev | topical | 22.2% | 0.122 | 18 |
| hybrid-rrf:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-rrf:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-rrf:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-rrf:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| semantic-top2:potion-base-8M | dev | overall | 67.8% | 0.490 | 90 |
| semantic-top2:potion-base-8M | dev | semantic | 63.0% | 0.433 | 54 |
| semantic-top2:potion-base-8M | dev | lexical | 94.4% | 0.819 | 18 |
| semantic-top2:potion-base-8M | dev | topical | 55.6% | 0.331 | 18 |
| semantic-top2:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| semantic-top2:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| semantic-top2:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| semantic-top2:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route:potion-base-8M | dev | overall | 71.1% | 0.559 | 90 |
| hybrid-route:potion-base-8M | dev | semantic | 68.5% | 0.497 | 54 |
| hybrid-route:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route:potion-base-8M | dev | topical | 50.0% | 0.330 | 18 |
| hybrid-route:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-top2:potion-base-8M | dev | overall | 68.9% | 0.520 | 90 |
| hybrid-route-top2:potion-base-8M | dev | semantic | 63.0% | 0.433 | 54 |
| hybrid-route-top2:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-top2:potion-base-8M | dev | topical | 55.6% | 0.331 | 18 |
| hybrid-route-top2:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-top2:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-top2:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-top2:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-wsum70:potion-base-8M | dev | overall | 68.9% | 0.520 | 90 |
| hybrid-wsum70:potion-base-8M | dev | semantic | 63.0% | 0.489 | 54 |
| hybrid-wsum70:potion-base-8M | dev | lexical | 100.0% | 0.889 | 18 |
| hybrid-wsum70:potion-base-8M | dev | topical | 55.6% | 0.243 | 18 |
| hybrid-wsum70:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-wsum70:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-wsum70:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-wsum70:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-wsum85:potion-base-8M | dev | overall | 67.8% | 0.515 | 90 |
| hybrid-wsum85:potion-base-8M | dev | semantic | 64.8% | 0.502 | 54 |
| hybrid-wsum85:potion-base-8M | dev | lexical | 88.9% | 0.767 | 18 |
| hybrid-wsum85:potion-base-8M | dev | topical | 55.6% | 0.300 | 18 |
| hybrid-wsum85:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-wsum85:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-wsum85:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-wsum85:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | dev | overall | 72.2% | 0.586 | 90 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | dev | semantic | 70.4% | 0.546 | 54 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | dev | topical | 50.0% | 0.319 | 18 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | dev | overall | 72.2% | 0.565 | 90 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | dev | semantic | 70.4% | 0.534 | 54 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | dev | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | dev | topical | 50.0% | 0.279 | 18 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | dev | overall | 68.9% | 0.531 | 90 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | dev | semantic | 68.5% | 0.493 | 54 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | dev | lexical | 94.4% | 0.907 | 18 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | dev | topical | 44.4% | 0.271 | 18 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.02:potion-base-8M | dev | overall | 71.1% | 0.553 | 90 |
| hybrid-route-softmax-t0.02:potion-base-8M | dev | semantic | 68.5% | 0.503 | 54 |
| hybrid-route-softmax-t0.02:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-softmax-t0.02:potion-base-8M | dev | topical | 50.0% | 0.281 | 18 |
| hybrid-route-softmax-t0.02:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.02:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.02:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.02:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.05:potion-base-8M | dev | overall | 71.1% | 0.554 | 90 |
| hybrid-route-softmax-t0.05:potion-base-8M | dev | semantic | 68.5% | 0.518 | 54 |
| hybrid-route-softmax-t0.05:potion-base-8M | dev | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-softmax-t0.05:potion-base-8M | dev | topical | 50.0% | 0.273 | 18 |
| hybrid-route-softmax-t0.05:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.05:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.05:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.05:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.1:potion-base-8M | dev | overall | 71.1% | 0.549 | 90 |
| hybrid-route-softmax-t0.1:potion-base-8M | dev | semantic | 70.4% | 0.511 | 54 |
| hybrid-route-softmax-t0.1:potion-base-8M | dev | lexical | 94.4% | 0.917 | 18 |
| hybrid-route-softmax-t0.1:potion-base-8M | dev | topical | 50.0% | 0.298 | 18 |
| hybrid-route-softmax-t0.1:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.1:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.1:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.1:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.2:potion-base-8M | dev | overall | 71.1% | 0.509 | 90 |
| hybrid-route-softmax-t0.2:potion-base-8M | dev | semantic | 66.7% | 0.436 | 54 |
| hybrid-route-softmax-t0.2:potion-base-8M | dev | lexical | 94.4% | 0.907 | 18 |
| hybrid-route-softmax-t0.2:potion-base-8M | dev | topical | 61.1% | 0.328 | 18 |
| hybrid-route-softmax-t0.2:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.2:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.2:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.2:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-sum:potion-base-8M | dev | overall | 72.2% | 0.633 | 90 |
| hybrid-route-maxsim-sum:potion-base-8M | dev | semantic | 75.9% | 0.692 | 54 |
| hybrid-route-maxsim-sum:potion-base-8M | dev | lexical | 100.0% | 0.935 | 18 |
| hybrid-route-maxsim-sum:potion-base-8M | dev | topical | 33.3% | 0.157 | 18 |
| hybrid-route-maxsim-sum:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-sum:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-sum:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-sum:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean:potion-base-8M | dev | overall | 72.2% | 0.633 | 90 |
| hybrid-route-maxsim-mean:potion-base-8M | dev | semantic | 75.9% | 0.692 | 54 |
| hybrid-route-maxsim-mean:potion-base-8M | dev | lexical | 100.0% | 0.935 | 18 |
| hybrid-route-maxsim-mean:potion-base-8M | dev | topical | 33.3% | 0.157 | 18 |
| hybrid-route-maxsim-mean:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf:potion-base-8M | dev | overall | 73.3% | 0.634 | 90 |
| hybrid-route-maxsim-idf:potion-base-8M | dev | semantic | 75.9% | 0.698 | 54 |
| hybrid-route-maxsim-idf:potion-base-8M | dev | lexical | 100.0% | 0.935 | 18 |
| hybrid-route-maxsim-idf:potion-base-8M | dev | topical | 38.9% | 0.140 | 18 |
| hybrid-route-maxsim-idf:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | dev | overall | 77.8% | 0.647 | 90 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | dev | semantic | 75.9% | 0.654 | 54 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | dev | topical | 61.1% | 0.301 | 18 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | dev | overall | 80.0% | 0.657 | 90 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | dev | semantic | 79.6% | 0.694 | 54 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | dev | topical | 61.1% | 0.231 | 18 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | dev | overall | 81.1% | 0.661 | 90 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | dev | semantic | 79.6% | 0.694 | 54 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | dev | topical | 66.7% | 0.254 | 18 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | dev | overall | 77.8% | 0.669 | 90 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | dev | semantic | 79.6% | 0.718 | 54 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | dev | topical | 50.0% | 0.216 | 18 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | dev | overall | 81.1% | 0.661 | 90 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | dev | semantic | 79.6% | 0.694 | 54 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | dev | topical | 66.7% | 0.254 | 18 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | dev | overall | 81.1% | 0.661 | 90 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | dev | semantic | 79.6% | 0.694 | 54 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | dev | topical | 66.7% | 0.254 | 18 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | dev | overall | 81.1% | 0.661 | 90 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | dev | semantic | 79.6% | 0.694 | 54 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | dev | topical | 66.7% | 0.254 | 18 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | dev | overall | 81.1% | 0.661 | 90 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | dev | semantic | 79.6% | 0.694 | 54 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | dev | topical | 66.7% | 0.254 | 18 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | dev | overall | 80.0% | 0.662 | 90 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | dev | semantic | 79.6% | 0.697 | 54 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | dev | topical | 61.1% | 0.250 | 18 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | dev | overall | 80.0% | 0.662 | 90 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | dev | semantic | 79.6% | 0.697 | 54 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | dev | topical | 61.1% | 0.250 | 18 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | dev | overall | 80.0% | 0.664 | 90 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | dev | semantic | 79.6% | 0.697 | 54 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | dev | topical | 61.1% | 0.258 | 18 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | dev | overall | 77.8% | 0.660 | 90 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | dev | semantic | 77.8% | 0.695 | 54 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | dev | topical | 55.6% | 0.243 | 18 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | dev | overall | 77.8% | 0.660 | 90 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | dev | semantic | 77.8% | 0.695 | 54 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | dev | topical | 55.6% | 0.243 | 18 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | dev | overall | 74.4% | 0.495 | 90 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | dev | semantic | 70.4% | 0.374 | 54 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | dev | topical | 61.1% | 0.378 | 18 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | dev | overall | 74.4% | 0.496 | 90 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | dev | semantic | 70.4% | 0.391 | 54 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | dev | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | dev | topical | 61.1% | 0.361 | 18 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | dev | overall | 74.4% | 0.466 | 90 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | dev | semantic | 72.2% | 0.339 | 54 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | dev | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | dev | topical | 55.6% | 0.372 | 18 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | dev | overall | 73.3% | 0.485 | 90 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | dev | semantic | 68.5% | 0.367 | 54 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | dev | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | dev | topical | 61.1% | 0.377 | 18 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | dev | overall | 74.4% | 0.495 | 90 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | dev | semantic | 70.4% | 0.374 | 54 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | dev | topical | 61.1% | 0.378 | 18 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | dev | overall | 74.4% | 0.496 | 90 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | dev | semantic | 70.4% | 0.391 | 54 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | dev | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | dev | topical | 61.1% | 0.361 | 18 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | dev | overall | 74.4% | 0.466 | 90 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | dev | semantic | 72.2% | 0.339 | 54 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | dev | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | dev | topical | 55.6% | 0.372 | 18 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | dev | overall | 73.3% | 0.485 | 90 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | dev | semantic | 68.5% | 0.367 | 54 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | dev | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | dev | topical | 61.1% | 0.377 | 18 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| semantic:potion-retrieval-32M | dev | overall | 78.9% | 0.620 | 90 |
| semantic:potion-retrieval-32M | dev | semantic | 77.8% | 0.608 | 54 |
| semantic:potion-retrieval-32M | dev | lexical | 100.0% | 0.872 | 18 |
| semantic:potion-retrieval-32M | dev | topical | 61.1% | 0.403 | 18 |
| semantic:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| semantic:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| semantic:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| semantic:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-rrf:potion-retrieval-32M | dev | overall | 53.3% | 0.394 | 90 |
| hybrid-rrf:potion-retrieval-32M | dev | semantic | 44.4% | 0.298 | 54 |
| hybrid-rrf:potion-retrieval-32M | dev | lexical | 100.0% | 0.944 | 18 |
| hybrid-rrf:potion-retrieval-32M | dev | topical | 33.3% | 0.135 | 18 |
| hybrid-rrf:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-rrf:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-rrf:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-rrf:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |

## Query latency (warm) & payload

| Condition | p50 | p90 | p95 | p99 | payload/query |
| --- | ---: | ---: | ---: | ---: | ---: |
| lexical | 42.42 ms | 188.49 ms | 209.68 ms | 318.67 ms | in-process |
| semantic:potion-base-8M | 12.10 ms | 13.07 ms | 13.45 ms | 14.01 ms | in-process |
| hybrid-rrf:potion-base-8M | 53.65 ms | 200.07 ms | 217.95 ms | 333.12 ms | in-process |
| semantic-top2:potion-base-8M | 12.82 ms | 13.48 ms | 14.05 ms | 14.60 ms | in-process |
| hybrid-route:potion-base-8M | 11.96 ms | 12.42 ms | 12.90 ms | 13.48 ms | in-process |
| hybrid-route-top2:potion-base-8M | 12.22 ms | 12.64 ms | 13.09 ms | 13.50 ms | in-process |
| hybrid-wsum70:potion-base-8M | 12.44 ms | 13.12 ms | 13.39 ms | 14.73 ms | in-process |
| hybrid-wsum85:potion-base-8M | 12.65 ms | 13.12 ms | 13.44 ms | 13.77 ms | in-process |
| hybrid-route-logdiscount-l0.01:potion-base-8M | 12.08 ms | 13.00 ms | 13.10 ms | 13.96 ms | in-process |
| hybrid-route-logdiscount-l0.02:potion-base-8M | 12.23 ms | 13.39 ms | 13.77 ms | 14.65 ms | in-process |
| hybrid-route-logdiscount-l0.04:potion-base-8M | 12.49 ms | 12.99 ms | 13.39 ms | 13.85 ms | in-process |
| hybrid-route-softmax-t0.02:potion-base-8M | 13.21 ms | 13.74 ms | 14.09 ms | 14.43 ms | in-process |
| hybrid-route-softmax-t0.05:potion-base-8M | 12.90 ms | 13.82 ms | 14.16 ms | 15.07 ms | in-process |
| hybrid-route-softmax-t0.1:potion-base-8M | 12.60 ms | 13.38 ms | 13.52 ms | 14.10 ms | in-process |
| hybrid-route-softmax-t0.2:potion-base-8M | 12.75 ms | 13.39 ms | 13.65 ms | 14.24 ms | in-process |
| hybrid-route-maxsim-sum:potion-base-8M | 19.82 ms | 23.65 ms | 24.78 ms | 26.93 ms | in-process |
| hybrid-route-maxsim-mean:potion-base-8M | 20.48 ms | 24.21 ms | 25.27 ms | 27.71 ms | in-process |
| hybrid-route-maxsim-idf:potion-base-8M | 20.86 ms | 24.74 ms | 25.65 ms | 27.94 ms | in-process |
| hybrid-route-maxsim-mean-b50:potion-base-8M | 20.74 ms | 24.58 ms | 25.55 ms | 28.35 ms | in-process |
| hybrid-route-maxsim-mean-b70:potion-base-8M | 20.89 ms | 24.72 ms | 26.06 ms | 28.94 ms | in-process |
| hybrid-route-maxsim-idf-b50:potion-base-8M | 21.09 ms | 24.97 ms | 26.29 ms | 28.52 ms | in-process |
| hybrid-route-maxsim-idf-b70:potion-base-8M | 20.76 ms | 24.50 ms | 25.91 ms | 27.64 ms | in-process |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | 21.72 ms | 25.69 ms | 27.18 ms | 29.50 ms | in-process |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | 21.52 ms | 24.86 ms | 26.18 ms | 28.66 ms | in-process |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | 21.38 ms | 25.14 ms | 26.49 ms | 29.08 ms | in-process |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | 20.85 ms | 24.58 ms | 26.14 ms | 28.55 ms | in-process |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | 21.80 ms | 25.99 ms | 27.01 ms | 29.36 ms | in-process |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | 20.81 ms | 24.56 ms | 25.77 ms | 27.64 ms | in-process |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | 21.37 ms | 25.09 ms | 26.07 ms | 28.53 ms | in-process |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | 21.70 ms | 25.71 ms | 27.08 ms | 29.34 ms | in-process |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | 21.54 ms | 25.53 ms | 26.88 ms | 29.23 ms | in-process |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | 21.05 ms | 24.78 ms | 26.40 ms | 29.04 ms | in-process |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | 20.90 ms | 25.05 ms | 26.62 ms | 28.16 ms | in-process |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | 21.49 ms | 25.52 ms | 26.67 ms | 29.14 ms | in-process |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | 21.50 ms | 25.21 ms | 26.22 ms | 28.18 ms | in-process |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | 21.11 ms | 25.77 ms | 26.89 ms | 28.62 ms | in-process |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | 21.20 ms | 24.94 ms | 26.16 ms | 28.27 ms | in-process |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | 21.77 ms | 25.67 ms | 26.85 ms | 29.29 ms | in-process |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | 21.70 ms | 25.98 ms | 27.23 ms | 29.47 ms | in-process |
| semantic:potion-retrieval-32M | 22.30 ms | 22.88 ms | 23.06 ms | 23.81 ms | in-process |
| hybrid-rrf:potion-retrieval-32M | 63.70 ms | 210.35 ms | 236.19 ms | 342.44 ms | in-process |

## Hybrid misses at 5 (error-analysis material)

- **sem-anemometer** (semantic): "instrument that measures the speed and pressure of wind" → expected Notes/Anemometer.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Hydraulics.md, Encyclopedia/H/Horn.md, 0 Inbox/Mecca.md, Encyclopedia/L/Ligao.md, Reference/Cloaca.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Hydraulics.md, Notes/Japan.md, Encyclopedia/H/Horn.md, Encyclopedia/L/Ligao.md, Reference/Cloaca.md
- **sem-anglesite** (semantic): "mineral composed of lead sulphate" → expected Encyclopedia/A/Anglesite.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Copper.md, Encyclopedia/I/Irnerius.md, Encyclopedia/C/Chemistry.md, Encyclopedia/C/Calcite.md, Encyclopedia/M/Magnesite.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Copper.md, Encyclopedia/I/Irnerius.md, Encyclopedia/C/Chemistry.md, Encyclopedia/C/Calcite.md, Encyclopedia/B/Barytes.md
- **sem-jaguar** (semantic): "largest wild cat found on the American continent" → expected Encyclopedia/J/Jaguar.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Canachus.md, Reference/India.md, Encyclopedia/G/Geography.md, Reference/Australia.md, Encyclopedia/I/Indo-China.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/India.md, Encyclopedia/F/Fur.md, Reference/Australia.md, Notes/Argentina.md, 0 Inbox/Mammalia.md
- **sem-dahlia** (semantic): "Mexican garden flower named after a pupil of Linnaeus" → expected Sources/Dahlia.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Notes/Japan.md, 0 Inbox/Flower.md, Sources/Europe.md, Sources/Cotton.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Notes/Japan.md, Sources/Cotton.md, 0 Inbox/Flower.md, Encyclopedia/I/Italy.md
- **sem-geyser** (semantic): "natural hot spring that periodically erupts a column of boiling water and steam" → expected Sources/Geyser.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Sources/Cotton.md, Encyclopedia/E/Electric Eel.md, Encyclopedia/B/Bacsanyi.md, Encyclopedia/D/Daille.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Notes/Japan.md, Reference/Hydraulics.md, Reference/Australia.md, Encyclopedia/E/Electric Eel.md
- **sem-giraffe** (semantic): "the tallest living mammal, an African ruminant with a long neck" → expected Encyclopedia/G/Giraffe.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Reference/India.md, 0 Inbox/Mammalia.md, Encyclopedia/M/Madagascar.md, Notes/Horse.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Australia.md, 0 Inbox/Mammalia.md, Encyclopedia/A/Asia.md, Reference/India.md, Sources/Evidence.md
- **sem-guillotine** (semantic): "beheading machine of the French Revolution" → expected Sources/Guillotine.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/F/French Revolution.md, Notes/French Revolutionary Wars.md, Sources/Europe.md, Encyclopedia/I/Italy.md, Notes/History.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/F/French Revolution.md, Notes/French Revolutionary Wars.md, Sources/Europe.md, Notes/History.md, Encyclopedia/I/Italy.md
- **sem-hurricane** (semantic): "violent tropical wind storm of the West Indies" → expected Reference/Hurricane.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/Australia.md, Reference/India.md, Notes/Argentina.md, Sources/Europe.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Reference/India.md, Sources/Europe.md, Reference/Hydraulics.md, Notes/Argentina.md
- **sem-lemur** (semantic): "primates of Madagascar that are neither monkeys nor apes" → expected Encyclopedia/L/Lemur.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/M/Madagascar.md, 0 Inbox/Mammalia.md, Reference/Australia.md, Notes/Japan.md, Encyclopedia/A/Asia.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/M/Madagascar.md, 0 Inbox/Mammalia.md, Reference/Australia.md, Encyclopedia/A/Asia.md, Encyclopedia/A/Ape.md
- **sem-kite-bird** (semantic): "bird of prey once the most familiar in Great Britain, now among its rarest" → expected Encyclopedia/K/Kite.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Reference/India.md, Notes/Canachus.md, Sources/Archaeology.md, Encyclopedia/F/Flycatcher.md
- **sem-comet** (semantic): "nebulous celestial body travelling a highly eccentric orbit around the sun" → expected Reference/Comet.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Astronomy.md, Notes/Japan.md, 0 Inbox/Mecca.md, Sources/Hindostani.md, Encyclopedia/C/Celt.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Astronomy.md, Sources/Hindostani.md, Notes/Japan.md, 0 Inbox/Mecca.md, Encyclopedia/L/Ligao.md
- **sem-fog** (semantic): "suspended particles near the ground that make surrounding objects invisible" → expected Reference/Fog.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Encyclopedia/E/Electric Eel.md, Encyclopedia/M/Magnesite.md, 0 Inbox/Cap Haitien.md, Reference/Hydraulics.md
  - hybrid-rrf:potion-retrieval-32M top 5: 0 Inbox/Mecca.md, Encyclopedia/L/Ligao.md, Reference/Astronomy.md, Encyclopedia/M/Magnesite.md, Encyclopedia/E/Electric Eel.md
- **sem-llama** (semantic): "domesticated South American pack animal of the camel family" → expected Notes/Llama.md
  - hybrid-rrf:potion-base-8M top 5: Reference/India.md, Encyclopedia/A/Asia.md, Notes/Horse.md, Encyclopedia/I/Italy.md, Reference/Australia.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Australia.md, Reference/India.md, Sources/Family.md, Encyclopedia/I/Indo-China.md, Encyclopedia/C/Civilis.md
- **sem-fox-statesman** (semantic): "eighteenth century British statesman and orator, son of Lord Holland" → expected Encyclopedia/F/Fox.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/L/Leeds.md, Reference/George.md, Encyclopedia/M/Marchmont.md, Notes/Japan.md, Encyclopedia/E/English Law.md
- **sem-darwin** (semantic): "Victorian naturalist who developed the theory of evolution by natural selection" → expected Sources/Darwin.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Evidence.md, Reference/Ethics.md, Sources/Aristotle.md, Reference/Australia.md, Encyclopedia/E/Embrun.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Evidence.md, Reference/Ethics.md, Encyclopedia/E/Embrun.md, Encyclopedia/F/Fine Arts.md, Sources/Aristotle.md
- **sem-faraday** (semantic): "English scientist famous for discoveries in electromagnetism and electrochemistry" → expected Reference/Faraday.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/E/Electric Eel.md, Encyclopedia/C/Chemistry.md, Encyclopedia/M/Magnesite.md, Encyclopedia/L/Ligao.md, Notes/Japan.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/E/Electric Eel.md, Encyclopedia/C/Chemistry.md, Encyclopedia/M/Magnesite.md, Notes/Japan.md, Encyclopedia/I/Italy.md
- **sem-machiavelli** (semantic): "Florentine political theorist whose name became a byword for cunning statecraft" → expected Encyclopedia/M/Machiavelli.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/I/Italy.md, Encyclopedia/E/English Law.md, Encyclopedia/F/Florence.md, Sources/Germanium.md, Encyclopedia/D/Drama.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/I/Italy.md, Encyclopedia/E/English Law.md, Sources/Europe.md, Encyclopedia/F/Florence.md, Sources/Aristotle.md
- **top-birds-of-prey** (topical): "birds of prey" → expected Reference/Eagle.md, Encyclopedia/H/Hawk.md, Encyclopedia/K/Kite.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/I/Italy.md, Notes/Humming-Bird.md, Reference/India.md, Reference/Australia.md, Encyclopedia/K/Kestrel.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/India.md, Notes/Humming-Bird.md, Encyclopedia/F/Frigate-Bird.md, Reference/Australia.md, Encyclopedia/F/Feather.md
- **top-big-cats** (topical): "large wild cats" → expected Encyclopedia/J/Jaguar.md, Encyclopedia/L/Leopard.md, Reference/Lynx.md
  - hybrid-rrf:potion-base-8M top 5: Reference/India.md, Encyclopedia/H/Himalaya.md, Encyclopedia/F/Fur.md, Reference/Australia.md, Notes/Canachus.md
- **top-green-gemstones** (topical): "green gemstones" → expected Encyclopedia/E/Emerald.md, Notes/Jade.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Greenockite.md, Reference/Greensand.md, Reference/Apatite.md, Encyclopedia/E/Epidote.md, Notes/Marble.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Green Bay.md, Notes/Green Ribbon Club.md, Encyclopedia/B/Bowling Green.md, Notes/Greenockite.md, Reference/Greensand.md
- **top-weather** (topical): "violent weather phenomena" → expected Reference/Hurricane.md, Encyclopedia/H/Hail.md, Reference/Fog.md
  - hybrid-rrf:potion-base-8M top 5: Reference/India.md, Encyclopedia/C/Chile.md, Notes/Japan.md, Reference/Australia.md, Sources/Influenza.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Encyclopedia/C/Chile.md, Reference/India.md, Encyclopedia/B/Breaking Bulk.md, Reference/Australia.md
- **top-instruments** (topical): "musical instruments" → expected Reference/Flute.md, Sources/Drum.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Instrument.md, Encyclopedia/G/Guitar.md, Encyclopedia/C/Clarinet.md, Encyclopedia/K/Kettle.md, Encyclopedia/H/Harmonica.md
  - hybrid-rrf:potion-retrieval-32M top 5: 0 Inbox/Instrument.md, Encyclopedia/G/Guitar.md, Encyclopedia/H/Horn.md, Reference/Keyboard.md, Reference/Bombardon.md
- **top-composers** (topical): "great German composers" → expected Sources/Beethoven.md, Encyclopedia/H/Handel.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Germanium.md, Sources/Hymettus.md, Notes/History.md, Reference/Encyclical.md, 0 Inbox/Instrument.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Germanium.md, Notes/History.md, Sources/Hymettus.md, Reference/Bastian.md, Sources/Franco-German War.md
- **top-dairy** (topical): "foods made from milk" → expected Encyclopedia/C/Cheese.md, Encyclopedia/B/Butter.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/D/Daille.md, Reference/Cattle.md, Notes/Dietetics.md, Notes/Canachus.md, Reference/India.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/D/Daille.md, Reference/Cattle.md, Notes/Canachus.md, Notes/Dietetics.md, Reference/India.md
- **sem-astrolabe** (semantic): "ancient instrument for taking the altitude of stars, sun and moon" → expected Encyclopedia/A/Astrolabe.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Astronomy.md, Sources/Hindostani.md, Notes/Japan.md, Reference/India.md, Encyclopedia/I/Italy.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Astronomy.md, Sources/Hindostani.md, Notes/Japan.md, Sources/Aristotle.md, Encyclopedia/L/Ligao.md
- **sem-brick** (semantic): "artificial stone of burnt clay used as a building material" → expected Encyclopedia/B/Brick.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Encyclopedia/F/Fine Arts.md, Encyclopedia/B/Babylon.md, Encyclopedia/I/Ireland.md, Encyclopedia/M/Magnesite.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Encyclopedia/B/Babylon.md, Encyclopedia/I/Ireland.md, Encyclopedia/F/Fine Arts.md, 0 Inbox/Mecca.md
- **sem-mars** (semantic): "the reddish fourth planet in order of distance from the sun" → expected Reference/Mars.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Astronomy.md, Sources/Europe.md, Notes/Japan.md, Encyclopedia/L/Ligao.md, Sources/Map.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Astronomy.md, Sources/Aristotle.md, Sources/Hindostani.md, Encyclopedia/L/Ligao.md, Sources/Evidence.md
- **sem-carnival** (semantic): "days of feasting and merrymaking before Lent" → expected Notes/Carnival.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Lent.md, Encyclopedia/F/Fasting.md, Encyclopedia/E/Eucharist.md, Encyclopedia/M/Madagascar.md, Encyclopedia/A/Armenia.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Lent.md, Encyclopedia/F/Fasting.md, Encyclopedia/E/Eucharist.md, 0 Inbox/Mecca.md, Encyclopedia/M/Madagascar.md
- **sem-clover** (semantic): "plant of the pea family named for its three leaflets" → expected Sources/Clover.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Encyclopedia/I/Italy.md, Reference/Australia.md, Sources/Europe.md, Sources/Cotton.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Sources/Cotton.md, Encyclopedia/L/Leaf.md, Encyclopedia/I/Italy.md, 0 Inbox/Flower.md
- **sem-crown-coin** (semantic): "English silver coin of the value of five shillings" → expected Reference/Crown.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Notes/History.md, Reference/India.md, Encyclopedia/E/Exchange.md, Encyclopedia/C/Coin.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Reference/India.md, Notes/History.md, Encyclopedia/C/Coin.md, Notes/Canachus.md
- **sem-equator** (semantic): "great circle equidistant from the two poles dividing the hemispheres" → expected Encyclopedia/E/Equator.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Map.md, Reference/Astronomy.md, 0 Inbox/Mecca.md, Encyclopedia/M/Magnesite.md, Encyclopedia/E/Electrokinetics.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Map.md, 0 Inbox/Mecca.md, Reference/Astronomy.md, Reference/Geodesy.md, Encyclopedia/M/Magnesite.md
- **sem-flag** (semantic): "piece of bunting waved from a staff as a standard, ensign or signal" → expected Encyclopedia/F/Flag.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Notes/Japan.md, Encyclopedia/K/Knight.md, Reference/Astronomy.md, Reference/Hydraulics.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Hydraulics.md, Encyclopedia/K/Knight.md, Reference/Astronomy.md, Sources/Cotton.md, 0 Inbox/Mecca.md
- **sem-grasshopper** (semantic): "leaping insect with powerful hind legs that stridulates" → expected Encyclopedia/G/Grasshopper.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/C/Coleoptera.md, Encyclopedia/H/Hexapoda.md, Sources/Lepidoptera.md, Encyclopedia/I/Insectivora.md, Encyclopedia/I/Insect.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/C/Coleoptera.md, Encyclopedia/H/Hexapoda.md, Encyclopedia/E/Entomology.md, Encyclopedia/I/Insect.md, Sources/Lepidoptera.md
- **sem-lantern** (semantic): "case of transparent material protecting a light from rain and wind" → expected Reference/Lantern.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Notes/Japan.md, Sources/Europe.md, Sources/Cotton.md, Encyclopedia/A/Asia.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Sources/Horticulture.md, Sources/Europe.md, Reference/India.md, Encyclopedia/E/Electric Eel.md
- **sem-marble** (semantic): "limestone close enough in texture to admit of being polished" → expected Notes/Marble.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Sources/Horticulture.md, Reference/Ethics.md, Sources/Cotton.md, Encyclopedia/E/Edric.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/I/Ireland.md, Encyclopedia/M/Magnesite.md, Encyclopedia/L/Limestone.md, Notes/Japan.md, Encyclopedia/I/Italy.md
- **sem-hare** (semantic): "well-known English rodent allied to the rabbit, with an Alpine mountain relative" → expected Notes/Hare.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Encyclopedia/I/Italy.md, Notes/Japan.md, Reference/India.md, Encyclopedia/C/Chile.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Australia.md, Notes/Japan.md, Encyclopedia/I/Italy.md, Notes/Canachus.md, 0 Inbox/Mammalia.md
- **sem-lacrosse** (semantic): "national ball game of Canada played with a curved netted stick" → expected 0 Inbox/Lacrosse.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Reference/Hydraulics.md, Encyclopedia/I/Ireland.md, Sources/Cotton.md, Notes/Canachus.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Reference/Hydraulics.md, 0 Inbox/Mecca.md, Reference/India.md, Notes/Canachus.md
- **sem-haydn** (semantic): "Austrian composer of Croatian stock born at Rohrau" → expected Notes/Haydn.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Croatia-Slavonia.md, Notes/History.md, Sources/Europe.md, Reference/Australia.md, Encyclopedia/D/Dalmatia.md
- **sem-edison** (semantic): "American inventor who began as a railway news-boy experimenting in chemistry" → expected Encyclopedia/E/Edison.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/C/Chemistry.md, Sources/Cotton.md, Encyclopedia/E/Electric Eel.md, Encyclopedia/M/Magnesite.md, Encyclopedia/D/Deadwood.md
- **sem-anvil** (semantic): "mass of iron on which material is supported while shaped under the hammer" → expected Reference/Anvil.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/Australia.md, Encyclopedia/M/Magnesite.md, 0 Inbox/Mecca.md, Sources/Europe.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Encyclopedia/M/Magnesite.md, Reference/Australia.md, Encyclopedia/I/Italy.md, Reference/Cloaca.md
- **top-orchard-fruits** (topical): "fruits grown in gardens and orchards" → expected Reference/Apple.md, Sources/Gooseberry.md, Sources/Lemon.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Notes/Canachus.md, Encyclopedia/I/Italy.md, Sources/Europe.md, Reference/India.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Notes/Canachus.md, Encyclopedia/I/Italy.md, Reference/India.md, Notes/Japan.md
- **top-english-poets** (topical): "lives of the English poets" → expected Encyclopedia/B/Byron.md, Notes/Chaucer.md, Encyclopedia/D/Dryden.md, 0 Inbox/Gray.md, Notes/Cowper.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/E/English Law.md, Encyclopedia/C/Celt.md, Notes/Japan.md, Encyclopedia/I/Iceland.md, Sources/Dutch East India Company.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/C/Celt.md, Encyclopedia/E/English Law.md, Encyclopedia/D/Drama.md, Sources/Hindostani.md, Sources/Arnold.md
- **top-british-philosophers** (topical): "British philosophers of the seventeenth and eighteenth centuries" → expected Encyclopedia/L/Locke.md, Reference/Berkeley.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/I/Ireland.md, Sources/Europe.md, Sources/Germanium.md, Reference/Astronomy.md, Sources/Aristotle.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Aristotle.md, Reference/Ethics.md, Encyclopedia/E/English Law.md, Sources/Germanium.md, Encyclopedia/E/Edric.md
- **top-great-rivers** (topical): "great rivers of the world" → expected Encyclopedia/E/Euphrates.md, Encyclopedia/G/Ganges.md, Encyclopedia/E/Elbe.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Europe.md, Reference/Australia.md, Sources/Germanium.md, Notes/Canachus.md, Encyclopedia/G/Geography.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Europe.md, Notes/Japan.md, Reference/Australia.md, Reference/India.md, Reference/Hydraulics.md
- **top-indoor-games** (topical): "indoor games of skill played on a table or board" → expected Encyclopedia/B/Billiards.md, Encyclopedia/D/Draughts.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/G/Games.md, Encyclopedia/I/Ireland.md, 0 Inbox/Mecca.md, Encyclopedia/D/Drama.md, Encyclopedia/F/Fine Arts.md
- **top-sea-fishes** (topical): "fishes of the open sea" → expected Encyclopedia/C/Cod.md, Notes/Mackerel.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/India.md, Reference/Australia.md, Encyclopedia/I/Italy.md, Sources/Caspian Sea.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Reference/India.md, Encyclopedia/I/Ireland.md, Sources/Caspian Sea.md, Reference/Australia.md
- **top-light-sources** (topical): "devices for holding and carrying a light" → expected Encyclopedia/L/Lamp.md, Reference/Lantern.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Cotton.md, 0 Inbox/Mecca.md, Reference/Hydraulics.md, Encyclopedia/E/Electric Eel.md, Sources/Dream.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Encyclopedia/L/Ligao.md, Encyclopedia/E/Electric Eel.md, Reference/Astronomy.md, Encyclopedia/F/Fine Arts.md

## Gate verdict

> **Pre-registered gate:** hybrid RRF must beat lexical-only by ≥10 points hit@5 on the semantic subset, regress ≤2 points on the exact-term subset, and warm end-to-end semantic query (embed + scan) p95 ≤ 15 ms at 10k notes. +5..+10 points = discuss zone. Model choice = smallest model passing.

### potion-base-8M — SHIP

- semantic subset hit@5 +16.7 pts (gate ≥ +10): PASS
- lexical subset hit@5 0.0 pts (gate ≥ -2): PASS
- semantic warm p95 13.45 ms (gate ≤ 15 ms): PASS

### potion-retrieval-32M — NO-SHIP

- semantic subset hit@5 +20.4 pts (gate ≥ +10): PASS
- lexical subset hit@5 0.0 pts (gate ≥ -2): PASS
- semantic warm p95 23.06 ms (gate ≤ 15 ms): FAIL

**Overall: SHIP** — chosen model: potion-base-8M
