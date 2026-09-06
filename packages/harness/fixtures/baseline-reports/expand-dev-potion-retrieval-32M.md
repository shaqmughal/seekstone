# Retrieval-quality eval (SHA-257 spike)

- **Snapshot:** 2026-09-06T00:23:56.715Z
- **Machine:** darwin/arm64, node v25.9.0, 16 cpus
- **Vault:** packages/harness/fixtures/vault (10000 notes)
- **Query set:** 90 queries (54 semantic, 18 lexical, 18 topical) [dev split only], 20 latency runs/query
- **Splits:** dev 90 (54/18/18), holdout 0 (0/0/0) — tuning reads dev only; gate v2 reports on holdout
- **Lexical index build:** 319345.00 ms
- **potion-retrieval-32M:** dim 512, 45972 chunks, index build 42322.16 ms, model load 73.11 ms
- **potion-base-8M:** dim 256, 45972 chunks, index build 230573.18 ms, model load 18.00 ms

## Retrieval quality

| Condition | Subset | hit@5 | MRR@10 | n |
| --- | --- | ---: | ---: | ---: |
| lexical | overall | 37.8% | 0.276 | 90 |
| lexical | semantic | 24.1% | 0.111 | 54 |
| lexical | lexical | 100.0% | 0.972 | 18 |
| lexical | topical | 16.7% | 0.075 | 18 |
| semantic:potion-retrieval-32M | overall | 78.9% | 0.620 | 90 |
| semantic:potion-retrieval-32M | semantic | 77.8% | 0.608 | 54 |
| semantic:potion-retrieval-32M | lexical | 100.0% | 0.872 | 18 |
| semantic:potion-retrieval-32M | topical | 61.1% | 0.403 | 18 |
| hybrid-rrf:potion-retrieval-32M | overall | 53.3% | 0.394 | 90 |
| hybrid-rrf:potion-retrieval-32M | semantic | 44.4% | 0.298 | 54 |
| hybrid-rrf:potion-retrieval-32M | lexical | 100.0% | 0.944 | 18 |
| hybrid-rrf:potion-retrieval-32M | topical | 33.3% | 0.135 | 18 |
| semantic-top2:potion-retrieval-32M | overall | 74.4% | 0.601 | 90 |
| semantic-top2:potion-retrieval-32M | semantic | 68.5% | 0.535 | 54 |
| semantic-top2:potion-retrieval-32M | lexical | 94.4% | 0.924 | 18 |
| semantic-top2:potion-retrieval-32M | topical | 72.2% | 0.476 | 18 |
| hybrid-route:potion-retrieval-32M | overall | 78.9% | 0.640 | 90 |
| hybrid-route:potion-retrieval-32M | semantic | 77.8% | 0.608 | 54 |
| hybrid-route:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route:potion-retrieval-32M | topical | 61.1% | 0.403 | 18 |
| hybrid-route-top2:potion-retrieval-32M | overall | 75.6% | 0.616 | 90 |
| hybrid-route-top2:potion-retrieval-32M | semantic | 68.5% | 0.535 | 54 |
| hybrid-route-top2:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-top2:potion-retrieval-32M | topical | 72.2% | 0.476 | 18 |
| hybrid-wsum70:potion-retrieval-32M | overall | 81.1% | 0.579 | 90 |
| hybrid-wsum70:potion-retrieval-32M | semantic | 81.5% | 0.564 | 54 |
| hybrid-wsum70:potion-retrieval-32M | lexical | 100.0% | 0.944 | 18 |
| hybrid-wsum70:potion-retrieval-32M | topical | 61.1% | 0.257 | 18 |
| hybrid-wsum85:potion-retrieval-32M | overall | 78.9% | 0.607 | 90 |
| hybrid-wsum85:potion-retrieval-32M | semantic | 77.8% | 0.601 | 54 |
| hybrid-wsum85:potion-retrieval-32M | lexical | 100.0% | 0.903 | 18 |
| hybrid-wsum85:potion-retrieval-32M | topical | 61.1% | 0.330 | 18 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | overall | 80.0% | 0.646 | 90 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | semantic | 79.6% | 0.613 | 54 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | topical | 61.1% | 0.420 | 18 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | overall | 81.1% | 0.646 | 90 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | semantic | 81.5% | 0.631 | 54 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | topical | 61.1% | 0.366 | 18 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | overall | 76.7% | 0.618 | 90 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | semantic | 75.9% | 0.584 | 54 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | topical | 55.6% | 0.363 | 18 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | overall | 78.9% | 0.643 | 90 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | semantic | 77.8% | 0.614 | 54 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | topical | 61.1% | 0.400 | 18 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | overall | 80.0% | 0.636 | 90 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | semantic | 79.6% | 0.613 | 54 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | topical | 61.1% | 0.366 | 18 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | overall | 80.0% | 0.607 | 90 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | semantic | 79.6% | 0.569 | 54 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | lexical | 100.0% | 0.931 | 18 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | topical | 61.1% | 0.396 | 18 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | overall | 77.8% | 0.612 | 90 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | semantic | 75.9% | 0.553 | 54 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | lexical | 100.0% | 0.935 | 18 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | topical | 61.1% | 0.466 | 18 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | overall | 81.1% | 0.693 | 90 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | semantic | 85.2% | 0.753 | 54 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | lexical | 100.0% | 0.921 | 18 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | topical | 50.0% | 0.287 | 18 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | overall | 81.1% | 0.693 | 90 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | semantic | 85.2% | 0.753 | 54 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | lexical | 100.0% | 0.921 | 18 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | topical | 50.0% | 0.287 | 18 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | overall | 77.8% | 0.681 | 90 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | semantic | 83.3% | 0.755 | 54 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | lexical | 100.0% | 0.921 | 18 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | topical | 38.9% | 0.219 | 18 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | overall | 86.7% | 0.738 | 90 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | semantic | 88.9% | 0.755 | 54 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | topical | 66.7% | 0.452 | 18 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | overall | 87.8% | 0.768 | 90 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | semantic | 90.7% | 0.806 | 54 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | topical | 66.7% | 0.452 | 18 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | overall | 86.7% | 0.757 | 90 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | semantic | 90.7% | 0.789 | 54 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | topical | 61.1% | 0.446 | 18 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | overall | 83.3% | 0.762 | 90 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | semantic | 85.2% | 0.809 | 54 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | topical | 61.1% | 0.407 | 18 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | overall | 86.7% | 0.757 | 90 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | semantic | 90.7% | 0.789 | 54 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | topical | 61.1% | 0.446 | 18 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | overall | 86.7% | 0.757 | 90 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | semantic | 90.7% | 0.789 | 54 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | topical | 61.1% | 0.446 | 18 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | overall | 86.7% | 0.757 | 90 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | semantic | 90.7% | 0.789 | 54 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | topical | 61.1% | 0.446 | 18 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | overall | 86.7% | 0.757 | 90 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | semantic | 90.7% | 0.789 | 54 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | topical | 61.1% | 0.446 | 18 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | overall | 87.8% | 0.757 | 90 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | semantic | 92.6% | 0.789 | 54 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | topical | 61.1% | 0.446 | 18 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | overall | 87.8% | 0.758 | 90 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | semantic | 92.6% | 0.791 | 54 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | topical | 61.1% | 0.446 | 18 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | overall | 87.8% | 0.757 | 90 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | semantic | 92.6% | 0.789 | 54 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | topical | 61.1% | 0.446 | 18 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | overall | 87.8% | 0.755 | 90 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | semantic | 92.6% | 0.788 | 54 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | topical | 61.1% | 0.437 | 18 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | overall | 87.8% | 0.756 | 90 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | semantic | 92.6% | 0.790 | 54 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | topical | 61.1% | 0.437 | 18 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | overall | 81.1% | 0.555 | 90 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | semantic | 77.8% | 0.438 | 54 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | topical | 72.2% | 0.486 | 18 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | overall | 83.3% | 0.599 | 90 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | semantic | 81.5% | 0.494 | 54 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | topical | 72.2% | 0.542 | 18 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | overall | 81.1% | 0.532 | 90 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | semantic | 77.8% | 0.411 | 54 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | lexical | 100.0% | 0.963 | 18 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | topical | 72.2% | 0.466 | 18 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | overall | 85.6% | 0.583 | 90 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | semantic | 85.2% | 0.478 | 54 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | lexical | 100.0% | 0.963 | 18 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | topical | 72.2% | 0.521 | 18 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | overall | 81.1% | 0.555 | 90 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | semantic | 77.8% | 0.438 | 54 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | topical | 72.2% | 0.486 | 18 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | overall | 83.3% | 0.599 | 90 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | semantic | 81.5% | 0.494 | 54 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | topical | 72.2% | 0.542 | 18 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | overall | 81.1% | 0.532 | 90 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | semantic | 77.8% | 0.411 | 54 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | lexical | 100.0% | 0.963 | 18 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | topical | 72.2% | 0.466 | 18 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | overall | 85.6% | 0.583 | 90 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | semantic | 85.2% | 0.478 | 54 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | lexical | 100.0% | 0.963 | 18 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | topical | 72.2% | 0.521 | 18 |
| semantic:potion-base-8M | overall | 67.8% | 0.505 | 90 |
| semantic:potion-base-8M | semantic | 68.5% | 0.497 | 54 |
| semantic:potion-base-8M | lexical | 83.3% | 0.704 | 18 |
| semantic:potion-base-8M | topical | 50.0% | 0.330 | 18 |
| hybrid-rrf:potion-base-8M | overall | 48.9% | 0.379 | 90 |
| hybrid-rrf:potion-base-8M | semantic | 40.7% | 0.267 | 54 |
| hybrid-rrf:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-rrf:potion-base-8M | topical | 22.2% | 0.122 | 18 |

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
| semantic-top2:potion-retrieval-32M | dev | overall | 74.4% | 0.601 | 90 |
| semantic-top2:potion-retrieval-32M | dev | semantic | 68.5% | 0.535 | 54 |
| semantic-top2:potion-retrieval-32M | dev | lexical | 94.4% | 0.924 | 18 |
| semantic-top2:potion-retrieval-32M | dev | topical | 72.2% | 0.476 | 18 |
| semantic-top2:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| semantic-top2:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| semantic-top2:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| semantic-top2:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route:potion-retrieval-32M | dev | overall | 78.9% | 0.640 | 90 |
| hybrid-route:potion-retrieval-32M | dev | semantic | 77.8% | 0.608 | 54 |
| hybrid-route:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route:potion-retrieval-32M | dev | topical | 61.1% | 0.403 | 18 |
| hybrid-route:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-top2:potion-retrieval-32M | dev | overall | 75.6% | 0.616 | 90 |
| hybrid-route-top2:potion-retrieval-32M | dev | semantic | 68.5% | 0.535 | 54 |
| hybrid-route-top2:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-top2:potion-retrieval-32M | dev | topical | 72.2% | 0.476 | 18 |
| hybrid-route-top2:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-top2:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-top2:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-top2:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-wsum70:potion-retrieval-32M | dev | overall | 81.1% | 0.579 | 90 |
| hybrid-wsum70:potion-retrieval-32M | dev | semantic | 81.5% | 0.564 | 54 |
| hybrid-wsum70:potion-retrieval-32M | dev | lexical | 100.0% | 0.944 | 18 |
| hybrid-wsum70:potion-retrieval-32M | dev | topical | 61.1% | 0.257 | 18 |
| hybrid-wsum70:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-wsum70:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-wsum70:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-wsum70:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-wsum85:potion-retrieval-32M | dev | overall | 78.9% | 0.607 | 90 |
| hybrid-wsum85:potion-retrieval-32M | dev | semantic | 77.8% | 0.601 | 54 |
| hybrid-wsum85:potion-retrieval-32M | dev | lexical | 100.0% | 0.903 | 18 |
| hybrid-wsum85:potion-retrieval-32M | dev | topical | 61.1% | 0.330 | 18 |
| hybrid-wsum85:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-wsum85:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-wsum85:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-wsum85:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | dev | overall | 80.0% | 0.646 | 90 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | dev | semantic | 79.6% | 0.613 | 54 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | dev | topical | 61.1% | 0.420 | 18 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | dev | overall | 81.1% | 0.646 | 90 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | dev | semantic | 81.5% | 0.631 | 54 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | dev | topical | 61.1% | 0.366 | 18 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | dev | overall | 76.7% | 0.618 | 90 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | dev | semantic | 75.9% | 0.584 | 54 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | dev | topical | 55.6% | 0.363 | 18 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | dev | overall | 78.9% | 0.643 | 90 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | dev | semantic | 77.8% | 0.614 | 54 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | dev | topical | 61.1% | 0.400 | 18 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | dev | overall | 80.0% | 0.636 | 90 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | dev | semantic | 79.6% | 0.613 | 54 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | dev | topical | 61.1% | 0.366 | 18 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | dev | overall | 80.0% | 0.607 | 90 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | dev | semantic | 79.6% | 0.569 | 54 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | dev | lexical | 100.0% | 0.931 | 18 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | dev | topical | 61.1% | 0.396 | 18 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | dev | overall | 77.8% | 0.612 | 90 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | dev | semantic | 75.9% | 0.553 | 54 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | dev | lexical | 100.0% | 0.935 | 18 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | dev | topical | 61.1% | 0.466 | 18 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | dev | overall | 81.1% | 0.693 | 90 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | dev | semantic | 85.2% | 0.753 | 54 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | dev | lexical | 100.0% | 0.921 | 18 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | dev | topical | 50.0% | 0.287 | 18 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | dev | overall | 81.1% | 0.693 | 90 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | dev | semantic | 85.2% | 0.753 | 54 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | dev | lexical | 100.0% | 0.921 | 18 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | dev | topical | 50.0% | 0.287 | 18 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | dev | overall | 77.8% | 0.681 | 90 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | dev | semantic | 83.3% | 0.755 | 54 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | dev | lexical | 100.0% | 0.921 | 18 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | dev | topical | 38.9% | 0.219 | 18 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | dev | overall | 86.7% | 0.738 | 90 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | dev | semantic | 88.9% | 0.755 | 54 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | dev | topical | 66.7% | 0.452 | 18 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | dev | overall | 87.8% | 0.768 | 90 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | dev | semantic | 90.7% | 0.806 | 54 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | dev | topical | 66.7% | 0.452 | 18 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | dev | overall | 86.7% | 0.757 | 90 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | dev | semantic | 90.7% | 0.789 | 54 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | dev | topical | 61.1% | 0.446 | 18 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | dev | overall | 83.3% | 0.762 | 90 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | dev | semantic | 85.2% | 0.809 | 54 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | dev | topical | 61.1% | 0.407 | 18 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | dev | overall | 86.7% | 0.757 | 90 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | dev | semantic | 90.7% | 0.789 | 54 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | dev | topical | 61.1% | 0.446 | 18 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | dev | overall | 86.7% | 0.757 | 90 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | dev | semantic | 90.7% | 0.789 | 54 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | dev | topical | 61.1% | 0.446 | 18 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | dev | overall | 86.7% | 0.757 | 90 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | dev | semantic | 90.7% | 0.789 | 54 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | dev | topical | 61.1% | 0.446 | 18 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | dev | overall | 86.7% | 0.757 | 90 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | dev | semantic | 90.7% | 0.789 | 54 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | dev | topical | 61.1% | 0.446 | 18 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | dev | overall | 87.8% | 0.757 | 90 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | dev | semantic | 92.6% | 0.789 | 54 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | dev | topical | 61.1% | 0.446 | 18 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | dev | overall | 87.8% | 0.758 | 90 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | dev | semantic | 92.6% | 0.791 | 54 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | dev | topical | 61.1% | 0.446 | 18 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | dev | overall | 87.8% | 0.757 | 90 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | dev | semantic | 92.6% | 0.789 | 54 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | dev | topical | 61.1% | 0.446 | 18 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | dev | overall | 87.8% | 0.755 | 90 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | dev | semantic | 92.6% | 0.788 | 54 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | dev | topical | 61.1% | 0.437 | 18 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | dev | overall | 87.8% | 0.756 | 90 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | dev | semantic | 92.6% | 0.790 | 54 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | dev | topical | 61.1% | 0.437 | 18 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | dev | overall | 81.1% | 0.555 | 90 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | dev | semantic | 77.8% | 0.438 | 54 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | dev | topical | 72.2% | 0.486 | 18 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | dev | overall | 83.3% | 0.599 | 90 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | dev | semantic | 81.5% | 0.494 | 54 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | dev | topical | 72.2% | 0.542 | 18 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | dev | overall | 81.1% | 0.532 | 90 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | dev | semantic | 77.8% | 0.411 | 54 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | dev | lexical | 100.0% | 0.963 | 18 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | dev | topical | 72.2% | 0.466 | 18 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | dev | overall | 85.6% | 0.583 | 90 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | dev | semantic | 85.2% | 0.478 | 54 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | dev | lexical | 100.0% | 0.963 | 18 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | dev | topical | 72.2% | 0.521 | 18 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | dev | overall | 81.1% | 0.555 | 90 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | dev | semantic | 77.8% | 0.438 | 54 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | dev | topical | 72.2% | 0.486 | 18 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | dev | overall | 83.3% | 0.599 | 90 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | dev | semantic | 81.5% | 0.494 | 54 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | dev | topical | 72.2% | 0.542 | 18 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | dev | overall | 81.1% | 0.532 | 90 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | dev | semantic | 77.8% | 0.411 | 54 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | dev | lexical | 100.0% | 0.963 | 18 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | dev | topical | 72.2% | 0.466 | 18 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | dev | overall | 85.6% | 0.583 | 90 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | dev | semantic | 85.2% | 0.478 | 54 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | dev | lexical | 100.0% | 0.963 | 18 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | dev | topical | 72.2% | 0.521 | 18 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
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

