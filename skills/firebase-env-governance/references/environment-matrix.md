# Environment Matrix

## Standard aliases

- dev: pruebas rapidas y cambios en desarrollo
- staging: validacion pre-release
- prod: usuarios reales

## Required mapping

- Alias name
- Firebase project ID
- Deployment owner
- Allowed branches
- Required checks

## Branch policy

- dev <- `codex/*`
- staging <- `release/*`
- prod <- `main` (or `release/prod`)