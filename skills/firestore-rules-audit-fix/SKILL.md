---
name: firestore-rules-audit-fix
description: Audita y corrige reglas de Firestore en AgroConnect con enfoque en escalacion de privilegios, fuga de datos y manipulacion de integridad. Usar cuando se cambien reglas, se detecten incidentes de acceso, o antes de release a staging/prod.
---

# Firestore Rules Audit Fix

## Overview

Estandariza revisiones de reglas para reducir riesgos de acceso indebido y asegurar integridad de datos criticos. Produce hallazgos con severidad y cambios puntuales verificables.

## Workflow

1. Mapear superficies de ataque
- Identificar colecciones sensibles (`users`, `workers`, `worker_usernames`, `companies`, `applications`, `comms_outbox`).
- Marcar campos que no deben ser editables por clientes.

2. Revisar reglas por categoria
- Autenticacion: `signedIn`, claims, ownership.
- Autorizacion: roles permitidos por ruta.
- Integridad: campos inmutables y validaciones de update/create.
- Privacidad: minimo privilegio para lectura.

3. Detectar patrones de riesgo
- `allow read: if signedIn()` en datos sensibles.
- `allow update` sin restriccion de campos.
- write permitido por self-asserted fields (`request.resource.data.uid`).
- rutas publicas sin validacion de payload.

4. Corregir y validar
- Proponer reglas minimas y explicitas.
- Mantener compatibilidad con flujos reales.
- Definir pruebas manuales o emulador para casos happy/abuse.

## Quality Gates

1. Cada hallazgo incluye severidad e impacto.
2. Cada fix limita permiso sin romper flujo legitimo.
3. Existe al menos un caso de prueba de abuso por hallazgo P1/P2.
4. Todo cambio de reglas tiene estrategia de rollback.

## References

- Checklist de riesgos comunes: `references/risk-patterns.md`
- Matriz de pruebas rules: `references/test-matrix.md`