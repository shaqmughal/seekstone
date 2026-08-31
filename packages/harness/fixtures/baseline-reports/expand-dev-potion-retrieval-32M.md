# Retrieval-quality eval (SHA-257 spike)

- **Snapshot:** 2026-08-31T03:38:06.836Z
- **Machine:** darwin/arm64, node v26.0.0, 10 cpus
- **Vault:** packages/harness/fixtures/vault (10000 notes)
- **Query set:** 90 queries (54 semantic, 18 lexical, 18 topical) [dev split only], 20 latency runs/query
- **Splits:** dev 90 (54/18/18), holdout 0 (0/0/0) — tuning reads dev only; gate v2 reports on holdout
- **Lexical index build:** 60360.00 ms
- **potion-retrieval-32M:** dim 512, 45964 chunks, index build 66817.26 ms, model load 115.49 ms

## Retrieval quality

| Condition | Subset | hit@5 | MRR@10 | n |
| --- | --- | ---: | ---: | ---: |
| lexical | overall | 37.8% | 0.282 | 90 |
| lexical | semantic | 24.1% | 0.122 | 54 |
| lexical | lexical | 100.0% | 0.972 | 18 |
| lexical | topical | 16.7% | 0.075 | 18 |
| semantic:potion-retrieval-32M | overall | 81.1% | 0.634 | 90 |
| semantic:potion-retrieval-32M | semantic | 81.5% | 0.608 | 54 |
| semantic:potion-retrieval-32M | lexical | 100.0% | 0.931 | 18 |
| semantic:potion-retrieval-32M | topical | 61.1% | 0.417 | 18 |
| hybrid-rrf:potion-retrieval-32M | overall | 54.4% | 0.397 | 90 |
| hybrid-rrf:potion-retrieval-32M | semantic | 46.3% | 0.303 | 54 |
| hybrid-rrf:potion-retrieval-32M | lexical | 100.0% | 0.944 | 18 |
| hybrid-rrf:potion-retrieval-32M | topical | 33.3% | 0.129 | 18 |
| semantic-top2:potion-retrieval-32M | overall | 74.4% | 0.610 | 90 |
| semantic-top2:potion-retrieval-32M | semantic | 68.5% | 0.542 | 54 |
| semantic-top2:potion-retrieval-32M | lexical | 94.4% | 0.951 | 18 |
| semantic-top2:potion-retrieval-32M | topical | 72.2% | 0.476 | 18 |
| hybrid-route:potion-retrieval-32M | overall | 81.1% | 0.648 | 90 |
| hybrid-route:potion-retrieval-32M | semantic | 81.5% | 0.608 | 54 |
| hybrid-route:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route:potion-retrieval-32M | topical | 61.1% | 0.417 | 18 |
| hybrid-route-top2:potion-retrieval-32M | overall | 75.6% | 0.620 | 90 |
| hybrid-route-top2:potion-retrieval-32M | semantic | 68.5% | 0.542 | 54 |
| hybrid-route-top2:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-top2:potion-retrieval-32M | topical | 72.2% | 0.476 | 18 |
| hybrid-wsum70:potion-retrieval-32M | overall | 82.2% | 0.586 | 90 |
| hybrid-wsum70:potion-retrieval-32M | semantic | 83.3% | 0.566 | 54 |
| hybrid-wsum70:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-wsum70:potion-retrieval-32M | topical | 61.1% | 0.261 | 18 |
| hybrid-wsum85:potion-retrieval-32M | overall | 81.1% | 0.624 | 90 |
| hybrid-wsum85:potion-retrieval-32M | semantic | 81.5% | 0.610 | 54 |
| hybrid-wsum85:potion-retrieval-32M | lexical | 100.0% | 0.935 | 18 |
| hybrid-wsum85:potion-retrieval-32M | topical | 61.1% | 0.354 | 18 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | overall | 82.2% | 0.651 | 90 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | semantic | 81.5% | 0.607 | 54 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | topical | 66.7% | 0.434 | 18 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | overall | 82.2% | 0.666 | 90 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | semantic | 81.5% | 0.652 | 54 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | topical | 66.7% | 0.402 | 18 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | overall | 77.8% | 0.617 | 90 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | semantic | 75.9% | 0.575 | 54 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | topical | 61.1% | 0.391 | 18 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | overall | 78.9% | 0.645 | 90 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | semantic | 77.8% | 0.603 | 54 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | topical | 61.1% | 0.416 | 18 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | overall | 81.1% | 0.639 | 90 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | semantic | 81.5% | 0.616 | 54 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | topical | 61.1% | 0.377 | 18 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | overall | 78.9% | 0.618 | 90 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | semantic | 77.8% | 0.579 | 54 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | lexical | 100.0% | 0.958 | 18 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | topical | 61.1% | 0.396 | 18 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | overall | 77.8% | 0.616 | 90 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | semantic | 75.9% | 0.551 | 54 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | lexical | 100.0% | 0.963 | 18 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | topical | 61.1% | 0.463 | 18 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | overall | 80.0% | 0.684 | 90 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | semantic | 87.0% | 0.755 | 54 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | lexical | 100.0% | 0.931 | 18 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | topical | 38.9% | 0.225 | 18 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | overall | 80.0% | 0.684 | 90 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | semantic | 87.0% | 0.755 | 54 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | lexical | 100.0% | 0.931 | 18 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | topical | 38.9% | 0.225 | 18 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | overall | 75.6% | 0.681 | 90 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | semantic | 83.3% | 0.761 | 54 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | lexical | 100.0% | 0.931 | 18 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | topical | 27.8% | 0.191 | 18 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | overall | 87.8% | 0.741 | 90 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | semantic | 90.7% | 0.758 | 54 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | topical | 66.7% | 0.431 | 18 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | overall | 86.7% | 0.771 | 90 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | semantic | 88.9% | 0.806 | 54 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | topical | 66.7% | 0.435 | 18 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | overall | 86.7% | 0.753 | 90 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | semantic | 90.7% | 0.778 | 54 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | topical | 61.1% | 0.431 | 18 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | overall | 83.3% | 0.759 | 90 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | semantic | 85.2% | 0.800 | 54 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | topical | 61.1% | 0.397 | 18 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | overall | 86.7% | 0.753 | 90 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | semantic | 90.7% | 0.778 | 54 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | topical | 61.1% | 0.431 | 18 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | overall | 86.7% | 0.753 | 90 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | semantic | 90.7% | 0.778 | 54 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | topical | 61.1% | 0.431 | 18 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | overall | 86.7% | 0.753 | 90 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | semantic | 90.7% | 0.778 | 54 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | topical | 61.1% | 0.431 | 18 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | overall | 86.7% | 0.753 | 90 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | semantic | 90.7% | 0.778 | 54 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | topical | 61.1% | 0.431 | 18 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | overall | 86.7% | 0.753 | 90 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | semantic | 90.7% | 0.778 | 54 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | topical | 61.1% | 0.431 | 18 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | overall | 86.7% | 0.753 | 90 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | semantic | 90.7% | 0.778 | 54 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | topical | 61.1% | 0.431 | 18 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | overall | 86.7% | 0.753 | 90 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | semantic | 90.7% | 0.778 | 54 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | topical | 61.1% | 0.431 | 18 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | overall | 86.7% | 0.753 | 90 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | semantic | 90.7% | 0.778 | 54 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | topical | 61.1% | 0.431 | 18 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | overall | 86.7% | 0.753 | 90 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | semantic | 90.7% | 0.778 | 54 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | topical | 61.1% | 0.431 | 18 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | overall | 85.6% | 0.700 | 90 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | semantic | 88.9% | 0.724 | 54 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | topical | 61.1% | 0.381 | 18 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | overall | 86.7% | 0.749 | 90 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | semantic | 90.7% | 0.775 | 54 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | topical | 61.1% | 0.421 | 18 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | overall | 85.6% | 0.700 | 90 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | semantic | 88.9% | 0.724 | 54 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | topical | 61.1% | 0.381 | 18 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | overall | 86.7% | 0.749 | 90 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | semantic | 90.7% | 0.775 | 54 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | topical | 61.1% | 0.421 | 18 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | overall | 85.6% | 0.700 | 90 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | semantic | 88.9% | 0.724 | 54 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | topical | 61.1% | 0.381 | 18 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | overall | 86.7% | 0.749 | 90 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | semantic | 90.7% | 0.775 | 54 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | topical | 61.1% | 0.421 | 18 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | overall | 85.6% | 0.700 | 90 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | semantic | 88.9% | 0.724 | 54 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | topical | 61.1% | 0.381 | 18 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | overall | 86.7% | 0.749 | 90 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | semantic | 90.7% | 0.775 | 54 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | topical | 61.1% | 0.421 | 18 |

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
| semantic:potion-retrieval-32M | dev | overall | 81.1% | 0.634 | 90 |
| semantic:potion-retrieval-32M | dev | semantic | 81.5% | 0.608 | 54 |
| semantic:potion-retrieval-32M | dev | lexical | 100.0% | 0.931 | 18 |
| semantic:potion-retrieval-32M | dev | topical | 61.1% | 0.417 | 18 |
| semantic:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| semantic:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| semantic:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| semantic:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-rrf:potion-retrieval-32M | dev | overall | 54.4% | 0.397 | 90 |
| hybrid-rrf:potion-retrieval-32M | dev | semantic | 46.3% | 0.303 | 54 |
| hybrid-rrf:potion-retrieval-32M | dev | lexical | 100.0% | 0.944 | 18 |
| hybrid-rrf:potion-retrieval-32M | dev | topical | 33.3% | 0.129 | 18 |
| hybrid-rrf:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-rrf:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-rrf:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-rrf:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| semantic-top2:potion-retrieval-32M | dev | overall | 74.4% | 0.610 | 90 |
| semantic-top2:potion-retrieval-32M | dev | semantic | 68.5% | 0.542 | 54 |
| semantic-top2:potion-retrieval-32M | dev | lexical | 94.4% | 0.951 | 18 |
| semantic-top2:potion-retrieval-32M | dev | topical | 72.2% | 0.476 | 18 |
| semantic-top2:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| semantic-top2:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| semantic-top2:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| semantic-top2:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route:potion-retrieval-32M | dev | overall | 81.1% | 0.648 | 90 |
| hybrid-route:potion-retrieval-32M | dev | semantic | 81.5% | 0.608 | 54 |
| hybrid-route:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route:potion-retrieval-32M | dev | topical | 61.1% | 0.417 | 18 |
| hybrid-route:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-top2:potion-retrieval-32M | dev | overall | 75.6% | 0.620 | 90 |
| hybrid-route-top2:potion-retrieval-32M | dev | semantic | 68.5% | 0.542 | 54 |
| hybrid-route-top2:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-top2:potion-retrieval-32M | dev | topical | 72.2% | 0.476 | 18 |
| hybrid-route-top2:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-top2:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-top2:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-top2:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-wsum70:potion-retrieval-32M | dev | overall | 82.2% | 0.586 | 90 |
| hybrid-wsum70:potion-retrieval-32M | dev | semantic | 83.3% | 0.566 | 54 |
| hybrid-wsum70:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-wsum70:potion-retrieval-32M | dev | topical | 61.1% | 0.261 | 18 |
| hybrid-wsum70:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-wsum70:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-wsum70:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-wsum70:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-wsum85:potion-retrieval-32M | dev | overall | 81.1% | 0.624 | 90 |
| hybrid-wsum85:potion-retrieval-32M | dev | semantic | 81.5% | 0.610 | 54 |
| hybrid-wsum85:potion-retrieval-32M | dev | lexical | 100.0% | 0.935 | 18 |
| hybrid-wsum85:potion-retrieval-32M | dev | topical | 61.1% | 0.354 | 18 |
| hybrid-wsum85:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-wsum85:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-wsum85:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-wsum85:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | dev | overall | 82.2% | 0.651 | 90 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | dev | semantic | 81.5% | 0.607 | 54 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | dev | topical | 66.7% | 0.434 | 18 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | dev | overall | 82.2% | 0.666 | 90 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | dev | semantic | 81.5% | 0.652 | 54 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | dev | topical | 66.7% | 0.402 | 18 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | dev | overall | 77.8% | 0.617 | 90 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | dev | semantic | 75.9% | 0.575 | 54 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | dev | topical | 61.1% | 0.391 | 18 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | dev | overall | 78.9% | 0.645 | 90 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | dev | semantic | 77.8% | 0.603 | 54 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | dev | topical | 61.1% | 0.416 | 18 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | dev | overall | 81.1% | 0.639 | 90 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | dev | semantic | 81.5% | 0.616 | 54 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | dev | lexical | 100.0% | 0.972 | 18 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | dev | topical | 61.1% | 0.377 | 18 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | dev | overall | 78.9% | 0.618 | 90 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | dev | semantic | 77.8% | 0.579 | 54 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | dev | lexical | 100.0% | 0.958 | 18 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | dev | topical | 61.1% | 0.396 | 18 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | dev | overall | 77.8% | 0.616 | 90 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | dev | semantic | 75.9% | 0.551 | 54 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | dev | lexical | 100.0% | 0.963 | 18 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | dev | topical | 61.1% | 0.463 | 18 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | dev | overall | 80.0% | 0.684 | 90 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | dev | semantic | 87.0% | 0.755 | 54 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | dev | lexical | 100.0% | 0.931 | 18 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | dev | topical | 38.9% | 0.225 | 18 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-sum:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | dev | overall | 80.0% | 0.684 | 90 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | dev | semantic | 87.0% | 0.755 | 54 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | dev | lexical | 100.0% | 0.931 | 18 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | dev | topical | 38.9% | 0.225 | 18 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | dev | overall | 75.6% | 0.681 | 90 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | dev | semantic | 83.3% | 0.761 | 54 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | dev | lexical | 100.0% | 0.931 | 18 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | dev | topical | 27.8% | 0.191 | 18 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | dev | overall | 87.8% | 0.741 | 90 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | dev | semantic | 90.7% | 0.758 | 54 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | dev | topical | 66.7% | 0.431 | 18 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | dev | overall | 86.7% | 0.771 | 90 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | dev | semantic | 88.9% | 0.806 | 54 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | dev | topical | 66.7% | 0.435 | 18 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | dev | overall | 86.7% | 0.753 | 90 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | dev | semantic | 90.7% | 0.778 | 54 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | dev | topical | 61.1% | 0.431 | 18 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | dev | overall | 83.3% | 0.759 | 90 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | dev | semantic | 85.2% | 0.800 | 54 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | dev | topical | 61.1% | 0.397 | 18 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | dev | overall | 86.7% | 0.753 | 90 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | dev | semantic | 90.7% | 0.778 | 54 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | dev | topical | 61.1% | 0.431 | 18 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | dev | overall | 86.7% | 0.753 | 90 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | dev | semantic | 90.7% | 0.778 | 54 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | dev | topical | 61.1% | 0.431 | 18 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | dev | overall | 86.7% | 0.753 | 90 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | dev | semantic | 90.7% | 0.778 | 54 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | dev | topical | 61.1% | 0.431 | 18 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | dev | overall | 86.7% | 0.753 | 90 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | dev | semantic | 90.7% | 0.778 | 54 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | dev | topical | 61.1% | 0.431 | 18 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | dev | overall | 86.7% | 0.753 | 90 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | dev | semantic | 90.7% | 0.778 | 54 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | dev | topical | 61.1% | 0.431 | 18 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | dev | overall | 86.7% | 0.753 | 90 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | dev | semantic | 90.7% | 0.778 | 54 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | dev | topical | 61.1% | 0.431 | 18 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | dev | overall | 86.7% | 0.753 | 90 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | dev | semantic | 90.7% | 0.778 | 54 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | dev | topical | 61.1% | 0.431 | 18 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | dev | overall | 86.7% | 0.753 | 90 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | dev | semantic | 90.7% | 0.778 | 54 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | dev | topical | 61.1% | 0.431 | 18 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | dev | overall | 86.7% | 0.753 | 90 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | dev | semantic | 90.7% | 0.778 | 54 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | dev | topical | 61.1% | 0.431 | 18 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | dev | overall | 85.6% | 0.700 | 90 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | dev | semantic | 88.9% | 0.724 | 54 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | dev | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | dev | topical | 61.1% | 0.381 | 18 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | dev | overall | 86.7% | 0.749 | 90 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | dev | semantic | 90.7% | 0.775 | 54 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | dev | topical | 61.1% | 0.421 | 18 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | dev | overall | 85.6% | 0.700 | 90 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | dev | semantic | 88.9% | 0.724 | 54 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | dev | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | dev | topical | 61.1% | 0.381 | 18 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | dev | overall | 86.7% | 0.749 | 90 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | dev | semantic | 90.7% | 0.775 | 54 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | dev | topical | 61.1% | 0.421 | 18 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | dev | overall | 85.6% | 0.700 | 90 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | dev | semantic | 88.9% | 0.724 | 54 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | dev | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | dev | topical | 61.1% | 0.381 | 18 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | dev | overall | 86.7% | 0.749 | 90 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | dev | semantic | 90.7% | 0.775 | 54 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | dev | topical | 61.1% | 0.421 | 18 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | dev | overall | 85.6% | 0.700 | 90 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | dev | semantic | 88.9% | 0.724 | 54 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | dev | lexical | 100.0% | 0.944 | 18 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | dev | topical | 61.1% | 0.381 | 18 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | dev | overall | 86.7% | 0.749 | 90 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | dev | semantic | 90.7% | 0.775 | 54 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | dev | lexical | 100.0% | 1.000 | 18 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | dev | topical | 61.1% | 0.421 | 18 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | holdout | overall | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | holdout | semantic | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | holdout | lexical | 0.0% | 0.000 | 0 |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | holdout | topical | 0.0% | 0.000 | 0 |

