# Retrieval-quality eval (SHA-257 spike)

- **Snapshot:** 2026-08-30T18:14:28.489Z
- **Machine:** darwin/arm64, node v25.9.0, 16 cpus
- **Vault:** packages/harness/fixtures/vault (10000 notes)
- **Query set:** 90 queries (54 semantic, 18 lexical, 18 topical) [dev split only], 10 latency runs/query
- **Splits:** dev 90 (54/18/18), holdout 0 (0/0/0) — tuning reads dev only; gate v2 reports on holdout
- **Lexical index build:** 41402.00 ms
- **potion-retrieval-32M:** dim 512, 45964 chunks, index build 24646.30 ms, model load 71.19 ms
- **potion-base-8M:** dim 256, 45964 chunks, index build 27044.14 ms, model load 20.79 ms

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
| semantic:potion-base-8M | overall | 68.9% | 0.531 | 90 |
| semantic:potion-base-8M | semantic | 70.4% | 0.542 | 54 |
| semantic:potion-base-8M | lexical | 83.3% | 0.727 | 18 |
| semantic:potion-base-8M | topical | 50.0% | 0.305 | 18 |
| hybrid-rrf:potion-base-8M | overall | 50.0% | 0.388 | 90 |
| hybrid-rrf:potion-base-8M | semantic | 42.6% | 0.286 | 54 |
| hybrid-rrf:potion-base-8M | lexical | 100.0% | 0.972 | 18 |
| hybrid-rrf:potion-base-8M | topical | 22.2% | 0.110 | 18 |

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

## Query latency (warm) & payload

