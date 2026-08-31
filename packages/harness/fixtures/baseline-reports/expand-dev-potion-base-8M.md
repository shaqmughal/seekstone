# Retrieval-quality eval (SHA-257 spike)

- **Snapshot:** 2026-08-31T02:46:12.386Z
- **Machine:** darwin/arm64, node v26.0.0, 10 cpus
- **Vault:** packages/harness/fixtures/vault (10000 notes)
- **Query set:** 90 queries (54 semantic, 18 lexical, 18 topical) [dev split only], 20 latency runs/query
- **Splits:** dev 90 (54/18/18), holdout 0 (0/0/0) — tuning reads dev only; gate v2 reports on holdout
- **Lexical index build:** 54332.00 ms
- **potion-base-8M:** dim 256, 45964 chunks, index build 62928.05 ms, model load 29.12 ms

## Retrieval quality

| Condition | Subset | hit@5 | MRR@10 | n |
| --- | --- | ---: | ---: | ---: |
| lexical | overall | 37.8% | 0.282 | 90 |
| lexical | semantic | 24.1% | 0.122 | 54 |
| lexical | lexical | 100.0% | 0.972 | 18 |
| lexical | topical | 16.7% | 0.075 | 18 |
| semantic:potion-base-8M | overall | 68.9% | 0.531 | 90 |
| semantic:potion-base-8M | semantic | 70.4% | 0.542 | 54 |
| semantic:potion-base-8M | lexical | 83.3% | 0.727 | 18 |
| semantic:potion-base-8M | topical | 50.0% | 0.305 | 18 |
| hybrid-rrf:potion-base-8M | overall | 50.0% | 0.388 | 90 |
| hybrid-rrf:potion-base-8M | semantic | 42.6% | 0.286 | 54 |
| hybrid-rrf:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-rrf:potion-base-8M | topical | 22.2% | 0.110 | 18 |
| semantic-top2:potion-base-8M | overall | 68.9% | 0.500 | 90 |
| semantic-top2:potion-base-8M | semantic | 63.0% | 0.454 | 54 |
| semantic-top2:potion-base-8M | lexical | 100.0% | 0.824 | 18 |
| semantic-top2:potion-base-8M | topical | 55.6% | 0.314 | 18 |
| hybrid-route:potion-base-8M | overall | 72.2% | 0.580 | 90 |
| hybrid-route:potion-base-8M | semantic | 70.4% | 0.542 | 54 |
| hybrid-route:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route:potion-base-8M | topical | 50.0% | 0.305 | 18 |
| hybrid-route-top2:potion-base-8M | overall | 68.9% | 0.529 | 90 |
| hybrid-route-top2:potion-base-8M | semantic | 63.0% | 0.454 | 54 |
| hybrid-route-top2:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-top2:potion-base-8M | topical | 55.6% | 0.314 | 18 |
| hybrid-wsum70:potion-base-8M | overall | 70.0% | 0.538 | 90 |
| hybrid-wsum70:potion-base-8M | semantic | 64.8% | 0.528 | 54 |
| hybrid-wsum70:potion-base-8M | lexical | 100.0% | 0.889 | 18 |
| hybrid-wsum70:potion-base-8M | topical | 55.6% | 0.217 | 18 |
| hybrid-wsum85:potion-base-8M | overall | 70.0% | 0.526 | 90 |
| hybrid-wsum85:potion-base-8M | semantic | 68.5% | 0.536 | 54 |
| hybrid-wsum85:potion-base-8M | lexical | 94.4% | 0.782 | 18 |
| hybrid-wsum85:potion-base-8M | topical | 50.0% | 0.243 | 18 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | overall | 73.3% | 0.599 | 90 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | semantic | 72.2% | 0.569 | 54 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | topical | 50.0% | 0.319 | 18 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | overall | 72.2% | 0.576 | 90 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | semantic | 70.4% | 0.544 | 54 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | topical | 50.0% | 0.303 | 18 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | overall | 71.1% | 0.554 | 90 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | semantic | 72.2% | 0.517 | 54 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | lexical | 94.4% | 0.917 | 18 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | topical | 44.4% | 0.304 | 18 |
| hybrid-route-softmax-t0.02:potion-base-8M | overall | 72.2% | 0.583 | 90 |
| hybrid-route-softmax-t0.02:potion-base-8M | semantic | 70.4% | 0.547 | 54 |
| hybrid-route-softmax-t0.02:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-softmax-t0.02:potion-base-8M | topical | 50.0% | 0.301 | 18 |
| hybrid-route-softmax-t0.05:potion-base-8M | overall | 72.2% | 0.589 | 90 |
| hybrid-route-softmax-t0.05:potion-base-8M | semantic | 70.4% | 0.559 | 54 |
| hybrid-route-softmax-t0.05:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-softmax-t0.05:potion-base-8M | topical | 50.0% | 0.295 | 18 |
| hybrid-route-softmax-t0.1:potion-base-8M | overall | 73.3% | 0.563 | 90 |
| hybrid-route-softmax-t0.1:potion-base-8M | semantic | 74.1% | 0.507 | 54 |
| hybrid-route-softmax-t0.1:potion-base-8M | lexical | 94.4% | 0.917 | 18 |
| hybrid-route-softmax-t0.1:potion-base-8M | topical | 50.0% | 0.376 | 18 |
| hybrid-route-softmax-t0.2:potion-base-8M | overall | 72.2% | 0.519 | 90 |
| hybrid-route-softmax-t0.2:potion-base-8M | semantic | 66.7% | 0.447 | 54 |
| hybrid-route-softmax-t0.2:potion-base-8M | lexical | 94.4% | 0.917 | 18 |
| hybrid-route-softmax-t0.2:potion-base-8M | topical | 66.7% | 0.337 | 18 |
| hybrid-route-maxsim-sum:potion-base-8M | overall | 77.8% | 0.657 | 90 |
| hybrid-route-maxsim-sum:potion-base-8M | semantic | 85.2% | 0.731 | 54 |
| hybrid-route-maxsim-sum:potion-base-8M | lexical | 100.0% | 0.931 | 18 |
| hybrid-route-maxsim-sum:potion-base-8M | topical | 33.3% | 0.161 | 18 |
| hybrid-route-maxsim-mean:potion-base-8M | overall | 77.8% | 0.657 | 90 |
| hybrid-route-maxsim-mean:potion-base-8M | semantic | 85.2% | 0.731 | 54 |
| hybrid-route-maxsim-mean:potion-base-8M | lexical | 100.0% | 0.931 | 18 |
| hybrid-route-maxsim-mean:potion-base-8M | topical | 33.3% | 0.161 | 18 |
| hybrid-route-maxsim-idf:potion-base-8M | overall | 76.7% | 0.664 | 90 |
| hybrid-route-maxsim-idf:potion-base-8M | semantic | 81.5% | 0.748 | 54 |
| hybrid-route-maxsim-idf:potion-base-8M | lexical | 100.0% | 0.931 | 18 |
| hybrid-route-maxsim-idf:potion-base-8M | topical | 38.9% | 0.146 | 18 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | overall | 82.2% | 0.664 | 90 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | semantic | 83.3% | 0.692 | 54 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | topical | 61.1% | 0.269 | 18 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | overall | 82.2% | 0.697 | 90 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | semantic | 87.0% | 0.751 | 54 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | topical | 50.0% | 0.258 | 18 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | overall | 83.3% | 0.678 | 90 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | semantic | 85.2% | 0.721 | 54 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | topical | 61.1% | 0.257 | 18 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | overall | 80.0% | 0.699 | 90 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | semantic | 85.2% | 0.761 | 54 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | topical | 44.4% | 0.240 | 18 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | overall | 83.3% | 0.678 | 90 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | semantic | 85.2% | 0.721 | 54 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | topical | 61.1% | 0.257 | 18 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | overall | 83.3% | 0.678 | 90 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | semantic | 85.2% | 0.721 | 54 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | topical | 61.1% | 0.257 | 18 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | overall | 83.3% | 0.678 | 90 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | semantic | 85.2% | 0.721 | 54 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | topical | 61.1% | 0.257 | 18 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | overall | 83.3% | 0.678 | 90 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | semantic | 85.2% | 0.721 | 54 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | topical | 61.1% | 0.257 | 18 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | overall | 83.3% | 0.678 | 90 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | semantic | 85.2% | 0.721 | 54 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | topical | 61.1% | 0.257 | 18 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | overall | 83.3% | 0.678 | 90 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | semantic | 85.2% | 0.721 | 54 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | topical | 61.1% | 0.257 | 18 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | overall | 80.0% | 0.674 | 90 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | semantic | 81.5% | 0.716 | 54 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | topical | 55.6% | 0.252 | 18 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | overall | 83.3% | 0.678 | 90 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | semantic | 85.2% | 0.721 | 54 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | topical | 61.1% | 0.257 | 18 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | overall | 83.3% | 0.678 | 90 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | semantic | 85.2% | 0.721 | 54 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | topical | 61.1% | 0.257 | 18 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | overall | 80.0% | 0.601 | 90 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | semantic | 81.5% | 0.603 | 54 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | topical | 55.6% | 0.226 | 18 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | overall | 82.2% | 0.648 | 90 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | semantic | 85.2% | 0.672 | 54 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | topical | 55.6% | 0.255 | 18 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | overall | 80.0% | 0.601 | 90 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | semantic | 81.5% | 0.603 | 54 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | topical | 55.6% | 0.226 | 18 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | overall | 82.2% | 0.648 | 90 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | semantic | 85.2% | 0.672 | 54 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | topical | 55.6% | 0.255 | 18 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | overall | 80.0% | 0.601 | 90 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | semantic | 81.5% | 0.603 | 54 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | topical | 55.6% | 0.226 | 18 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | overall | 82.2% | 0.648 | 90 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | semantic | 85.2% | 0.672 | 54 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | topical | 55.6% | 0.255 | 18 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | overall | 80.0% | 0.601 | 90 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | semantic | 81.5% | 0.603 | 54 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | topical | 55.6% | 0.226 | 18 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | overall | 82.2% | 0.648 | 90 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | semantic | 85.2% | 0.672 | 54 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | topical | 55.6% | 0.255 | 18 |

