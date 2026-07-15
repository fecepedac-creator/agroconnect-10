---
name: firebase-env-governance
description: Define y aplica gobernanza de entornos Firebase (dev, staging, prod) para AgroConnect. Usar cuando se necesite configurar proyectos por entorno, separar secretos, validar despliegues por ambiente, o auditar que ningun cambio de desarrollo impacte produccion.
---

# Firebase Env Governance

## Overview

Estandariza la separacion de ambientes y secretos para evitar despliegues accidentales a produccion. Define un flujo seguro para inicializacion, validacion y release.

## Workflow

1. Inventariar estado actual
- Revisar `firebase.json`, `.firebaserc`, `.env*`, `functions/package.json`.
- Confirmar proyectos Firebase existentes y alias esperados: `dev`, `staging`, `prod`.

2. Definir contratos por entorno
- Documentar variables de frontend permitidas por entorno (`VITE_*` no sensible).
- Documentar secretos de Functions por entorno (`firebase functions:secrets:*`).
- Prohibir secretos en archivos versionados.

3. Aplicar controles de despliegue
- Exigir despliegue desde rama y entorno correctos.
- Bloquear release si faltan quality gates (lint, tests, build).
- Confirmar objetivo de deploy antes de ejecutar comandos de produccion.

4. Verificar seguridad y trazabilidad
- Confirmar que `.env` sensible no esta versionado.
- Confirmar que secretos fueron rotados si hubo exposicion.
- Registrar decisiones en runbook de entorno.

## Quality Gates

1. Existe mapeo explicito `alias -> projectId` para `dev/staging/prod`.
2. Ningun secreto esta en repo.
3. Existe checklist de predeploy por ambiente.
4. El flujo incluye rollback o mitigacion.

## References

- Matriz de entornos: `references/environment-matrix.md`
- Checklist de deploy seguro: `references/deploy-checklist.md`