## Query latency (warm) & payload

| Condition | p50 | p90 | p95 | p99 | payload/query |
| --- | ---: | ---: | ---: | ---: | ---: |
| lexical | 60.11 ms | 280.84 ms | 307.43 ms | 486.19 ms | in-process |
| semantic:potion-retrieval-32M | 28.50 ms | 29.73 ms | 30.17 ms | 31.47 ms | in-process |
| hybrid-rrf:potion-retrieval-32M | 90.08 ms | 300.15 ms | 329.39 ms | 539.08 ms | in-process |
| semantic-top2:potion-retrieval-32M | 28.66 ms | 30.16 ms | 30.99 ms | 35.36 ms | in-process |
| hybrid-route:potion-retrieval-32M | 28.84 ms | 30.55 ms | 31.43 ms | 36.54 ms | in-process |
| hybrid-route-top2:potion-retrieval-32M | 28.61 ms | 31.35 ms | 33.31 ms | 46.87 ms | in-process |
| hybrid-wsum70:potion-retrieval-32M | 28.02 ms | 29.45 ms | 30.02 ms | 41.34 ms | in-process |
| hybrid-wsum85:potion-retrieval-32M | 28.81 ms | 32.25 ms | 33.87 ms | 41.24 ms | in-process |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | 28.52 ms | 30.49 ms | 31.49 ms | 39.12 ms | in-process |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | 29.02 ms | 30.69 ms | 31.28 ms | 38.55 ms | in-process |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | 28.71 ms | 31.58 ms | 33.03 ms | 36.32 ms | in-process |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | 29.26 ms | 31.39 ms | 32.26 ms | 54.21 ms | in-process |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | 29.65 ms | 33.45 ms | 35.07 ms | 46.60 ms | in-process |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | 29.89 ms | 32.52 ms | 34.30 ms | 48.29 ms | in-process |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | 29.54 ms | 32.56 ms | 34.05 ms | 44.11 ms | in-process |
| hybrid-route-maxsim-sum:potion-retrieval-32M | 49.03 ms | 60.46 ms | 64.50 ms | 80.55 ms | in-process |
| hybrid-route-maxsim-mean:potion-retrieval-32M | 48.21 ms | 56.85 ms | 60.78 ms | 65.94 ms | in-process |
| hybrid-route-maxsim-idf:potion-retrieval-32M | 50.06 ms | 61.06 ms | 64.49 ms | 70.22 ms | in-process |
| hybrid-route-maxsim-mean-b50:potion-retrieval-32M | 49.51 ms | 59.14 ms | 63.70 ms | 70.44 ms | in-process |
| hybrid-route-maxsim-mean-b70:potion-retrieval-32M | 49.42 ms | 59.30 ms | 63.52 ms | 71.77 ms | in-process |
| hybrid-route-maxsim-idf-b50:potion-retrieval-32M | 48.98 ms | 60.09 ms | 63.83 ms | 73.29 ms | in-process |
| hybrid-route-maxsim-idf-b70:potion-retrieval-32M | 49.03 ms | 58.30 ms | 61.97 ms | 65.13 ms | in-process |
| hybrid-route-xp-boost-d40c3g25:potion-retrieval-32M | 50.06 ms | 59.87 ms | 63.78 ms | 69.49 ms | in-process |
| hybrid-route-xp-boost-d40c3g35:potion-retrieval-32M | 51.93 ms | 63.73 ms | 67.63 ms | 76.79 ms | in-process |
| hybrid-route-xp-boost-d40c5g25:potion-retrieval-32M | 52.69 ms | 61.85 ms | 67.21 ms | 80.15 ms | in-process |
| hybrid-route-xp-boost-d40c5g35:potion-retrieval-32M | 51.72 ms | 60.76 ms | 65.16 ms | 69.20 ms | in-process |
| hybrid-route-xp-boost-d70c3g25:potion-retrieval-32M | 51.30 ms | 60.34 ms | 65.32 ms | 69.14 ms | in-process |
| hybrid-route-xp-boost-d70c3g35:potion-retrieval-32M | 51.21 ms | 60.42 ms | 64.91 ms | 68.19 ms | in-process |
| hybrid-route-xp-boost-d70c3g0:potion-retrieval-32M | 50.31 ms | 59.02 ms | 62.68 ms | 68.10 ms | in-process |
| hybrid-route-xp-boost-d70c5g25:potion-retrieval-32M | 50.55 ms | 59.55 ms | 63.80 ms | 67.83 ms | in-process |
| hybrid-route-xp-boost-d70c5g35:potion-retrieval-32M | 51.28 ms | 61.09 ms | 66.19 ms | 80.66 ms | in-process |
| hybrid-route-xp-rrf-d40c3g25:potion-retrieval-32M | 51.36 ms | 60.49 ms | 65.53 ms | 74.81 ms | in-process |
| hybrid-route-xp-rrf-d40c3g35:potion-retrieval-32M | 50.81 ms | 59.94 ms | 64.90 ms | 71.92 ms | in-process |
| hybrid-route-xp-rrf-d40c5g25:potion-retrieval-32M | 50.60 ms | 60.39 ms | 64.68 ms | 69.50 ms | in-process |
| hybrid-route-xp-rrf-d40c5g35:potion-retrieval-32M | 51.07 ms | 60.44 ms | 64.95 ms | 74.57 ms | in-process |
| hybrid-route-xp-rrf-d70c3g25:potion-retrieval-32M | 50.00 ms | 58.16 ms | 62.40 ms | 66.31 ms | in-process |
| hybrid-route-xp-rrf-d70c3g35:potion-retrieval-32M | 50.42 ms | 59.09 ms | 62.67 ms | 67.11 ms | in-process |
| hybrid-route-xp-rrf-d70c5g25:potion-retrieval-32M | 50.04 ms | 58.45 ms | 62.88 ms | 65.82 ms | in-process |
| hybrid-route-xp-rrf-d70c5g35:potion-retrieval-32M | 49.86 ms | 59.52 ms | 63.37 ms | 68.74 ms | in-process |

