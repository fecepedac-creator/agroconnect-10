---
name: incident-runbooks
description: Define y ejecuta runbooks de incidentes para AgroConnect (caidas, errores auth, fuga de datos, regresiones de reglas o fallas de despliegue). Usar cuando ocurra un incidente o para preparar operacion de produccion con respuesta rapida y trazable.
---

# Incident Runbooks

## Overview

Estandariza la respuesta a incidentes para reducir tiempo de deteccion, mitigacion y recuperacion. Prioriza continuidad operativa y seguridad de datos.

## Workflow

1. Triage inicial
- Clasificar severidad (P1/P2/P3).
- Identificar alcance (usuarios, empresa, sistema).
- Definir owner tecnico de incidente.

2. Contencion
- Aplicar mitigacion temporal (feature flag, rollback, bloqueo de ruta).
- Preservar evidencia (logs, timestamps, IDs).

3. Correccion
- Implementar fix minimo seguro.
- Validar en staging si el impacto lo permite.
- Ejecutar checks de regresion.

4. Cierre y aprendizaje
- Publicar postmortem breve.
- Definir acciones preventivas y fechas.
- Convertir aprendizaje en pruebas y guardrails.

## Quality Gates

1. Todo incidente tiene severidad y owner.
2. Existe timeline verificable de eventos.
3. Se documenta mitigacion y estado final.
4. Se crea accion preventiva posterior.

## References

- Severidad y SLA: `references/severity-sla.md`
- Plantilla postmortem: `references/postmortem-template.md`