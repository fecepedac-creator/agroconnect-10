---
name: frontend-quality-gates
description: Establece quality gates de frontend para AgroConnect (lint, typecheck, build, smoke UX y regresion critica). Usar cuando se desarrollen features en React/Vite, antes de abrir PR o antes de deploy a staging/prod.
---

# Frontend Quality Gates

## Overview

Convierte calidad de frontend en un proceso repetible y verificable para evitar regresiones de interfaz, estado y autenticacion.

## Workflow

1. Validar base tecnica
- Ejecutar lint y corregir warnings relevantes.
- Ejecutar typecheck/build sin errores.
- Confirmar consistencia de imports y paths.

2. Validar flujos criticos
- Login/admin/worker.
- Publicacion de oferta.
- Busqueda e invitacion de trabajadores.

3. Validar resiliencia UX
- Estados loading/error/empty.
- Navegacion entre vistas sin bloqueo.
- Mensajes de error comprensibles.

4. Documentar evidencia
- Registrar comandos ejecutados y resultado.
- Adjuntar lista de riesgos residuales.

## Quality Gates

1. Lint y build pasan.
2. Flujos criticos sin bloqueo funcional.
3. No hay console errors criticos en escenarios principales.
4. Existe registro de pruebas smoke realizadas.

## References

- Smoke checklist: `references/smoke-checklist.md`
- Definicion de done FE: `references/frontend-dod.md`