## Hybrid misses at 5 (error-analysis material)

- **sem-anemometer** (semantic): "instrument that measures the speed and pressure of wind" → expected Notes/Anemometer.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Hydraulics.md, Notes/Japan.md, Encyclopedia/H/Horn.md, Reference/Cloaca.md, Encyclopedia/L/Ligao.md
- **sem-anglesite** (semantic): "mineral composed of lead sulphate" → expected Encyclopedia/A/Anglesite.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Copper.md, Encyclopedia/I/Irnerius.md, Encyclopedia/C/Chemistry.md, Encyclopedia/C/Calcite.md, Encyclopedia/B/Barytes.md
- **sem-jaguar** (semantic): "largest wild cat found on the American continent" → expected Encyclopedia/J/Jaguar.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/India.md, Encyclopedia/F/Fur.md, Reference/Australia.md, 0 Inbox/Mammalia.md, Notes/Argentina.md
- **sem-dahlia** (semantic): "Mexican garden flower named after a pupil of Linnaeus" → expected Sources/Dahlia.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Notes/Japan.md, Sources/Cotton.md, 0 Inbox/Flower.md, Encyclopedia/I/Italy.md
- **sem-geyser** (semantic): "natural hot spring that periodically erupts a column of boiling water and steam" → expected Sources/Geyser.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Notes/Japan.md, Reference/Hydraulics.md, Reference/Australia.md, Encyclopedia/E/Electric Eel.md
- **sem-giraffe** (semantic): "the tallest living mammal, an African ruminant with a long neck" → expected Encyclopedia/G/Giraffe.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Australia.md, 0 Inbox/Mammalia.md, Encyclopedia/A/Asia.md, Reference/India.md, Sources/Evidence.md
- **sem-guillotine** (semantic): "beheading machine of the French Revolution" → expected Sources/Guillotine.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/F/French Revolution.md, Notes/French Revolutionary Wars.md, Sources/Europe.md, Notes/History.md, Encyclopedia/I/Italy.md
- **sem-hurricane** (semantic): "violent tropical wind storm of the West Indies" → expected Reference/Hurricane.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Reference/India.md, Sources/Europe.md, Reference/Hydraulics.md, Notes/Argentina.md
- **sem-comet** (semantic): "nebulous celestial body travelling a highly eccentric orbit around the sun" → expected Reference/Comet.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Astronomy.md, Sources/Hindostani.md, 0 Inbox/Mecca.md, Notes/Japan.md, Encyclopedia/L/Ligao.md
- **sem-fog** (semantic): "suspended particles near the ground that make surrounding objects invisible" → expected Reference/Fog.md
  - hybrid-rrf:potion-retrieval-32M top 5: 0 Inbox/Mecca.md, Encyclopedia/L/Ligao.md, Reference/Astronomy.md, Encyclopedia/M/Magnesite.md, Encyclopedia/E/Electric Eel.md
