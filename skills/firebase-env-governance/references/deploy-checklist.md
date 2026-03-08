# Deploy Checklist

1. Confirm current branch and target environment.
2. Confirm CI checks green (lint, test, build).
3. Confirm no plaintext secrets in staged changes.
4. Confirm Firebase alias selected matches intended environment.
5. Run deploy command.
6. Verify health checks after deploy.
7. Document rollback path and result.