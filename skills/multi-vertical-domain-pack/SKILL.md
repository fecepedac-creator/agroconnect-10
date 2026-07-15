---
name: multi-vertical-domain-pack
description: Estructura AgroConnect para operar multiples verticales de empleo operativo (agro, construccion, seguridad, logistica, retail) con nucleo comun y reglas por rubro. Usar cuando se diseñen nuevas categorias laborales o se adapte producto a industrias adicionales.
---

# Multi Vertical Domain Pack

## Overview

Permite escalar el producto desde agro a otros rubros sin duplicar plataforma. Separa capacidades core de configuraciones especificas por vertical.

## Workflow

1. Definir core comun
- Auth, perfiles, postulacion, matching basico.
- Permisos y auditoria transversales.

2. Definir extensiones por vertical
- Campos obligatorios por rubro.
- Reglas de compliance operativo.
- Templates de oferta y filtros.

3. Diseñar estrategia de rollout
- Piloto por vertical.
- Metricas de adopcion/comparacion.
- Criterios para escalar o pausar.

4. Mantener gobernanza
- Evitar forks de logica core.
- Gestionar versionado de schema por vertical.

## Quality Gates

1. Toda extension vertical respeta core security.
2. Existe contrato de datos por vertical.
3. Nuevos campos tienen migracion/backfill definido.
4. Se mide impacto por vertical tras lanzamiento.

## References

- Modelo core-vs-vertical: `references/core-vs-vertical.md`
- Plantilla de vertical: `references/vertical-template.md`