## Query latency (warm) & payload

| Condition | p50 | p90 | p95 | p99 | payload/query |
| --- | ---: | ---: | ---: | ---: | ---: |
| lexical | 40.18 ms | 196.34 ms | 214.14 ms | 319.29 ms | in-process |
| semantic:potion-retrieval-32M | 21.16 ms | 22.09 ms | 22.66 ms | 23.21 ms | in-process |
| hybrid-rrf:potion-retrieval-32M | 61.90 ms | 211.35 ms | 229.54 ms | 343.76 ms | in-process |
| semantic-top2:potion-retrieval-32M | 21.12 ms | 21.87 ms | 22.34 ms | 22.97 ms | in-process |
| hybrid-route:potion-retrieval-32M | 20.75 ms | 21.82 ms | 22.05 ms | 23.07 ms | in-process |
| hybrid-route-top2:potion-retrieval-32M | 21.29 ms | 22.13 ms | 22.54 ms | 23.26 ms | in-process |
| hybrid-wsum70:potion-retrieval-32M | 21.42 ms | 22.14 ms | 22.60 ms | 23.30 ms | in-process |
| hybrid-wsum85:potion-retrieval-32M | 20.76 ms | 22.14 ms | 22.49 ms | 23.69 ms | in-process |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | 21.36 ms | 22.25 ms | 22.79 ms | 23.43 ms | in-process |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | 22.10 ms | 22.57 ms | 23.06 ms | 23.66 ms | in-process |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | 22.33 ms | 22.76 ms | 23.07 ms | 23.44 ms | in-process |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | 23.06 ms | 23.64 ms | 23.85 ms | 24.45 ms | in-process |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | 21.56 ms | 23.18 ms | 23.67 ms | 24.53 ms | in-process |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | 21.51 ms | 22.27 ms | 22.53 ms | 23.30 ms | in-process |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | 21.37 ms | 22.18 ms | 22.34 ms | 22.91 ms | in-process |
| hybrid-route-maxsim-sum:potion-retrieval-32M | 35.97 ms | 43.17 ms | 48.12 ms | 90.68 ms | in-process |
| hybrid-route-maxsim-mean:potion-retrieval-32M | 37.09 ms | 45.46 ms | 48.41 ms | 93.06 ms | in-process |
| hybrid-route-maxsim-idf:potion-retrieval-32M | 36.90 ms | 43.96 ms | 48.31 ms | 62.56 ms | in-process |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | 35.42 ms | 44.03 ms | 47.79 ms | 91.95 ms | in-process |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | 35.76 ms | 43.56 ms | 47.13 ms | 97.66 ms | in-process |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | 36.47 ms | 43.42 ms | 47.59 ms | 65.57 ms | in-process |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | 37.02 ms | 43.56 ms | 47.10 ms | 64.80 ms | in-process |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | 37.62 ms | 44.04 ms | 47.05 ms | 49.42 ms | in-process |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | 38.06 ms | 44.62 ms | 47.42 ms | 49.08 ms | in-process |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | 37.67 ms | 44.49 ms | 46.28 ms | 50.04 ms | in-process |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | 35.99 ms | 42.36 ms | 45.35 ms | 47.57 ms | in-process |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | 36.86 ms | 43.33 ms | 47.06 ms | 48.94 ms | in-process |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | 35.91 ms | 42.62 ms | 45.93 ms | 47.40 ms | in-process |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | 36.47 ms | 42.79 ms | 46.58 ms | 50.15 ms | in-process |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | 37.25 ms | 43.04 ms | 47.04 ms | 48.99 ms | in-process |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | 36.76 ms | 42.24 ms | 45.39 ms | 48.02 ms | in-process |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | 37.42 ms | 43.64 ms | 45.95 ms | 49.42 ms | in-process |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | 37.23 ms | 43.44 ms | 45.82 ms | 49.35 ms | in-process |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | 37.78 ms | 44.13 ms | 47.07 ms | 50.06 ms | in-process |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | 37.36 ms | 43.90 ms | 45.91 ms | 50.37 ms | in-process |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | 37.76 ms | 43.73 ms | 47.37 ms | 49.86 ms | in-process |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | 38.39 ms | 45.04 ms | 48.15 ms | 50.82 ms | in-process |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | 38.44 ms | 44.77 ms | 48.20 ms | 51.16 ms | in-process |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | 37.77 ms | 44.25 ms | 46.68 ms | 50.23 ms | in-process |
| semantic:potion-base-8M | 12.62 ms | 12.97 ms | 13.40 ms | 14.26 ms | in-process |
| hybrid-rrf:potion-base-8M | 53.47 ms | 201.26 ms | 219.52 ms | 339.61 ms | in-process |

