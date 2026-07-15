---
name: worker-identity-integrity
description: Protege la integridad de identidad de trabajadores en AgroConnect (RUT, username mapping, email vinculado y ownership) para evitar secuestro de cuenta y colisiones de identidad. Usar cuando se modifiquen flujos de registro/login/recuperacion o reglas de `worker_usernames`.
---

# Worker Identity Integrity

## Overview

Estandariza controles para que la identidad operativa del trabajador sea consistente y no editable por terceros. Prioriza seguridad de mapping RUT -> UID y recuperacion segura.

## Workflow

1. Inventariar identidad y puntos de escritura
- Revisar `workers/{uid}`, `users/{uid}`, `worker_usernames/{rut}`.
- Identificar quien puede crear/actualizar cada campo.

2. Definir invariantes
- Un RUT activo no puede pertenecer a dos UIDs.
- Un usuario no puede reasignar RUT de otro.
- Campos de identidad sensibles deben ser inmutables o server-managed.

3. Endurecer reglas y flujo
- Evitar autorizacion basada solo en payload del cliente.
- Agregar validaciones de ownership e inmutabilidad en rules.
- Mover reconciliaciones sensibles a Cloud Functions cuando corresponda.

4. Verificar abuso y recuperacion
- Probar colision de RUT.
- Probar takeover por update de mapping.
- Definir proceso de soporte para correccion legitima de identidad.

## Quality Gates

1. Existe politica de unicidad de identidad documentada.
2. No hay ruta de takeover desde cliente autenticado comun.
3. Los casos de recuperacion no rompen integridad historica.
4. Se documenta rollback de cambios de reglas/flujo.

## References

- Invariantes de identidad: `references/identity-invariants.md`
- Casos de abuso: `references/abuse-cases.md`