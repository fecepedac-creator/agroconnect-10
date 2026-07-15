# Ops Automation

This project now includes a minimal automation kit for daily operations.

## Scripts

- `ops/daily-run.ps1`: runs install/lint/build checks (frontend + functions), executes security scan, and writes a report to `docs/reports/YYYY-MM-DD.md`.
- `ops/security-scan.ps1`: scans tracked files for obvious secret patterns and optionally enforces `.firebaserc` mapping completeness.
- `ops/spawn-front.ps1 -Front <security|tests|docs|product>`: prepares a front-specific worktree and installs dependencies.

## NPM shortcuts

- `npm run ops:daily`
- `npm run ops:security`

## Workflows

- `daily-ops.yml`: scheduled + manual daily report generation.
- `security-guardrails.yml`: secret/config scan on PR/push.
- `release-readiness.yml`: manual strict gate before release.

## Recommended usage

1. Start each front with `ops/spawn-front.ps1`.
2. Run `npm run ops:daily` at least once per working day.
3. Trigger `Release Readiness` workflow before any production release.