## Hybrid misses at 5 (error-analysis material)

- **sem-anemometer** (semantic): "instrument that measures the speed and pressure of wind" → expected Notes/Anemometer.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Hydraulics.md, Notes/Japan.md, Encyclopedia/H/Horn.md, Encyclopedia/L/Ligao.md, Reference/Cloaca.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Hydraulics.md, Encyclopedia/H/Horn.md, 0 Inbox/Mecca.md, Encyclopedia/L/Ligao.md, Reference/Cloaca.md
- **sem-anglesite** (semantic): "mineral composed of lead sulphate" → expected Encyclopedia/A/Anglesite.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Copper.md, Encyclopedia/I/Irnerius.md, Encyclopedia/C/Chemistry.md, Encyclopedia/C/Calcite.md, Encyclopedia/B/Barytes.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Copper.md, Encyclopedia/I/Irnerius.md, Encyclopedia/C/Chemistry.md, Encyclopedia/C/Calcite.md, Encyclopedia/M/Magnesite.md
- **sem-jaguar** (semantic): "largest wild cat found on the American continent" → expected Encyclopedia/J/Jaguar.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/India.md, Encyclopedia/F/Fur.md, Reference/Australia.md, Notes/Argentina.md, 0 Inbox/Mammalia.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Canachus.md, Reference/India.md, Encyclopedia/G/Geography.md, Reference/Australia.md, Encyclopedia/I/Indo-China.md
- **sem-dahlia** (semantic): "Mexican garden flower named after a pupil of Linnaeus" → expected Sources/Dahlia.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Notes/Japan.md, Sources/Cotton.md, 0 Inbox/Flower.md, Encyclopedia/I/Italy.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Notes/Japan.md, 0 Inbox/Flower.md, Sources/Europe.md, Sources/Cotton.md
- **sem-geyser** (semantic): "natural hot spring that periodically erupts a column of boiling water and steam" → expected Sources/Geyser.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Notes/Japan.md, Reference/Hydraulics.md, Reference/Australia.md, Encyclopedia/E/Electric Eel.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Sources/Cotton.md, Encyclopedia/E/Electric Eel.md, Encyclopedia/B/Bacsanyi.md, Encyclopedia/D/Daille.md
- **sem-giraffe** (semantic): "the tallest living mammal, an African ruminant with a long neck" → expected Encyclopedia/G/Giraffe.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Australia.md, 0 Inbox/Mammalia.md, Encyclopedia/A/Asia.md, Reference/India.md, Sources/Evidence.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Reference/India.md, 0 Inbox/Mammalia.md, Encyclopedia/M/Madagascar.md, Notes/Horse.md
- **sem-guillotine** (semantic): "beheading machine of the French Revolution" → expected Sources/Guillotine.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/F/French Revolution.md, Notes/French Revolutionary Wars.md, Sources/Europe.md, Notes/History.md, Encyclopedia/I/Italy.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/F/French Revolution.md, Notes/French Revolutionary Wars.md, Sources/Europe.md, Encyclopedia/I/Italy.md, Notes/History.md
- **sem-hurricane** (semantic): "violent tropical wind storm of the West Indies" → expected Reference/Hurricane.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Reference/India.md, Sources/Europe.md, Reference/Hydraulics.md, Notes/Argentina.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/Australia.md, Reference/India.md, Notes/Argentina.md, Sources/Europe.md
- **sem-lemur** (semantic): "primates of Madagascar that are neither monkeys nor apes" → expected Encyclopedia/L/Lemur.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/M/Madagascar.md, 0 Inbox/Mammalia.md, Reference/Australia.md, Encyclopedia/A/Asia.md, Encyclopedia/A/Ape.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/M/Madagascar.md, 0 Inbox/Mammalia.md, Reference/Australia.md, Notes/Japan.md, Encyclopedia/A/Asia.md
- **sem-kite-bird** (semantic): "bird of prey once the most familiar in Great Britain, now among its rarest" → expected Encyclopedia/K/Kite.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Reference/India.md, Notes/Canachus.md, Sources/Archaeology.md, Encyclopedia/F/Flycatcher.md
- **sem-comet** (semantic): "nebulous celestial body travelling a highly eccentric orbit around the sun" → expected Reference/Comet.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Astronomy.md, Sources/Hindostani.md, Notes/Japan.md, 0 Inbox/Mecca.md, Encyclopedia/L/Ligao.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Astronomy.md, Notes/Japan.md, 0 Inbox/Mecca.md, Sources/Hindostani.md, Encyclopedia/C/Celt.md
- **sem-fog** (semantic): "suspended particles near the ground that make surrounding objects invisible" → expected Reference/Fog.md
  - hybrid-rrf:potion-retrieval-32M top 5: 0 Inbox/Mecca.md, Encyclopedia/L/Ligao.md, Reference/Astronomy.md, Encyclopedia/M/Magnesite.md, Encyclopedia/E/Electric Eel.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Encyclopedia/E/Electric Eel.md, Encyclopedia/M/Magnesite.md, 0 Inbox/Cap Haitien.md, Reference/Hydraulics.md
