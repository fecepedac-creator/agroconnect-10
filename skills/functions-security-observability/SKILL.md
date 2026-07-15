---
name: functions-security-observability
description: Endurece seguridad y observabilidad de Firebase Cloud Functions en AgroConnect. Usar cuando se creen o modifiquen callables/triggers, manejo de secretos, envio de correos, logs operativos o auditoria de acciones privilegiadas.
---

# Functions Security Observability

## Overview

Define un marco operativo para Functions seguras, auditables y mantenibles. Reduce fallos silenciosos y mejora respuesta a incidentes.

## Workflow

1. Clasificar funciones por riesgo
- Auth/claims y acciones admin.
- Triggers de datos criticos.
- Integraciones externas (Gemini, SMTP).

2. Endurecer seguridad
- Validar autenticacion/autorizacion al inicio.
- Validar input estricto y fail-closed.
- Usar secretos administrados, nunca hardcode.

3. Estandarizar logging
- Log estructurado con contexto minimo: function, actorUid, resource, outcome.
- No loggear secretos ni PII innecesaria.
- Definir codigos de error operables.

4. Definir alertas y recuperacion
- Alertar por tasas de error elevadas.
- Documentar retries/idempotencia en triggers.
- Mantener runbook para incidentes de funciones.

## Quality Gates

1. Toda callable valida auth + permisos.
2. Inputs tienen validaciones minimas de tipo y formato.
3. Logs son trazables sin exponer datos sensibles.
4. Cada funcion critica tiene estrategia de rollback o kill-switch.

## References

- Logging contract: `references/logging-contract.md`
- Security checklist: `references/security-checklist.md`