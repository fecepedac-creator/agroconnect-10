# Pipeline Baseline

Required jobs:
1. install
2. lint
3. test
4. build
5. deploy (conditional)

Rules:
- deploy only after all required jobs succeed
- fail fast on lint/build errors