- **sem-llama** (semantic): "domesticated South American pack animal of the camel family" → expected Notes/Llama.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Australia.md, Reference/India.md, Sources/Family.md, Encyclopedia/I/Indo-China.md, Encyclopedia/C/Civilis.md
  - hybrid-rrf:potion-base-8M top 5: Reference/India.md, Encyclopedia/A/Asia.md, Notes/Horse.md, Encyclopedia/I/Italy.md, Reference/Australia.md
- **sem-fox-statesman** (semantic): "eighteenth century British statesman and orator, son of Lord Holland" → expected Encyclopedia/F/Fox.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/L/Leeds.md, Reference/George.md, Encyclopedia/M/Marchmont.md, Notes/Japan.md, Encyclopedia/E/English Law.md
- **sem-darwin** (semantic): "Victorian naturalist who developed the theory of evolution by natural selection" → expected Sources/Darwin.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Evidence.md, Reference/Ethics.md, Encyclopedia/E/Embrun.md, Encyclopedia/F/Fine Arts.md, Sources/Aristotle.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Evidence.md, Reference/Ethics.md, Sources/Aristotle.md, Reference/Australia.md, Encyclopedia/E/Embrun.md
- **sem-faraday** (semantic): "English scientist famous for discoveries in electromagnetism and electrochemistry" → expected Reference/Faraday.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/E/Electric Eel.md, Encyclopedia/C/Chemistry.md, Encyclopedia/M/Magnesite.md, Notes/Japan.md, Encyclopedia/I/Italy.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/E/Electric Eel.md, Encyclopedia/C/Chemistry.md, Encyclopedia/M/Magnesite.md, Encyclopedia/L/Ligao.md, Notes/Japan.md
- **sem-machiavelli** (semantic): "Florentine political theorist whose name became a byword for cunning statecraft" → expected Encyclopedia/M/Machiavelli.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/I/Italy.md, Encyclopedia/E/English Law.md, Sources/Europe.md, Encyclopedia/F/Florence.md, Sources/Aristotle.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/I/Italy.md, Encyclopedia/E/English Law.md, Encyclopedia/F/Florence.md, Sources/Germanium.md, Encyclopedia/D/Drama.md
- **top-birds-of-prey** (topical): "birds of prey" → expected Reference/Eagle.md, Encyclopedia/H/Hawk.md, Encyclopedia/K/Kite.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/India.md, Notes/Humming-Bird.md, Encyclopedia/F/Frigate-Bird.md, Reference/Australia.md, Encyclopedia/F/Feather.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/I/Italy.md, Notes/Humming-Bird.md, Reference/India.md, Reference/Australia.md, Encyclopedia/K/Kestrel.md
- **top-big-cats** (topical): "large wild cats" → expected Encyclopedia/J/Jaguar.md, Encyclopedia/L/Leopard.md, Reference/Lynx.md
  - hybrid-rrf:potion-base-8M top 5: Reference/India.md, Encyclopedia/H/Himalaya.md, Encyclopedia/F/Fur.md, Reference/Australia.md, Notes/Canachus.md