| Condition | p50 | p90 | p95 | p99 | payload/query |
| --- | ---: | ---: | ---: | ---: | ---: |
| lexical | 44.97 ms | 199.14 ms | 220.63 ms | 332.14 ms | in-process |
| semantic:potion-retrieval-32M | 22.30 ms | 23.41 ms | 23.70 ms | 24.48 ms | in-process |
| hybrid-rrf:potion-retrieval-32M | 69.90 ms | 230.65 ms | 254.57 ms | 413.16 ms | in-process |
| semantic-top2:potion-retrieval-32M | 22.37 ms | 23.45 ms | 23.73 ms | 24.85 ms | in-process |
| hybrid-route:potion-retrieval-32M | 22.29 ms | 22.86 ms | 23.34 ms | 23.71 ms | in-process |
| hybrid-route-top2:potion-retrieval-32M | 22.33 ms | 23.00 ms | 23.39 ms | 23.84 ms | in-process |
| hybrid-wsum70:potion-retrieval-32M | 22.35 ms | 23.69 ms | 24.08 ms | 24.97 ms | in-process |
| hybrid-wsum85:potion-retrieval-32M | 22.37 ms | 23.57 ms | 23.91 ms | 24.65 ms | in-process |
| hybrid-route-logdiscount-l0.01:potion-retrieval-32M | 22.42 ms | 24.24 ms | 24.76 ms | 25.77 ms | in-process |
| hybrid-route-logdiscount-l0.02:potion-retrieval-32M | 22.41 ms | 23.09 ms | 23.67 ms | 24.35 ms | in-process |
| hybrid-route-logdiscount-l0.04:potion-retrieval-32M | 22.41 ms | 23.67 ms | 23.96 ms | 25.02 ms | in-process |
| hybrid-route-softmax-t0.02:potion-retrieval-32M | 23.15 ms | 24.32 ms | 24.54 ms | 25.54 ms | in-process |
| hybrid-route-softmax-t0.05:potion-retrieval-32M | 23.16 ms | 24.56 ms | 25.12 ms | 26.37 ms | in-process |
| hybrid-route-softmax-t0.1:potion-retrieval-32M | 22.97 ms | 24.19 ms | 24.42 ms | 25.23 ms | in-process |
| hybrid-route-softmax-t0.2:potion-retrieval-32M | 22.99 ms | 24.33 ms | 24.65 ms | 25.52 ms | in-process |
| semantic:potion-base-8M | 12.93 ms | 13.57 ms | 13.83 ms | 14.87 ms | in-process |
| hybrid-rrf:potion-base-8M | 60.05 ms | 215.51 ms | 242.44 ms | 354.25 ms | in-process |

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
- **sem-brick** (semantic): "artificial stone of burnt clay used as a building material" → expected Encyclopedia/B/Brick.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Encyclopedia/B/Babylon.md, Encyclopedia/F/Fine Arts.md, Encyclopedia/I/Ireland.md, 0 Inbox/Mecca.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Encyclopedia/F/Fine Arts.md, Encyclopedia/B/Babylon.md, Encyclopedia/M/Magnesite.md, Encyclopedia/F/Fire Brat.md
- **sem-mars** (semantic): "the reddish fourth planet in order of distance from the sun" → expected Reference/Mars.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Astronomy.md, Sources/Aristotle.md, Sources/Hindostani.md, Encyclopedia/L/Ligao.md, Sources/Map.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Astronomy.md, Notes/Japan.md, Sources/Europe.md, Encyclopedia/L/Ligao.md, Sources/Map.md
- **sem-carnival** (semantic): "days of feasting and merrymaking before Lent" → expected Notes/Carnival.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Lent.md, Encyclopedia/F/Fasting.md, Encyclopedia/E/Eucharist.md, 0 Inbox/Mecca.md, Encyclopedia/C/Crusades.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Lent.md, Encyclopedia/F/Fasting.md, Encyclopedia/E/Eucharist.md, Encyclopedia/M/Madagascar.md, Encyclopedia/D/Daille.md
- **sem-clover** (semantic): "plant of the pea family named for its three leaflets" → expected Sources/Clover.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Sources/Cotton.md, Encyclopedia/L/Leaf.md, Encyclopedia/I/Italy.md, 0 Inbox/Flower.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Encyclopedia/I/Italy.md, Reference/Australia.md, Encyclopedia/L/Leaf.md, Sources/Cotton.md
- **sem-crown-coin** (semantic): "English silver coin of the value of five shillings" → expected Reference/Crown.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Reference/India.md, Encyclopedia/C/Coin.md, Notes/Canachus.md, Notes/History.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Encyclopedia/E/Exchange.md, Reference/India.md, Notes/History.md, Encyclopedia/C/Coin.md
- **sem-equator** (semantic): "great circle equidistant from the two poles dividing the hemispheres" → expected Encyclopedia/E/Equator.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Map.md, 0 Inbox/Mecca.md, Reference/Astronomy.md, Reference/Geodesy.md, Encyclopedia/M/Magnesite.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Map.md, Reference/Astronomy.md, 0 Inbox/Mecca.md, Encyclopedia/M/Magnesite.md, Encyclopedia/E/Electrokinetics.md
- **sem-flag** (semantic): "piece of bunting waved from a staff as a standard, ensign or signal" → expected Encyclopedia/F/Flag.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Hydraulics.md, 0 Inbox/Mecca.md, Encyclopedia/K/Knight.md, Sources/Cotton.md, Reference/Astronomy.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Notes/Japan.md, Reference/Astronomy.md, Reference/Hydraulics.md, Encyclopedia/L/Ligao.md
- **sem-grasshopper** (semantic): "leaping insect with powerful hind legs that stridulates" → expected Encyclopedia/G/Grasshopper.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/C/Coleoptera.md, Encyclopedia/H/Hexapoda.md, Encyclopedia/I/Insect.md, Encyclopedia/E/Entomology.md, Encyclopedia/B/Bee.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/C/Coleoptera.md, Encyclopedia/H/Hexapoda.md, Encyclopedia/I/Insect.md, Sources/Lepidoptera.md, Encyclopedia/I/Insectivora.md
- **sem-lantern** (semantic): "case of transparent material protecting a light from rain and wind" → expected Reference/Lantern.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Sources/Horticulture.md, Sources/Europe.md, Reference/India.md, Encyclopedia/E/Electric Eel.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Notes/Japan.md, Sources/Europe.md, Sources/Cotton.md, Encyclopedia/A/Asia.md
- **sem-marble** (semantic): "limestone close enough in texture to admit of being polished" → expected Notes/Marble.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/I/Ireland.md, Encyclopedia/M/Magnesite.md, Sources/Horticulture.md, Encyclopedia/L/Limestone.md, Notes/Japan.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/Ethics.md, Sources/Horticulture.md, Encyclopedia/E/Edric.md, Encyclopedia/F/Fine Arts.md
- **sem-hare** (semantic): "well-known English rodent allied to the rabbit, with an Alpine mountain relative" → expected Notes/Hare.md
  - hybrid-rrf:potion-retrieval-32M top 5: Reference/Australia.md, Encyclopedia/I/Italy.md, Notes/Canachus.md, Notes/Japan.md, 0 Inbox/Mammalia.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Australia.md, Encyclopedia/I/Italy.md, Notes/Japan.md, Encyclopedia/C/Chile.md, Reference/India.md
- **sem-lacrosse** (semantic): "national ball game of Canada played with a curved netted stick" → expected 0 Inbox/Lacrosse.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Reference/Hydraulics.md, 0 Inbox/Mecca.md, Reference/Australia.md, Notes/Canachus.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Reference/Hydraulics.md, Notes/Canachus.md, Encyclopedia/D/Daille.md, Encyclopedia/B/Billiards.md
- **sem-haydn** (semantic): "Austrian composer of Croatian stock born at Rohrau" → expected Notes/Haydn.md
  - hybrid-rrf:potion-base-8M top 5: Reference/Croatia-Slavonia.md, Notes/History.md, Sources/Europe.md, Reference/Australia.md, Encyclopedia/D/Dalmatia.md
