# Dia 1-2: Baseline de Pruebas y Gaps Criticos

Fecha: 2026-03-08

## Estado actual de testing

- No existen archivos de pruebas automatizadas detectables en `tests/`, `functions/test`, `functions/tests`.
- Frontend no define script `test`.
- Functions no define script `test`.

Evidencia:
- `package.json:6` a `package.json:12`
- `functions/package.json:3` a `functions/package.json:8`

## Lo que SI existe hoy

- Checks de calidad CI para lint/build frontend y functions.
- Scripts operativos nuevos (`ops:daily`, `ops:security`).

## Gaps criticos (prioridad)

1. Sin pruebas de autorización para reglas Firestore.
2. Sin pruebas de abuso para auth/claims (escalación, desalineación de roles).
3. Sin smoke E2E de flujos core:
- login worker
- login admin
- publicar oferta
- postular a oferta
4. Sin suite de regresión de funciones críticas (sync access, superadmin, outbox email).

## Baseline objetivo minimo (D3-D8)

1. Rule tests mínimos (emulador):
- bloquear takeover de `worker_usernames`
- bloquear updates sensibles en `applications`
- validar acceso por company boundary
2. Integración backend mínima:
- `syncUserAccess`
- `syncSuperadminClaims`
- `setSuperadminByEmail`
3. Smoke frontend automatizado (mínimo 4 flujos).

## Criterio de salida para D8

- Existe al menos 1 prueba automatizada por flujo crítico.
- Existe al menos 1 prueba de abuso por cada hallazgo P1.
- Pipeline falla cuando una prueba crítica rompe.