## Retrieval quality by split (SHA-312)

Dev is the tuning split; holdout is the reporting split for gate v2.

| Condition | Split | Subset | hit@5 | MRR@10 | n |
| --- | --- | --- | ---: | ---: | ---: |
| lexical | dev | overall | 37.8% | 0.282 | 90 |
| lexical | dev | semantic | 24.1% | 0.122 | 54 |
| lexical | dev | lexical | 100.0% | 0.972 | 18 |
| lexical | dev | topical | 16.7% | 0.075 | 18 |
| lexical | holdout | overall | 0.0% | 0.000 | 0 |
| lexical | holdout | semantic | 0.0% | 0.000 | 0 |
| lexical | holdout | lexical | 0.0% | 0.000 | 0 |
| lexical | holdout | topical | 0.0% | 0.000 | 0 |
| semantic:potion-base-8M | dev | overall | 68.9% | 0.531 | 90 |
| semantic:potion-base-8M | dev | semantic | 70.4% | 0.542 | 54 |
| semantic:potion-base-8M | dev | lexical | 83.3% | 0.727 | 18 |
| semantic:potion-base-8M | dev | topical | 50.0% | 0.305 | 18 |
| semantic:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| semantic:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| semantic:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| semantic:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-rrf:potion-base-8M | dev | overall | 50.0% | 0.388 | 90 |
| hybrid-rrf:potion-base-8M | dev | semantic | 42.6% | 0.286 | 54 |
| hybrid-rrf:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-rrf:potion-base-8M | dev | topical | 22.2% | 0.110 | 18 |
| hybrid-rrf:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-rrf:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-rrf:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-rrf:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| semantic-top2:potion-base-8M | dev | overall | 68.9% | 0.500 | 90 |
| semantic-top2:potion-base-8M | dev | semantic | 63.0% | 0.454 | 54 |
| semantic-top2:potion-base-8M | dev | lexical | 100.0% | 0.824 | 18 |
| semantic-top2:potion-base-8M | dev | topical | 55.6% | 0.314 | 18 |
| semantic-top2:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| semantic-top2:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| semantic-top2:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| semantic-top2:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route:potion-base-8M | dev | overall | 72.2% | 0.580 | 90 |
| hybrid-route:potion-base-8M | dev | semantic | 70.4% | 0.542 | 54 |
| hybrid-route:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route:potion-base-8M | dev | topical | 50.0% | 0.305 | 18 |
| hybrid-route:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-top2:potion-base-8M | dev | overall | 68.9% | 0.529 | 90 |
| hybrid-route-top2:potion-base-8M | dev | semantic | 63.0% | 0.454 | 54 |
| hybrid-route-top2:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-top2:potion-base-8M | dev | topical | 55.6% | 0.314 | 18 |
| hybrid-route-top2:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-top2:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-top2:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-top2:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-wsum70:potion-base-8M | dev | overall | 70.0% | 0.538 | 90 |
| hybrid-wsum70:potion-base-8M | dev | semantic | 64.8% | 0.528 | 54 |
| hybrid-wsum70:potion-base-8M | dev | lexical | 100.0% | 0.889 | 18 |
| hybrid-wsum70:potion-base-8M | dev | topical | 55.6% | 0.217 | 18 |
| hybrid-wsum70:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-wsum70:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-wsum70:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-wsum70:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-wsum85:potion-base-8M | dev | overall | 70.0% | 0.526 | 90 |
| hybrid-wsum85:potion-base-8M | dev | semantic | 68.5% | 0.536 | 54 |
| hybrid-wsum85:potion-base-8M | dev | lexical | 94.4% | 0.782 | 18 |
| hybrid-wsum85:potion-base-8M | dev | topical | 50.0% | 0.243 | 18 |
| hybrid-wsum85:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-wsum85:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-wsum85:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-wsum85:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | dev | overall | 73.3% | 0.599 | 90 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | dev | semantic | 72.2% | 0.569 | 54 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | dev | topical | 50.0% | 0.319 | 18 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.01:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | dev | overall | 72.2% | 0.576 | 90 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | dev | semantic | 70.4% | 0.544 | 54 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | dev | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | dev | topical | 50.0% | 0.303 | 18 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.02:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | dev | overall | 71.1% | 0.554 | 90 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | dev | semantic | 72.2% | 0.517 | 54 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | dev | lexical | 94.4% | 0.917 | 18 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | dev | topical | 44.4% | 0.304 | 18 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.04:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.02:potion-base-8M | dev | overall | 72.2% | 0.583 | 90 |
| hybrid-route-softmax-t0.02:potion-base-8M | dev | semantic | 70.4% | 0.547 | 54 |
| hybrid-route-softmax-t0.02:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-softmax-t0.02:potion-base-8M | dev | topical | 50.0% | 0.301 | 18 |
| hybrid-route-softmax-t0.02:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.02:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.02:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.02:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.05:potion-base-8M | dev | overall | 72.2% | 0.589 | 90 |
| hybrid-route-softmax-t0.05:potion-base-8M | dev | semantic | 70.4% | 0.559 | 54 |
| hybrid-route-softmax-t0.05:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-softmax-t0.05:potion-base-8M | dev | topical | 50.0% | 0.295 | 18 |
| hybrid-route-softmax-t0.05:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.05:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.05:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.05:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.1:potion-base-8M | dev | overall | 73.3% | 0.563 | 90 |
| hybrid-route-softmax-t0.1:potion-base-8M | dev | semantic | 74.1% | 0.507 | 54 |
| hybrid-route-softmax-t0.1:potion-base-8M | dev | lexical | 94.4% | 0.917 | 18 |
| hybrid-route-softmax-t0.1:potion-base-8M | dev | topical | 50.0% | 0.376 | 18 |
| hybrid-route-softmax-t0.1:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.1:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.1:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.1:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.2:potion-base-8M | dev | overall | 72.2% | 0.519 | 90 |
| hybrid-route-softmax-t0.2:potion-base-8M | dev | semantic | 66.7% | 0.447 | 54 |
| hybrid-route-softmax-t0.2:potion-base-8M | dev | lexical | 94.4% | 0.917 | 18 |
| hybrid-route-softmax-t0.2:potion-base-8M | dev | topical | 66.7% | 0.337 | 18 |
| hybrid-route-softmax-t0.2:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.2:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.2:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.2:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-sum:potion-base-8M | dev | overall | 77.8% | 0.657 | 90 |
| hybrid-route-maxsim-sum:potion-base-8M | dev | semantic | 85.2% | 0.731 | 54 |
| hybrid-route-maxsim-sum:potion-base-8M | dev | lexical | 100.0% | 0.931 | 18 |
| hybrid-route-maxsim-sum:potion-base-8M | dev | topical | 33.3% | 0.161 | 18 |
| hybrid-route-maxsim-sum:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-sum:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-sum:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-sum:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean:potion-base-8M | dev | overall | 77.8% | 0.657 | 90 |
| hybrid-route-maxsim-mean:potion-base-8M | dev | semantic | 85.2% | 0.731 | 54 |
| hybrid-route-maxsim-mean:potion-base-8M | dev | lexical | 100.0% | 0.931 | 18 |
| hybrid-route-maxsim-mean:potion-base-8M | dev | topical | 33.3% | 0.161 | 18 |
| hybrid-route-maxsim-mean:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf:potion-base-8M | dev | overall | 76.7% | 0.664 | 90 |
| hybrid-route-maxsim-idf:potion-base-8M | dev | semantic | 81.5% | 0.748 | 54 |
| hybrid-route-maxsim-idf:potion-base-8M | dev | lexical | 100.0% | 0.931 | 18 |
| hybrid-route-maxsim-idf:potion-base-8M | dev | topical | 38.9% | 0.146 | 18 |
| hybrid-route-maxsim-idf:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | dev | overall | 82.2% | 0.664 | 90 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | dev | semantic | 83.3% | 0.692 | 54 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | dev | topical | 61.1% | 0.269 | 18 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b50:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | dev | overall | 82.2% | 0.697 | 90 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | dev | semantic | 87.0% | 0.751 | 54 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | dev | topical | 50.0% | 0.258 | 18 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b70:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | dev | overall | 83.3% | 0.678 | 90 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | dev | semantic | 85.2% | 0.721 | 54 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | dev | topical | 61.1% | 0.257 | 18 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b50:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | dev | overall | 80.0% | 0.699 | 90 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | dev | semantic | 85.2% | 0.761 | 54 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | dev | topical | 44.4% | 0.240 | 18 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b70:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | dev | overall | 83.3% | 0.678 | 90 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | dev | semantic | 85.2% | 0.721 | 54 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | dev | topical | 61.1% | 0.257 | 18 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | dev | overall | 83.3% | 0.678 | 90 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | dev | semantic | 85.2% | 0.721 | 54 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | dev | topical | 61.1% | 0.257 | 18 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | dev | overall | 83.3% | 0.678 | 90 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | dev | semantic | 85.2% | 0.721 | 54 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | dev | topical | 61.1% | 0.257 | 18 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | dev | overall | 83.3% | 0.678 | 90 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | dev | semantic | 85.2% | 0.721 | 54 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | dev | topical | 61.1% | 0.257 | 18 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | dev | overall | 83.3% | 0.678 | 90 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | dev | semantic | 85.2% | 0.721 | 54 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | dev | topical | 61.1% | 0.257 | 18 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | dev | overall | 83.3% | 0.678 | 90 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | dev | semantic | 85.2% | 0.721 | 54 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | dev | topical | 61.1% | 0.257 | 18 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | dev | overall | 80.0% | 0.674 | 90 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | dev | semantic | 81.5% | 0.716 | 54 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | dev | topical | 55.6% | 0.252 | 18 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | dev | overall | 83.3% | 0.678 | 90 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | dev | semantic | 85.2% | 0.721 | 54 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | dev | topical | 61.1% | 0.257 | 18 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | dev | overall | 83.3% | 0.678 | 90 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | dev | semantic | 85.2% | 0.721 | 54 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | dev | topical | 61.1% | 0.257 | 18 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | dev | overall | 80.0% | 0.601 | 90 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | dev | semantic | 81.5% | 0.603 | 54 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | dev | topical | 55.6% | 0.226 | 18 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | dev | overall | 82.2% | 0.648 | 90 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | dev | semantic | 85.2% | 0.672 | 54 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | dev | topical | 55.6% | 0.255 | 18 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | dev | overall | 80.0% | 0.601 | 90 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | dev | semantic | 81.5% | 0.603 | 54 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | dev | topical | 55.6% | 0.226 | 18 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | dev | overall | 82.2% | 0.648 | 90 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | dev | semantic | 85.2% | 0.672 | 54 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | dev | topical | 55.6% | 0.255 | 18 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | dev | overall | 80.0% | 0.601 | 90 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | dev | semantic | 81.5% | 0.603 | 54 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | dev | topical | 55.6% | 0.226 | 18 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | dev | overall | 82.2% | 0.648 | 90 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | dev | semantic | 85.2% | 0.672 | 54 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | dev | topical | 55.6% | 0.255 | 18 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | dev | overall | 80.0% | 0.601 | 90 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | dev | semantic | 81.5% | 0.603 | 54 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | dev | topical | 55.6% | 0.226 | 18 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | dev | overall | 82.2% | 0.648 | 90 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | dev | semantic | 85.2% | 0.672 | 54 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | dev | topical | 55.6% | 0.255 | 18 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | holdout | topical | 0.0% | 0.000 | 0 |

