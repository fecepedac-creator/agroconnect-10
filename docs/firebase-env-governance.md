# Firebase Environment Governance

This document defines the minimum environment governance for AgroConnect.

## 1. Required Firebase aliases

Configured in `.firebaserc`:

- `dev`
- `staging`
- `prod`

The repository intentionally keeps placeholders for external staging/prod IDs. CI
receives the real IDs through GitHub secrets and never invents or commits them:

- `REPLACE_WITH_STAGING_PROJECT_ID`
- `REPLACE_WITH_PROD_PROJECT_ID`

## 2. Secrets policy

- Never commit `.env` or `.env.*` files.
- Use `.env.example` or `.env.local.example` as templates only.
- For Cloud Functions, use Firebase Secrets (`firebase functions:secrets:set`).
- Store project IDs as `FIREBASE_PROJECT_ID_DEV`,
  `FIREBASE_PROJECT_ID_STAGING` and `FIREBASE_PROJECT_ID_PROD`.
- Store the service account as `FIREBASE_SERVICE_ACCOUNT` in each protected
  GitHub Environment. The legacy secret name remains accepted during migration.
- A Google/Firebase web API key is configuration, but it is still scanned as a
  credential so accidental historical exposure is reviewed and rotated.

## 3. Deployment policy

- `dev`: manual deployment only
- `staging`: branch `release/*`
- `prod`: protected manual deployment, or `main` when that branch exists

The current default branch `fix/restore-agroconnect` is not mapped implicitly to
production. GitHub Environment approvals are required independently of branch
selection.

## 4. Safe deploy commands

```powershell
# Always pass the externally managed project ID; never rely on firebase use.
firebase deploy --only hosting --project <explicit-project-id>
firebase deploy --only functions --project <explicit-project-id>
```

The validated workflow deploys Hosting, Functions and Firestore rules/indexes as
one release. Storage and Realtime Database rules are deny-all today, but have no
dedicated rule tests. They are included only when the manual
`deploy_auxiliary_rules` input is true or the protected environment variable
`DEPLOY_AUXILIARY_RULES` is exactly `true`.

## 5. Release gates before deploy

1. `npm ci`, lint, builds, Firestore tests and isolated E2E succeed.
2. `npm audit --omit=dev --audit-level=high` succeeds for root and Functions.
3. `ops/security-scan.ps1` finds no credential pattern in HEAD or Git history.
4. `npm run check:firebase-envs` validates the selected external project ID.
5. The target project is passed explicitly to every Firebase CLI deployment.
6. The workflow uploads `deployment-manifest.json`, `dist` and compiled Functions
   with commit SHA, run ID, actor, environment, project and deploy targets.

Any historical match blocks release until the credential is rotated and the
repository history is remediated. Scanner output is limited to commit and path;
matching secret text is never printed.

The currently tracked `functions/.env.demo-mundoconnect` is also a release
blocker because it contains non-empty sensitive assignments. Rotate applicable
credentials, remove the file from tracking and remediate its history before
enabling deployment; `.gitignore` prevents future `functions/.env.*` additions.
