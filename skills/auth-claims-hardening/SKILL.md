---
name: auth-claims-hardening
description: Endurece autenticacion y custom claims en AgroConnect para evitar desalineacion de roles entre Firebase Auth y Firestore. Usar cuando se modifiquen flujos de login, funciones de sync de acceso, roles administrativos o permisos basados en claims.
---

# Auth Claims Hardening

## Overview

Asegura que los roles y permisos se resuelvan de forma consistente entre token claims y datos de Firestore. Evita bypass por estados intermedios o tokens desactualizados.

## Workflow

1. Inventariar fuentes de verdad
- Claims en Firebase Auth.
- `users/{uid}` en Firestore.
- Functions que sincronizan acceso (`syncUserAccess`, `syncSuperadminClaims`, `setSuperadminByEmail`).

2. Definir contrato de roles
- Enumerar roles validos (`worker`, `company_admin`, `company_hr`, `superadmin`).
- Definir precedencia entre claims y documento de usuario.
- Definir tiempos de refresco de token tras cambios de claims.

3. Revisar flows criticos
- Login admin y company admin.
- Elevacion/revocacion de superadmin.
- Fallback seguro cuando claims y Firestore divergen.

4. Aplicar controles
- Fail-closed ante inconsistencia de privilegio.
- Logs auditables por cambio de rol.
- Mensajes de error sin filtrar informacion sensible.

## Quality Gates

1. Toda accion privilegiada valida claims y contexto.
2. Existe manejo explicito de token refresh post-update.
3. Rol en Firestore no se puede escalar desde cliente.
4. Existe ruta clara de recuperacion ante desalineacion de claims.

## References

- Contrato de roles: `references/role-contract.md`
- Checklist de flujos auth: `references/auth-flow-checklist.md`