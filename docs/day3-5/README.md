# Dia 3-5: Entregables Consolidados

Fecha: 2026-03-08

## Estado por lote

1. Lote A (rules + abuse tests): completado
- Reglas endurecidas para `worker_usernames` y `applications`.
- Suite de pruebas de abuso/leg�timo creada.
- Evidencia:
  - `docs/day3-5/lote-a-validation-matrix.md`
  - `docs/day3-5/lote-a-test-execution-notes.md`

2. Lote B (claims contract): completado
- `syncUserAccess` alinea claims y expone `claimsUpdated`.
- Frontend refresca token solo cuando backend confirma actualizaci�n.
- Evidencia:
  - `docs/day3-5/lote-b-claims-contract.md`

3. Lote C (artifact hygiene): completado
- `build-output/` removido del versionado y agregado a `.gitignore`.
- Evidencia:
  - `docs/day3-5/lote-c-build-artifacts-hygiene.md`

4. Lote D (auth hardening): completado
- Logout expl�cito con `signOut(auth)`.
- Allowlist superadmin configurable v�a `SUPERADMIN_EMAILS` (Functions param).
- Evidencia:
  - `docs/day3-5/lote-d-auth-hardening.md`

## Commits relacionados

- `6b43b1f`: hardening reglas Lote A.
- `af410ab`: suite de pruebas rules Lote A + configuraci�n emulador.
- `ec03633`: contrato de claims Lote B.
- `3dcf1a0`: Lote C + Lote D (artefactos build, logout, superadmin configurable).

## Validaciones ejecutadas

1. Frontend build
- Comando: `npm run build`
- Estado: OK.
- Nota: warning de chunk grande (no bloqueante, optimizable en siguiente bloque).

2. Rules tests end-to-end
- Estado: pendiente por runtime Java local del emulador Firestore.

## Pendientes recomendados para Dia 6-8

1. Desbloquear emulador y ejecutar `test:rules` en CI.
2. Definir `SUPERADMIN_EMAILS` por entorno (dev/stage/prod) en deploy de Functions.
3. Reducir chunk principal de frontend (>500kB) con split por rutas/m�dulos.
4. Crear README operativo de producci�n (setup, deploy, incidentes, rollback).
