---
'seekstone': minor
---

Semantic and hybrid search now rerank the top-50 candidates with a static late-interaction MaxSim stage: per query token, the max cosine over the winning chunk's token vectors (IDF-weighted over the candidate set) is fused with the stage-1 score. Recovers discriminating terms that mean-pooling dilutes — dev-split semantic hit@5 70.4% → 85.2% with lexical routing untouched, no new dependencies, and no embedding-cache format change. Core gains `maxsimScore`/`maxsimScoreAll`/`maxsimScoreTokens`, `candidateSetIdf`, and per-token vector access (`TokenEmbedder`) on the Model2Vec loader.
