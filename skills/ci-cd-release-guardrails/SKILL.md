---
name: ci-cd-release-guardrails
description: Implementa y mantiene guardrails de CI/CD para AgroConnect (checks obligatorios, politicas de branch, PR gates y release controlado). Usar cuando se configure GitHub Actions, estrategias de merge, despliegue a Firebase o politicas de calidad preproduccion.
---

# CI CD Release Guardrails

## Overview

Define un pipeline que previene merges inseguros y despliegues defectuosos. Convierte calidad minima en requisito tecnico automatico.

## Workflow

1. Definir gates obligatorios
- Install deterministico.
- Lint, tests, build.
- Verificaciones de seguridad basicas.

2. Configurar politicas de branch
- `main` protegido.
- Merge solo via PR.
- Requiere checks y aprobacion minima.

3. Integrar release workflow
- Staging antes de prod.
- Deploy condicionado a checks verdes.
- Tag/release notes y trazabilidad.

4. Definir rollback operativo
- Procedimiento rapido de rollback.
- Criterios para activar rollback.
- Verificacion post-rollback.

## Quality Gates

1. No se mergea a `main` sin checks requeridos.
2. Todo deploy productivo deja trazabilidad.
3. Existe rollback documentado y probado.
4. Secrets CI estan fuera del repositorio.

## References

- Pipeline base: `references/pipeline-baseline.md`
- Politica de ramas: `references/branch-policy.md`