- **sem-llama** (semantic): "domesticated South American pack animal of the camel family" → expected Notes/Llama.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Australia.md, Reference/India.md, Sources/Family.md, Encyclopedia/I/Indo-China.md, Encyclopedia/C/Civilis.md
- **sem-darwin** (semantic): "Victorian naturalist who developed the theory of evolution by natural selection" → expected Sources/Darwin.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Evidence.md, Reference/Ethics.md, Encyclopedia/E/Embrun.md, Encyclopedia/F/Fine Arts.md, Sources/Aristotle.md
- **sem-faraday** (semantic): "English scientist famous for discoveries in electromagnetism and electrochemistry" → expected Reference/Faraday.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/E/Electric Eel.md, Encyclopedia/C/Chemistry.md, Encyclopedia/M/Magnesite.md, Notes/Japan.md, Encyclopedia/I/Italy.md
- **sem-machiavelli** (semantic): "Florentine political theorist whose name became a byword for cunning statecraft" → expected Encyclopedia/M/Machiavelli.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/I/Italy.md, Encyclopedia/E/English Law.md, Sources/Europe.md, Encyclopedia/F/Florence.md, Sources/Aristotle.md
- **top-birds-of-prey** (topical): "birds of prey" → expected Reference/Eagle.md, Encyclopedia/H/Hawk.md, Encyclopedia/K/Kite.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/India.md, Notes/Humming-Bird.md, Encyclopedia/F/Frigate-Bird.md, Reference/Australia.md, Encyclopedia/K/Kestrel.md
- **top-green-gemstones** (topical): "green gemstones" → expected Encyclopedia/E/Emerald.md, Notes/Jade.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Green Bay.md, Notes/Green Ribbon Club.md, Encyclopedia/B/Bowling Green.md, Notes/Greenockite.md, Reference/Greensand.md
- **top-weather** (topical): "violent weather phenomena" → expected Reference/Hurricane.md, Encyclopedia/H/Hail.md, Reference/Fog.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Encyclopedia/C/Chile.md, Reference/India.md, Encyclopedia/B/Breaking Bulk.md, Reference/Australia.md
- **top-instruments** (topical): "musical instruments" → expected Reference/Flute.md, Sources/Drum.md
  - hybrid-rrf:potion-retrieval-32M top 5: 0 Inbox/Instrument.md, Encyclopedia/G/Guitar.md, Encyclopedia/H/Horn.md, Reference/Keyboard.md, Reference/Bombardon.md
