# Multi-Agent Operating Model

This document defines how AgroConnect development is split across parallel workstreams.

## 1. Workstreams and owners

| Front | Branch | Worktree | Scope |
|---|---|---|---|
| Security | `codex/security` | `../agroconnect-10-worktrees/security` | Auth, claims, firestore rules, secrets, hardening |
| Tests | `codex/tests` | `../agroconnect-10-worktrees/tests` | Unit/integration/E2E, smoke suite, regression coverage |
| Docs | `codex/docs` | `../agroconnect-10-worktrees/docs` | Runbooks, architecture, onboarding, release docs |
| Product | `codex/product` | `../agroconnect-10-worktrees/product` | UX flows, feature delivery, instrumentation |

Owner model:
- Each PR has one human owner and one technical reviewer.
- Cross-front changes require at least one reviewer from impacted front.

## 2. Worktree commands

```powershell
# list worktrees
git worktree list

# create new front if needed
git worktree add ..\agroconnect-10-worktrees\<front> -b codex/<front>
```

## 3. Merge policy

1. No direct push to `main`.
2. All changes arrive via Pull Request.
3. Required checks before merge:
- Build passes
- Lint passes
- Tests pass (or explicit approved exception)
4. At least one review approval.
5. Squash merge preferred for single-topic PRs.

## 4. PR scope rules

1. Keep one front per PR whenever possible.
2. If a PR touches multiple fronts, split into stacked PRs.
3. Include a short risk section in every PR:
- security impact
- data impact
- rollback plan

## 5. Coordination cadence

- Daily async update per front: status, blockers, next step.
- Weekly integration checkpoint: merge order and release impact.

## 6. Branch naming and tags

- Branches: `codex/<front>` or `codex/<front>-<topic>`
- Suggested labels: `front:security`, `front:tests`, `front:docs`, `front:product`