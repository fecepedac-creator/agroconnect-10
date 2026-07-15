# Lote B - Contrato de Claims (Sync User Access)

Fecha: 2026-03-08

## Problema

`syncUserAccess` actualizaba `users/{uid}` pero no garantizaba sincronía en custom claims, mientras el cliente refrescaba token asumiendo actualización de claims.

## Cambios aplicados

1. Backend (`functions/src/index.ts`)
- `syncUserAccess` ahora alinea claims (`role`, `companyId`) cuando el usuario no es superadmin.
- Devuelve `claimsUpdated` para señal explícita al cliente.
- No degrada privilegios de `admin/superadmin`.

2. Frontend (`src/firebase.ts`)
- `syncUserAccess` refresca token solo si `claimsUpdated === true`.

## Impacto esperado

- Menor estado ambiguo entre Firestore y token claims.
- Menos refresh innecesario de token.
- Contrato explícito entre backend y frontend.

## Validación pendiente

- Ejecutar lint/build en `functions` con dependencias instaladas en ese subproyecto.
- Pruebas de flujo:
  1. Worker sin empresa
  2. Company admin por `adminEmail`
  3. Superadmin no degradado por `syncUserAccess`