- **top-composers** (topical): "great German composers" → expected Sources/Beethoven.md, Encyclopedia/H/Handel.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Germanium.md, Notes/History.md, Reference/Bastian.md, Sources/Hymettus.md, Encyclopedia/C/Chorale.md
- **top-dairy** (topical): "foods made from milk" → expected Encyclopedia/C/Cheese.md, Encyclopedia/B/Butter.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/D/Daille.md, Reference/Cattle.md, Notes/Dietetics.md, Notes/Canachus.md, Reference/India.md
- **sem-astrolabe** (semantic): "ancient instrument for taking the altitude of stars, sun and moon" → expected Encyclopedia/A/Astrolabe.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Astronomy.md, Sources/Hindostani.md, Notes/Japan.md, Sources/Aristotle.md, Encyclopedia/L/Ligao.md
- **sem-brick** (semantic): "artificial stone of burnt clay used as a building material" → expected Encyclopedia/B/Brick.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Encyclopedia/B/Babylon.md, Encyclopedia/F/Fine Arts.md, Encyclopedia/I/Ireland.md, 0 Inbox/Mecca.md
- **sem-mars** (semantic): "the reddish fourth planet in order of distance from the sun" → expected Reference/Mars.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Astronomy.md, Sources/Aristotle.md, Sources/Hindostani.md, Encyclopedia/L/Ligao.md, Sources/Map.md
- **sem-carnival** (semantic): "days of feasting and merrymaking before Lent" → expected Notes/Carnival.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Lent.md, Encyclopedia/F/Fasting.md, Encyclopedia/E/Eucharist.md, 0 Inbox/Mecca.md, Encyclopedia/C/Crusades.md
- **sem-clover** (semantic): "plant of the pea family named for its three leaflets" → expected Sources/Clover.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Sources/Cotton.md, Encyclopedia/L/Leaf.md, Encyclopedia/I/Italy.md, 0 Inbox/Flower.md
- **sem-crown-coin** (semantic): "English silver coin of the value of five shillings" → expected Reference/Crown.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Reference/India.md, Encyclopedia/C/Coin.md, Notes/Canachus.md, Notes/History.md
- **sem-equator** (semantic): "great circle equidistant from the two poles dividing the hemispheres" → expected Encyclopedia/E/Equator.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Map.md, 0 Inbox/Mecca.md, Reference/Astronomy.md, Reference/Geodesy.md, Encyclopedia/M/Magnesite.md
- **sem-flag** (semantic): "piece of bunting waved from a staff as a standard, ensign or signal" → expected Encyclopedia/F/Flag.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Hydraulics.md, 0 Inbox/Mecca.md, Encyclopedia/K/Knight.md, Sources/Cotton.md, Reference/Astronomy.md
- **sem-grasshopper** (semantic): "leaping insect with powerful hind legs that stridulates" → expected Encyclopedia/G/Grasshopper.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/C/Coleoptera.md, Encyclopedia/H/Hexapoda.md, Encyclopedia/I/Insect.md, Encyclopedia/E/Entomology.md, Encyclopedia/B/Bee.md
- **sem-lantern** (semantic): "case of transparent material protecting a light from rain and wind" → expected Reference/Lantern.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Sources/Horticulture.md, Sources/Europe.md, Reference/India.md, Encyclopedia/E/Electric Eel.md
- **sem-marble** (semantic): "limestone close enough in texture to admit of being polished" → expected Notes/Marble.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/I/Ireland.md, Encyclopedia/M/Magnesite.md, Sources/Horticulture.md, Encyclopedia/L/Limestone.md, Notes/Japan.md
- **sem-hare** (semantic): "well-known English rodent allied to the rabbit, with an Alpine mountain relative" → expected Notes/Hare.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Australia.md, Encyclopedia/I/Italy.md, Notes/Canachus.md, Notes/Japan.md, 0 Inbox/Mammalia.md
- **sem-lacrosse** (semantic): "national ball game of Canada played with a curved netted stick" → expected 0 Inbox/Lacrosse.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Reference/Hydraulics.md, 0 Inbox/Mecca.md, Reference/Australia.md, Notes/Canachus.md
- **sem-edison** (semantic): "American inventor who began as a railway news-boy experimenting in chemistry" → expected Encyclopedia/E/Edison.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/C/Chemistry.md, Sources/Cotton.md, Encyclopedia/E/Electric Eel.md, Encyclopedia/M/Magnesite.md, Encyclopedia/D/Deadwood.md
- **sem-anvil** (semantic): "mass of iron on which material is supported while shaped under the hammer" → expected Reference/Anvil.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Encyclopedia/M/Magnesite.md, Reference/Australia.md, Encyclopedia/I/Italy.md, Reference/Cloaca.md
- **top-orchard-fruits** (topical): "fruits grown in gardens and orchards" → expected Reference/Apple.md, Sources/Gooseberry.md, Sources/Lemon.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Notes/Canachus.md, Encyclopedia/I/Italy.md, Reference/India.md, Notes/Japan.md
- **top-english-poets** (topical): "lives of the English poets" → expected Encyclopedia/B/Byron.md, Notes/Chaucer.md, Encyclopedia/D/Dryden.md, 0 Inbox/Gray.md, Notes/Cowper.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/C/Celt.md, Encyclopedia/E/English Law.md, Encyclopedia/D/Drama.md, Notes/Japan.md, Sources/Arnold.md
- **top-british-philosophers** (topical): "British philosophers of the seventeenth and eighteenth centuries" → expected Encyclopedia/L/Locke.md, Reference/Berkeley.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Aristotle.md, Reference/Ethics.md, Encyclopedia/E/English Law.md, Sources/Germanium.md, Encyclopedia/E/Edric.md
- **top-great-rivers** (topical): "great rivers of the world" → expected Encyclopedia/E/Euphrates.md, Encyclopedia/G/Ganges.md, Encyclopedia/E/Elbe.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Europe.md, Notes/Japan.md, Reference/Australia.md, Reference/India.md, Reference/Hydraulics.md
- **top-sea-fishes** (topical): "fishes of the open sea" → expected Encyclopedia/C/Cod.md, Notes/Mackerel.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Reference/India.md, Encyclopedia/I/Ireland.md, Reference/Australia.md, Sources/Caspian Sea.md
- **top-light-sources** (topical): "devices for holding and carrying a light" → expected Encyclopedia/L/Lamp.md, Reference/Lantern.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Encyclopedia/L/Ligao.md, Encyclopedia/E/Electric Eel.md, Reference/Astronomy.md, Encyclopedia/F/Fine Arts.md

## Gate verdict

> **Pre-registered gate:** hybrid RRF must beat lexical-only by ≥10 points hit@5 on the semantic subset, regress ≤2 points on the exact-term subset, and warm end-to-end semantic query (embed + scan) p95 ≤ 15 ms at 10k notes. +5..+10 points = discuss zone. Model choice = smallest model passing.

### potion-retrieval-32M — NO-SHIP

- semantic subset hit@5 +22.2 pts (gate ≥ +10): PASS
- lexical subset hit@5 0.0 pts (gate ≥ -2): PASS
- semantic warm p95 30.17 ms (gate ≤ 15 ms): FAIL

**Overall: NO-SHIP**