- **top-green-gemstones** (topical): "green gemstones" → expected Encyclopedia/E/Emerald.md, Notes/Jade.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Green Bay.md, Notes/Green Ribbon Club.md, Encyclopedia/B/Bowling Green.md, Notes/Greenockite.md, Reference/Greensand.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Greenockite.md, Reference/Greensand.md, Reference/Apatite.md, Encyclopedia/E/Epidote.md, Notes/Marble.md
- **top-weather** (topical): "violent weather phenomena" → expected Reference/Hurricane.md, Encyclopedia/H/Hail.md, Reference/Fog.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Encyclopedia/C/Chile.md, Reference/India.md, Encyclopedia/B/Breaking Bulk.md, Reference/Australia.md
  - hybrid-rrf:potion-base-8M top 5: Reference/India.md, Encyclopedia/C/Chile.md, Notes/Japan.md, Reference/Australia.md, Sources/Influenza.md
- **top-instruments** (topical): "musical instruments" → expected Reference/Flute.md, Sources/Drum.md
  - hybrid-rrf:potion-retrieval-32M top 5: 0 Inbox/Instrument.md, Encyclopedia/G/Guitar.md, Encyclopedia/H/Horn.md, Reference/Keyboard.md, Reference/Bombardon.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Instrument.md, Encyclopedia/G/Guitar.md, Encyclopedia/C/Clarinet.md, Encyclopedia/K/Kettle.md, Encyclopedia/H/Harmonica.md
