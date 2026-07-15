# Lote D - Hardening de Sesi�n y Superadmin

Fecha: 2026-03-08

## Problemas

1. Logout parcial (`P2-01`)
- La UI limpiaba estado local, pero no cerraba sesi�n de Firebase Auth de forma expl�cita.

2. Allowlist r�gido (`P2-02`)
- El backend ten�a superadmins hardcodeados en `functions/src/index.ts`.

## Cambios aplicados

1. `src/App.tsx`
- `handleLogout` ahora ejecuta `signOut(auth)` con manejo de error.
- Bot�n de salida invoca `onClick={() => void handleLogout()}` para flujo async expl�cito.

2. `functions/src/index.ts`
- Se reemplaza allowlist hardcodeado por par�metro de Functions:
  - `SUPERADMIN_EMAILS` (CSV de correos).
- Nuevo helper `getSuperadminEmails()`:
  - Normaliza y valida emails.
  - Mantiene fallback seguro a `fecepedac@gmail.com` si el par�metro est� vac�o o inv�lido.
- `syncSuperadminClaims` y `setSuperadminByEmail` usan esta fuente configurable.

## Impacto esperado

- Menor riesgo de sesi�n residual en equipos compartidos.
- Gobernanza operativa del acceso superadmin por entorno, sin redeploy de c�digo para cambios simples de allowlist.

## Rollback

1. Revertir commit de este lote.
2. (Opcional) volver a hardcode temporal solo en contingencia operacional.
