# Firebase Environment Governance

This document defines the minimum environment governance for AgroConnect.

## 1. Required Firebase aliases

Configured in `.firebaserc`:

- `dev`
- `staging`
- `prod`

Current placeholders must be replaced before first staging/prod deploy:

- `REPLACE_WITH_STAGING_PROJECT_ID`
- `REPLACE_WITH_PROD_PROJECT_ID`

## 2. Secrets policy

- Never commit `.env` or `.env.*` files.
- Use `.env.example` or `.env.local.example` as templates only.
- For Cloud Functions, use Firebase Secrets (`firebase functions:secrets:set`).

## 3. Deployment policy

- `dev`: branch `codex/*`
- `staging`: branch `release/*`
- `prod`: branch `main` only

## 4. Safe deploy commands

```powershell
# Select target project by alias
firebase use dev
firebase use staging
firebase use prod

# Deploy hosting to selected alias
firebase deploy --only hosting

# Deploy functions to selected alias
firebase deploy --only functions
```

## 5. Release gates before deploy

1. `npm install` or `npm ci` succeeds.
2. `npm run build` succeeds.
3. Functions lint/build succeeds in `functions/`.
4. No plaintext secret in git diff.
5. Target alias is confirmed explicitly.