- **top-composers** (topical): "great German composers" → expected Sources/Beethoven.md, Encyclopedia/H/Handel.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Germanium.md, Notes/History.md, Sources/Hymettus.md, Reference/Bastian.md, Sources/Franco-German War.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Germanium.md, Sources/Hymettus.md, Notes/History.md, Reference/Encyclical.md, 0 Inbox/Instrument.md
- **top-dairy** (topical): "foods made from milk" → expected Encyclopedia/C/Cheese.md, Encyclopedia/B/Butter.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/D/Daille.md, Reference/Cattle.md, Notes/Canachus.md, Notes/Dietetics.md, Reference/India.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/D/Daille.md, Reference/Cattle.md, Notes/Dietetics.md, Notes/Canachus.md, Reference/India.md
- **sem-astrolabe** (semantic): "ancient instrument for taking the altitude of stars, sun and moon" → expected Encyclopedia/A/Astrolabe.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Astronomy.md, Sources/Hindostani.md, Notes/Japan.md, Sources/Aristotle.md, Encyclopedia/L/Ligao.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Astronomy.md, Sources/Hindostani.md, Notes/Japan.md, Reference/India.md, Encyclopedia/I/Italy.md
- **sem-brick** (semantic): "artificial stone of burnt clay used as a building material" → expected Encyclopedia/B/Brick.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Encyclopedia/B/Babylon.md, Encyclopedia/I/Ireland.md, Encyclopedia/F/Fine Arts.md, 0 Inbox/Mecca.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Encyclopedia/F/Fine Arts.md, Encyclopedia/B/Babylon.md, Encyclopedia/I/Ireland.md, Encyclopedia/M/Magnesite.md
- **sem-mars** (semantic): "the reddish fourth planet in order of distance from the sun" → expected Reference/Mars.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Astronomy.md, Sources/Aristotle.md, Sources/Hindostani.md, Encyclopedia/L/Ligao.md, Sources/Evidence.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Astronomy.md, Sources/Europe.md, Notes/Japan.md, Encyclopedia/L/Ligao.md, Sources/Map.md
- **sem-carnival** (semantic): "days of feasting and merrymaking before Lent" → expected Notes/Carnival.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Lent.md, Encyclopedia/F/Fasting.md, Encyclopedia/E/Eucharist.md, 0 Inbox/Mecca.md, Encyclopedia/M/Madagascar.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Lent.md, Encyclopedia/F/Fasting.md, Encyclopedia/E/Eucharist.md, Encyclopedia/M/Madagascar.md, Encyclopedia/A/Armenia.md
- **sem-clover** (semantic): "plant of the pea family named for its three leaflets" → expected Sources/Clover.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Sources/Cotton.md, Encyclopedia/L/Leaf.md, Encyclopedia/I/Italy.md, 0 Inbox/Flower.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Encyclopedia/I/Italy.md, Reference/Australia.md, Sources/Europe.md, Sources/Cotton.md
- **sem-crown-coin** (semantic): "English silver coin of the value of five shillings" → expected Reference/Crown.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Reference/India.md, Notes/History.md, Encyclopedia/C/Coin.md, Notes/Canachus.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Notes/History.md, Reference/India.md, Encyclopedia/E/Exchange.md, Encyclopedia/C/Coin.md
- **sem-equator** (semantic): "great circle equidistant from the two poles dividing the hemispheres" → expected Encyclopedia/E/Equator.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Map.md, 0 Inbox/Mecca.md, Reference/Astronomy.md, Reference/Geodesy.md, Encyclopedia/M/Magnesite.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Map.md, Reference/Astronomy.md, 0 Inbox/Mecca.md, Encyclopedia/M/Magnesite.md, Encyclopedia/E/Electrokinetics.md
- **sem-flag** (semantic): "piece of bunting waved from a staff as a standard, ensign or signal" → expected Encyclopedia/F/Flag.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Hydraulics.md, Encyclopedia/K/Knight.md, Reference/Astronomy.md, Sources/Cotton.md, 0 Inbox/Mecca.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Notes/Japan.md, Encyclopedia/K/Knight.md, Reference/Astronomy.md, Reference/Hydraulics.md
- **sem-grasshopper** (semantic): "leaping insect with powerful hind legs that stridulates" → expected Encyclopedia/G/Grasshopper.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/C/Coleoptera.md, Encyclopedia/H/Hexapoda.md, Encyclopedia/E/Entomology.md, Encyclopedia/I/Insect.md, Sources/Lepidoptera.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/C/Coleoptera.md, Encyclopedia/H/Hexapoda.md, Sources/Lepidoptera.md, Encyclopedia/I/Insectivora.md, Encyclopedia/I/Insect.md
- **sem-lantern** (semantic): "case of transparent material protecting a light from rain and wind" → expected Reference/Lantern.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Sources/Horticulture.md, Sources/Europe.md, Reference/India.md, Encyclopedia/E/Electric Eel.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Notes/Japan.md, Sources/Europe.md, Sources/Cotton.md, Encyclopedia/A/Asia.md
- **sem-marble** (semantic): "limestone close enough in texture to admit of being polished" → expected Notes/Marble.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/I/Ireland.md, Encyclopedia/M/Magnesite.md, Encyclopedia/L/Limestone.md, Notes/Japan.md, Encyclopedia/I/Italy.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Sources/Horticulture.md, Reference/Ethics.md, Sources/Cotton.md, Encyclopedia/E/Edric.md
- **sem-hare** (semantic): "well-known English rodent allied to the rabbit, with an Alpine mountain relative" → expected Notes/Hare.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Australia.md, Notes/Japan.md, Encyclopedia/I/Italy.md, Notes/Canachus.md, 0 Inbox/Mammalia.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Encyclopedia/I/Italy.md, Notes/Japan.md, Reference/India.md, Encyclopedia/C/Chile.md
- **sem-lacrosse** (semantic): "national ball game of Canada played with a curved netted stick" → expected 0 Inbox/Lacrosse.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Reference/Hydraulics.md, 0 Inbox/Mecca.md, Reference/India.md, Notes/Canachus.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Reference/Hydraulics.md, Encyclopedia/I/Ireland.md, Sources/Cotton.md, Notes/Canachus.md
- **sem-haydn** (semantic): "Austrian composer of Croatian stock born at Rohrau" → expected Notes/Haydn.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Croatia-Slavonia.md, Notes/History.md, Sources/Europe.md, Reference/Australia.md, Encyclopedia/D/Dalmatia.md
- **sem-edison** (semantic): "American inventor who began as a railway news-boy experimenting in chemistry" → expected Encyclopedia/E/Edison.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/C/Chemistry.md, Sources/Cotton.md, Encyclopedia/E/Electric Eel.md, Encyclopedia/M/Magnesite.md, Encyclopedia/D/Deadwood.md
- **sem-anvil** (semantic): "mass of iron on which material is supported while shaped under the hammer" → expected Reference/Anvil.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Encyclopedia/M/Magnesite.md, Reference/Australia.md, Encyclopedia/I/Italy.md, Reference/Cloaca.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/Australia.md, Encyclopedia/M/Magnesite.md, 0 Inbox/Mecca.md, Sources/Europe.md
- **top-orchard-fruits** (topical): "fruits grown in gardens and orchards" → expected Reference/Apple.md, Sources/Gooseberry.md, Sources/Lemon.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Notes/Canachus.md, Encyclopedia/I/Italy.md, Reference/India.md, Notes/Japan.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Notes/Canachus.md, Encyclopedia/I/Italy.md, Sources/Europe.md, Reference/India.md
- **top-english-poets** (topical): "lives of the English poets" → expected Encyclopedia/B/Byron.md, Notes/Chaucer.md, Encyclopedia/D/Dryden.md, 0 Inbox/Gray.md, Notes/Cowper.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/C/Celt.md, Encyclopedia/E/English Law.md, Encyclopedia/D/Drama.md, Sources/Hindostani.md, Sources/Arnold.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/E/English Law.md, Encyclopedia/C/Celt.md, Notes/Japan.md, Encyclopedia/I/Iceland.md, Sources/Dutch East India Company.md
- **top-british-philosophers** (topical): "British philosophers of the seventeenth and eighteenth centuries" → expected Encyclopedia/L/Locke.md, Reference/Berkeley.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Aristotle.md, Reference/Ethics.md, Encyclopedia/E/English Law.md, Sources/Germanium.md, Encyclopedia/E/Edric.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/I/Ireland.md, Sources/Europe.md, Sources/Germanium.md, Reference/Astronomy.md, Sources/Aristotle.md
- **top-great-rivers** (topical): "great rivers of the world" → expected Encyclopedia/E/Euphrates.md, Encyclopedia/G/Ganges.md, Encyclopedia/E/Elbe.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Europe.md, Notes/Japan.md, Reference/Australia.md, Reference/India.md, Reference/Hydraulics.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Europe.md, Reference/Australia.md, Sources/Germanium.md, Notes/Canachus.md, Encyclopedia/G/Geography.md
- **top-indoor-games** (topical): "indoor games of skill played on a table or board" → expected Encyclopedia/B/Billiards.md, Encyclopedia/D/Draughts.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/G/Games.md, Encyclopedia/I/Ireland.md, 0 Inbox/Mecca.md, Encyclopedia/D/Drama.md, Encyclopedia/F/Fine Arts.md
- **top-sea-fishes** (topical): "fishes of the open sea" → expected Encyclopedia/C/Cod.md, Notes/Mackerel.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Reference/India.md, Encyclopedia/I/Ireland.md, Sources/Caspian Sea.md, Reference/Australia.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/India.md, Reference/Australia.md, Encyclopedia/I/Italy.md, Sources/Caspian Sea.md
- **top-light-sources** (topical): "devices for holding and carrying a light" → expected Encyclopedia/L/Lamp.md, Reference/Lantern.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Encyclopedia/L/Ligao.md, Encyclopedia/E/Electric Eel.md, Reference/Astronomy.md, Encyclopedia/F/Fine Arts.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Cotton.md, 0 Inbox/Mecca.md, Reference/Hydraulics.md, Encyclopedia/E/Electric Eel.md, Sources/Dream.md

## Gate verdict

> **Pre-registered gate:** hybrid RRF must beat lexical-only by ≥10 points hit@5 on the semantic subset, regress ≤2 points on the exact-term subset, and warm end-to-end semantic query (embed + scan) p95 ≤ 15 ms at 10k notes. +5..+10 points = discuss zone. Model choice = smallest model passing.

### potion-retrieval-32M — NO-SHIP

- semantic subset hit@5 +20.4 pts (gate ≥ +10): PASS
- lexical subset hit@5 0.0 pts (gate ≥ -2): PASS
- semantic warm p95 22.66 ms (gate ≤ 15 ms): FAIL

### potion-base-8M — SHIP

- semantic subset hit@5 +16.7 pts (gate ≥ +10): PASS
- lexical subset hit@5 0.0 pts (gate ≥ -2): PASS
- semantic warm p95 13.40 ms (gate ≤ 15 ms): PASS

**Overall: SHIP** — chosen model: potion-base-8M
