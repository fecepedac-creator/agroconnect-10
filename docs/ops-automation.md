# Ops Automation

This project now includes a minimal automation kit for daily operations.

## Scripts

- `ops/daily-run.ps1`: runs install/lint/build checks (frontend + functions), executes security scan, and writes a report to `docs/reports/YYYY-MM-DD.md`.
- `ops/security-scan.ps1`: scans the tracked tree and all available Git history,
  including Google API key patterns, without printing matching content. Use
  `-SkipHistory` only for local diagnostics, never for a release gate.
- `ops/spawn-front.ps1 -Front <security|tests|docs|product>`: prepares a front-specific worktree and installs dependencies.

## NPM shortcuts

- `npm run ops:daily`
- `npm run ops:security`

## Workflows

- `daily-ops.yml`: scheduled + manual daily report generation.
- `security-guardrails.yml`: full-history secret scan and production dependency
  audit on PR/push.
- `release-readiness.yml`: manual strict gate including
  `npm run check:firebase-envs`.
- `deploy.yml`: one validated Firebase release pipeline with explicit project ID
  and immutable commit/build evidence. There is no independent Functions deploy.

## Recommended usage

1. Start each front with `ops/spawn-front.ps1`.
2. Run `npm run ops:daily` at least once per working day.
3. Trigger `Release Readiness` workflow before any production release.