## Query latency (warm) & payload

| Condition | p50 | p90 | p95 | p99 | payload/query |
| --- | ---: | ---: | ---: | ---: | ---: |
| lexical | 56.49 ms | 259.11 ms | 285.51 ms | 451.16 ms | in-process |
| semantic:potion-base-8M | 15.33 ms | 16.31 ms | 16.60 ms | 17.04 ms | in-process |
| hybrid-rrf:potion-base-8M | 73.26 ms | 290.87 ms | 317.33 ms | 483.65 ms | in-process |
| semantic-top2:potion-base-8M | 15.66 ms | 17.34 ms | 17.62 ms | 18.35 ms | in-process |
| hybrid-route:potion-base-8M | 15.55 ms | 16.39 ms | 16.69 ms | 19.47 ms | in-process |
| hybrid-route-top2:potion-base-8M | 15.61 ms | 16.47 ms | 16.70 ms | 22.01 ms | in-process |
| hybrid-wsum70:potion-base-8M | 15.64 ms | 16.41 ms | 16.63 ms | 18.09 ms | in-process |
| hybrid-wsum85:potion-base-8M | 15.64 ms | 16.38 ms | 16.64 ms | 17.61 ms | in-process |
| hybrid-route-logdiscount-l0.01:potion-base-8M | 15.61 ms | 16.38 ms | 16.65 ms | 17.33 ms | in-process |
| hybrid-route-logdiscount-l0.02:potion-base-8M | 15.53 ms | 16.40 ms | 16.90 ms | 34.19 ms | in-process |
| hybrid-route-logdiscount-l0.04:potion-base-8M | 15.29 ms | 16.01 ms | 16.26 ms | 16.70 ms | in-process |
| hybrid-route-softmax-t0.02:potion-base-8M | 16.40 ms | 17.43 ms | 17.74 ms | 18.21 ms | in-process |
| hybrid-route-softmax-t0.05:potion-base-8M | 16.68 ms | 17.89 ms | 18.28 ms | 23.21 ms | in-process |
| hybrid-route-softmax-t0.1:potion-base-8M | 16.51 ms | 17.71 ms | 17.92 ms | 18.79 ms | in-process |
| hybrid-route-softmax-t0.2:potion-base-8M | 16.41 ms | 17.50 ms | 17.70 ms | 18.10 ms | in-process |
| hybrid-route-maxsim-sum:potion-base-8M | 26.68 ms | 32.03 ms | 33.43 ms | 37.75 ms | in-process |
| hybrid-route-maxsim-mean:potion-base-8M | 26.85 ms | 32.31 ms | 34.03 ms | 38.37 ms | in-process |
| hybrid-route-maxsim-idf:potion-base-8M | 27.79 ms | 33.45 ms | 35.56 ms | 43.59 ms | in-process |
| hybrid-route-maxsim-mean-b50:potion-base-8M | 27.41 ms | 33.93 ms | 37.10 ms | 48.52 ms | in-process |
| hybrid-route-maxsim-mean-b70:potion-base-8M | 27.34 ms | 32.93 ms | 34.78 ms | 40.19 ms | in-process |
| hybrid-route-maxsim-idf-b50:potion-base-8M | 27.74 ms | 33.81 ms | 36.15 ms | 44.93 ms | in-process |
| hybrid-route-maxsim-idf-b70:potion-base-8M | 27.19 ms | 32.52 ms | 34.37 ms | 38.74 ms | in-process |
| hybrid-route-xp-boost-d40c3g25:potion-base-8M | 28.13 ms | 34.36 ms | 36.93 ms | 41.33 ms | in-process |
| hybrid-route-xp-boost-d40c3g35:potion-base-8M | 28.63 ms | 35.41 ms | 38.16 ms | 47.42 ms | in-process |
| hybrid-route-xp-boost-d40c5g25:potion-base-8M | 28.41 ms | 34.22 ms | 36.91 ms | 41.83 ms | in-process |
| hybrid-route-xp-boost-d40c5g35:potion-base-8M | 27.82 ms | 33.30 ms | 34.87 ms | 39.06 ms | in-process |
| hybrid-route-xp-boost-d70c3g25:potion-base-8M | 28.16 ms | 33.57 ms | 35.24 ms | 40.03 ms | in-process |
| hybrid-route-xp-boost-d70c3g35:potion-base-8M | 28.18 ms | 33.57 ms | 35.55 ms | 40.21 ms | in-process |
| hybrid-route-xp-boost-d70c3g0:potion-base-8M | 28.17 ms | 33.34 ms | 35.13 ms | 38.63 ms | in-process |
| hybrid-route-xp-boost-d70c5g25:potion-base-8M | 28.28 ms | 34.55 ms | 37.87 ms | 50.61 ms | in-process |
| hybrid-route-xp-boost-d70c5g35:potion-base-8M | 28.18 ms | 33.90 ms | 35.85 ms | 39.81 ms | in-process |
| hybrid-route-xp-rrf-d40c3g25:potion-base-8M | 28.20 ms | 33.97 ms | 36.21 ms | 39.89 ms | in-process |
| hybrid-route-xp-rrf-d40c3g35:potion-base-8M | 28.48 ms | 34.25 ms | 36.28 ms | 40.61 ms | in-process |
| hybrid-route-xp-rrf-d40c5g25:potion-base-8M | 28.08 ms | 33.44 ms | 35.40 ms | 39.37 ms | in-process |
| hybrid-route-xp-rrf-d40c5g35:potion-base-8M | 27.99 ms | 33.94 ms | 35.93 ms | 39.82 ms | in-process |
| hybrid-route-xp-rrf-d70c3g25:potion-base-8M | 27.84 ms | 33.21 ms | 35.25 ms | 39.67 ms | in-process |
| hybrid-route-xp-rrf-d70c3g35:potion-base-8M | 27.99 ms | 33.72 ms | 35.93 ms | 41.98 ms | in-process |
| hybrid-route-xp-rrf-d70c5g25:potion-base-8M | 28.23 ms | 33.80 ms | 35.89 ms | 40.94 ms | in-process |
| hybrid-route-xp-rrf-d70c5g35:potion-base-8M | 27.86 ms | 33.55 ms | 35.50 ms | 40.76 ms | in-process |

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
- **sem-astrolabe** (semantic): "ancient instrument for taking the altitude of stars, sun and moon" → expected Encyclopedia/A/Astrolabe.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Astronomy.md, Sources/Hindostani.md, Notes/Japan.md, Reference/India.md, Encyclopedia/I/Italy.md
- **sem-brick** (semantic): "artificial stone of burnt clay used as a building material" → expected Encyclopedia/B/Brick.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Encyclopedia/F/Fine Arts.md, Encyclopedia/B/Babylon.md, Encyclopedia/M/Magnesite.md, Encyclopedia/F/Fire Brat.md
- **sem-mars** (semantic): "the reddish fourth planet in order of distance from the sun" → expected Reference/Mars.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Astronomy.md, Notes/Japan.md, Sources/Europe.md, Encyclopedia/L/Ligao.md, Sources/Map.md
- **sem-carnival** (semantic): "days of feasting and merrymaking before Lent" → expected Notes/Carnival.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Lent.md, Encyclopedia/F/Fasting.md, Encyclopedia/E/Eucharist.md, Encyclopedia/M/Madagascar.md, Encyclopedia/D/Daille.md
- **sem-clover** (semantic): "plant of the pea family named for its three leaflets" → expected Sources/Clover.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Encyclopedia/I/Italy.md, Reference/Australia.md, Encyclopedia/L/Leaf.md, Sources/Cotton.md
- **sem-crown-coin** (semantic): "English silver coin of the value of five shillings" → expected Reference/Crown.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Encyclopedia/E/Exchange.md, Reference/India.md, Notes/History.md, Encyclopedia/C/Coin.md
- **sem-equator** (semantic): "great circle equidistant from the two poles dividing the hemispheres" → expected Encyclopedia/E/Equator.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Map.md, Reference/Astronomy.md, 0 Inbox/Mecca.md, Encyclopedia/M/Magnesite.md, Encyclopedia/E/Electrokinetics.md
- **sem-flag** (semantic): "piece of bunting waved from a staff as a standard, ensign or signal" → expected Encyclopedia/F/Flag.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Notes/Japan.md, Reference/Astronomy.md, Reference/Hydraulics.md, Encyclopedia/L/Ligao.md
- **sem-grasshopper** (semantic): "leaping insect with powerful hind legs that stridulates" → expected Encyclopedia/G/Grasshopper.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/C/Coleoptera.md, Encyclopedia/H/Hexapoda.md, Encyclopedia/I/Insect.md, Sources/Lepidoptera.md, Encyclopedia/I/Insectivora.md
- **sem-lantern** (semantic): "case of transparent material protecting a light from rain and wind" → expected Reference/Lantern.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Notes/Japan.md, Sources/Europe.md, Sources/Cotton.md, Encyclopedia/A/Asia.md
- **sem-marble** (semantic): "limestone close enough in texture to admit of being polished" → expected Notes/Marble.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/Ethics.md, Sources/Horticulture.md, Encyclopedia/E/Edric.md, Encyclopedia/F/Fine Arts.md
- **sem-hare** (semantic): "well-known English rodent allied to the rabbit, with an Alpine mountain relative" → expected Notes/Hare.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Encyclopedia/I/Italy.md, Notes/Japan.md, Encyclopedia/C/Chile.md, Reference/India.md
- **sem-lacrosse** (semantic): "national ball game of Canada played with a curved netted stick" → expected 0 Inbox/Lacrosse.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Reference/Hydraulics.md, Notes/Canachus.md, Encyclopedia/D/Daille.md, Encyclopedia/B/Billiards.md
- **sem-haydn** (semantic): "Austrian composer of Croatian stock born at Rohrau" → expected Notes/Haydn.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Croatia-Slavonia.md, Notes/History.md, Sources/Europe.md, Reference/Australia.md, Encyclopedia/D/Dalmatia.md
- **sem-anvil** (semantic): "mass of iron on which material is supported while shaped under the hammer" → expected Reference/Anvil.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/Australia.md, Encyclopedia/M/Magnesite.md, 0 Inbox/Mecca.md, Sources/Europe.md
- **top-orchard-fruits** (topical): "fruits grown in gardens and orchards" → expected Reference/Apple.md, Sources/Gooseberry.md, Sources/Lemon.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Notes/Canachus.md, Encyclopedia/I/Italy.md, Sources/Europe.md, Sources/Guiana.md
- **top-english-poets** (topical): "lives of the English poets" → expected Encyclopedia/B/Byron.md, Notes/Chaucer.md, Encyclopedia/D/Dryden.md, 0 Inbox/Gray.md, Notes/Cowper.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/E/English Law.md, Encyclopedia/C/Celt.md, Notes/Japan.md, Encyclopedia/I/Iceland.md, Sources/Hindostani.md
- **top-british-philosophers** (topical): "British philosophers of the seventeenth and eighteenth centuries" → expected Encyclopedia/L/Locke.md, Reference/Berkeley.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/I/Ireland.md, Sources/Europe.md, Sources/Germanium.md, Reference/Astronomy.md, Encyclopedia/F/Folkes.md
- **top-great-rivers** (topical): "great rivers of the world" → expected Encyclopedia/E/Euphrates.md, Encyclopedia/G/Ganges.md, Encyclopedia/E/Elbe.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Europe.md, Reference/Australia.md, Notes/Canachus.md, Encyclopedia/G/Geography.md, Sources/Germanium.md
- **top-indoor-games** (topical): "indoor games of skill played on a table or board" → expected Encyclopedia/B/Billiards.md, Encyclopedia/D/Draughts.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/G/Games.md, Encyclopedia/I/Ireland.md, Encyclopedia/F/Fine Arts.md, Encyclopedia/D/Drama.md, Encyclopedia/H/Halma.md
- **top-sea-fishes** (topical): "fishes of the open sea" → expected Encyclopedia/C/Cod.md, Notes/Mackerel.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/India.md, Reference/Australia.md, Encyclopedia/I/Italy.md, Sources/Caspian Sea.md
- **top-light-sources** (topical): "devices for holding and carrying a light" → expected Encyclopedia/L/Lamp.md, Reference/Lantern.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Sources/Cotton.md, Reference/Hydraulics.md, Encyclopedia/E/Electric Eel.md, Sources/Dream.md

## Gate verdict

> **Pre-registered gate:** hybrid RRF must beat lexical-only by ≥10 points hit@5 on the semantic subset, regress ≤2 points on the exact-term subset, and warm end-to-end semantic query (embed + scan) p95 ≤ 15 ms at 10k notes. +5..+10 points = discuss zone. Model choice = smallest model passing.

### potion-base-8M — NO-SHIP

- semantic subset hit@5 +18.5 pts (gate ≥ +10): PASS
- lexical subset hit@5 0.0 pts (gate ≥ -2): PASS
- semantic warm p95 16.60 ms (gate ≤ 15 ms): FAIL

**Overall: NO-SHIP**
