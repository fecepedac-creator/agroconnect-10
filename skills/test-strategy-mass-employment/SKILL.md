---
name: test-strategy-mass-employment
description: Diseña y ejecuta estrategia de pruebas para AgroConnect enfocada en empleo operativo masivo (agro, construccion, seguridad y otros verticales). Usar cuando se agreguen funcionalidades de matching, auth, postulacion, difusion o antes de release a staging/prod.
---

# Test Strategy Mass Employment

## Overview

Estandariza pruebas por riesgo real de negocio y no solo por cobertura numerica. Prioriza flujos de alto volumen: login, postulacion, publicacion y autorizacion.

## Workflow

1. Definir mapa de riesgos
- Identificar flujos criticos por perfil: trabajador, empresa, superadmin.
- Marcar rutas de alto impacto: auth, roles, publicaciones, aplicaciones.

2. Diseñar piramide de pruebas
- Unit: utilidades puras, normalizacion, validaciones.
- Integration: servicios Firebase y reglas de acceso.
- E2E smoke: rutas clave con escenarios reales de usuario.

3. Implementar suites minimas por release
- Auth and role gate.
- Worker apply flow.
- Company publish and manage jobs.
- Admin controls and restricted actions.

4. Ejecutar y reportar
- Registrar comandos, pass/fail y bloqueadores.
- Etiquetar riesgos residuales por severidad.

## Quality Gates

1. Toda release ejecuta smoke E2E minimo.
2. Flujos criticos tienen al menos una prueba automatizada.
3. Fallas P1/P2 bloquean release.
4. Reporte final distingue cobertura util vs cobertura cosmetica.

## References

- Matriz de escenarios: `references/scenario-matrix.md`
- Criterios de bloqueo: `references/release-blockers.md`