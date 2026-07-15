# AgroConnect platform v1 runbook

## Release gates

Production is blocked until all conditions are true:

- Firebase dev, staging and prod use different project IDs.
- The frontend Firebase web configuration is defined in each GitHub Environment.
- CI passes frontend build, Functions build/tests/lint and Firestore Rules tests.
- A Firestore export has completed in the target project.
- The release commit is tagged and its rollback command is recorded.
- Staging smoke tests pass with non-production accounts.

## Safe migration

The migration is additive. It creates company memberships and privacy-safe worker
discovery profiles. It does not delete legacy documents.

Dry-run:

    node scripts/migrate-platform-v1.mjs --project=CONFIRMED_STAGING_PROJECT

Apply only after reviewing the summary:

    node scripts/migrate-platform-v1.mjs --project=CONFIRMED_STAGING_PROJECT --apply

Run it in staging first. The script is idempotent and does not print worker or
administrator personal data.

## Smoke test

1. Sign in as a worker with Google.
2. Complete the profile and confirm discoverableWorkers has no email, phone,
   RUT or exact coordinates.
3. Sign in as a company member.
4. Publish an active job and invite a worker.
5. Accept the invitation as the worker.
6. Confirm contact is hidden before the match and available after mutual interest.
7. Mark the match as hired.
8. Submit one review from each side and confirm double-blind reveal.
9. Record a manual invoice as SuperAdmin and verify the audit event.
10. Confirm direct browser writes to billing, matches, reviews and credentials
    are denied.

## Rollback

Code rollback uses the last known-good tag from a separate worktree. Data
rollback is a separate decision and must not run automatically.

    git worktree add ../agroconnect-rollback LAST_KNOWN_GOOD_TAG
    Set-Location ../agroconnect-rollback
    npm ci
    npm --prefix functions ci
    npm run test:rules
    npm run build
    npm --prefix functions test

Deploy only the affected component and always pass an explicit confirmed project
ID. Never use the implicit active Firebase project for rollback.

## Known external prerequisites

- Create or confirm dedicated staging and production Firebase projects.
- Enable Google Authentication in each project.
- Configure authorized domains.
- Configure GitHub Environments staging and production.
- Add environment-specific Firebase project IDs, web configuration and
  SUPERADMIN_EMAILS.
- Create a protected Cloud Storage bucket for Firestore exports.
- Select and configure the Chilean payment provider before enabling automatic
  subscription charges.
- Phone/SMS authentication remains a later integration because it requires
  provider enablement, reCAPTCHA, quotas and account-linking tests.