- **sem-edison** (semantic): "American inventor who began as a railway news-boy experimenting in chemistry" → expected Encyclopedia/E/Edison.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/C/Chemistry.md, Sources/Cotton.md, Encyclopedia/E/Electric Eel.md, Encyclopedia/M/Magnesite.md, Encyclopedia/D/Deadwood.md
- **sem-anvil** (semantic): "mass of iron on which material is supported while shaped under the hammer" → expected Reference/Anvil.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Encyclopedia/M/Magnesite.md, Reference/Australia.md, Encyclopedia/I/Italy.md, Reference/Cloaca.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/Australia.md, Encyclopedia/M/Magnesite.md, 0 Inbox/Mecca.md, Sources/Europe.md
- **top-orchard-fruits** (topical): "fruits grown in gardens and orchards" → expected Reference/Apple.md, Sources/Gooseberry.md, Sources/Lemon.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Notes/Canachus.md, Encyclopedia/I/Italy.md, Reference/India.md, Notes/Japan.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Horticulture.md, Notes/Canachus.md, Encyclopedia/I/Italy.md, Sources/Europe.md, Sources/Guiana.md
- **top-english-poets** (topical): "lives of the English poets" → expected Encyclopedia/B/Byron.md, Notes/Chaucer.md, Encyclopedia/D/Dryden.md, 0 Inbox/Gray.md, Notes/Cowper.md
  - hybrid-rrf:potion-retrieval-32M top 5: Encyclopedia/C/Celt.md, Encyclopedia/E/English Law.md, Encyclopedia/D/Drama.md, Notes/Japan.md, Sources/Arnold.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/E/English Law.md, Encyclopedia/C/Celt.md, Notes/Japan.md, Encyclopedia/I/Iceland.md, Sources/Hindostani.md
- **top-british-philosophers** (topical): "British philosophers of the seventeenth and eighteenth centuries" → expected Encyclopedia/L/Locke.md, Reference/Berkeley.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Aristotle.md, Reference/Ethics.md, Encyclopedia/E/English Law.md, Sources/Germanium.md, Encyclopedia/E/Edric.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/I/Ireland.md, Sources/Europe.md, Sources/Germanium.md, Reference/Astronomy.md, Encyclopedia/F/Folkes.md
- **top-great-rivers** (topical): "great rivers of the world" → expected Encyclopedia/E/Euphrates.md, Encyclopedia/G/Ganges.md, Encyclopedia/E/Elbe.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Europe.md, Notes/Japan.md, Reference/Australia.md, Reference/India.md, Reference/Hydraulics.md
  - hybrid-rrf:potion-base-8M top 5: Sources/Europe.md, Reference/Australia.md, Notes/Canachus.md, Encyclopedia/G/Geography.md, Sources/Germanium.md
- **top-indoor-games** (topical): "indoor games of skill played on a table or board" → expected Encyclopedia/B/Billiards.md, Encyclopedia/D/Draughts.md
  - hybrid-rrf:potion-base-8M top 5: Encyclopedia/G/Games.md, Encyclopedia/I/Ireland.md, Encyclopedia/F/Fine Arts.md, Encyclopedia/D/Drama.md, Encyclopedia/H/Halma.md
- **top-sea-fishes** (topical): "fishes of the open sea" → expected Encyclopedia/C/Cod.md, Notes/Mackerel.md
  - hybrid-rrf:potion-retrieval-32M top 5: Notes/Japan.md, Reference/India.md, Encyclopedia/I/Ireland.md, Reference/Australia.md, Sources/Caspian Sea.md
  - hybrid-rrf:potion-base-8M top 5: Notes/Japan.md, Reference/India.md, Reference/Australia.md, Encyclopedia/I/Italy.md, Sources/Caspian Sea.md
- **top-light-sources** (topical): "devices for holding and carrying a light" → expected Encyclopedia/L/Lamp.md, Reference/Lantern.md
  - hybrid-rrf:potion-retrieval-32M top 5: Sources/Horticulture.md, Encyclopedia/L/Ligao.md, Encyclopedia/E/Electric Eel.md, Reference/Astronomy.md, Encyclopedia/F/Fine Arts.md
  - hybrid-rrf:potion-base-8M top 5: 0 Inbox/Mecca.md, Sources/Cotton.md, Reference/Hydraulics.md, Encyclopedia/E/Electric Eel.md, Sources/Dream.md

## Gate verdict

> **Pre-registered gate:** hybrid RRF must beat lexical-only by ≥10 points hit@5 on the semantic subset, regress ≤2 points on the exact-term subset, and warm end-to-end semantic query (embed + scan) p95 ≤ 15 ms at 10k notes. +5..+10 points = discuss zone. Model choice = smallest model passing.

### potion-retrieval-32M — NO-SHIP

- semantic subset hit@5 +22.2 pts (gate ≥ +10): PASS
- lexical subset hit@5 0.0 pts (gate ≥ -2): PASS
- semantic warm p95 23.70 ms (gate ≤ 15 ms): FAIL

### potion-base-8M — SHIP

- semantic subset hit@5 +18.5 pts (gate ≥ +10): PASS
- lexical subset hit@5 0.0 pts (gate ≥ -2): PASS
- semantic warm p95 13.83 ms (gate ≤ 15 ms): PASS

**Overall: SHIP** — chosen model: potion-base-8M
