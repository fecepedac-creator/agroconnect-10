# Dia 6-8: Bundle, CI Rules y Deploy Functions

Fecha: 2026-03-08

## 1) Firestore Rules en CI

Cambios:
- Nuevo job `firestore-rules` en `.github/workflows/ci.yml`.
- Instala Java 21 (`actions/setup-java@v4`) para emulador Firestore.
- Ejecuta `npm run test:rules`.
- `frontend` y `functions` quedan dependientes de este gate.

Resultado esperado:
- Ningun PR pasa sin validar reglas de seguridad en emulador.

Estado local:
- Pendiente en este equipo por Java no compatible.
- CI ya queda preparado para ejecutarlo de forma estable.

## 2) SUPERADMIN_EMAILS por entorno

Cambios:
- Nuevo workflow `.github/workflows/deploy-functions.yml`.
- Selecciona entorno por rama o `workflow_dispatch`.
- Escribe `functions/.env.<project_id>` en runtime con:
  - `SUPERADMIN_EMAILS=<csv>`
- Despliega Functions con `firebase deploy --only functions --project <id>`.

Secrets requeridos en GitHub:
- `FIREBASE_SERVICE_ACCOUNT_AGROCONNECT_APP_420`
- `FIREBASE_PROJECT_ID_DEV`
- `FIREBASE_PROJECT_ID_STAGING`
- `FIREBASE_PROJECT_ID_PROD`
- `SUPERADMIN_EMAILS_DEV`
- `SUPERADMIN_EMAILS_STAGING`
- `SUPERADMIN_EMAILS_PROD`

## 3) Optimizacion de bundle

Cambio aplicado:
- `src/App.tsx` ahora usa `React.lazy` + `Suspense` para vistas de alto peso:
  - Dashboard, AdminPanel, Jobs, Workers, WorkerPortal, Broadcasts, etc.

Build comparativo:
- Antes: chunk principal aprox. `1,179 kB`.
- Ahora: chunk principal aprox. `597 kB`.
- Además se generan chunks por modulo (carga diferida).

Observacion:
- Sigue warning de chunk >500kB.
- Siguiente iteracion recomendada: `manualChunks` en `vite.config.js` para separar Firebase/Recharts.
