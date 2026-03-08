# AgroConnect 10 - Operacion Tecnica

Plataforma digital de reclutamiento operativo para empleos de alta demanda (agro, construccion, seguridad y oficios similares), conectando oferta y demanda laboral en forma simple y mobile-first.

## Stack

- Frontend: React + Vite + Firebase Web SDK
- Backend: Firebase Functions (Node 22, TypeScript)
- Datos: Firestore + Security Rules
- CI/CD: GitHub Actions

## Requisitos

- Node.js 22 (recomendado para compatibilidad con functions)
- npm 10+
- Firebase CLI (`firebase-tools`)
- Java 21 (requerido para Firestore Emulator en tests de rules)

## Setup local

1. Instalar dependencias frontend:

```bash
npm ci
```

2. Instalar dependencias functions:

```bash
npm --prefix functions ci
```

3. Variables de entorno frontend:
- Usa `.env.local.example` como base.

4. Variables de entorno functions (parametros):
- Para emulacion/deploy por proyecto usa `functions/.env.<project_id>`.
- Parametros actuales:
  - `SUPERADMIN_EMAILS` (CSV: `mail1@dominio.com,mail2@dominio.com`)

## Scripts utiles

Frontend:
- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run test:rules` (requiere Java 21)

Functions:
- `npm --prefix functions run lint`
- `npm --prefix functions run build`

## Seguridad clave

1. Firestore Rules:
- Endurecidas para ownership en `worker_usernames`.
- Restricciones de mutacion en `applications` para evitar escalamiento por worker.

2. Auth / Claims:
- `syncUserAccess` sincroniza claims `role/companyId` y responde `claimsUpdated`.
- `syncSuperadminClaims` y `setSuperadminByEmail` usan allowlist configurable por parametro (`SUPERADMIN_EMAILS`), no hardcode.

3. Sesion:
- Logout explicito con `signOut(auth)` en frontend.

## CI

Workflow principal: `.github/workflows/ci.yml`

Gates:
- `firestore-rules`: ejecuta pruebas de reglas en emulador con Java 21.
- `frontend`: lint + build.
- `functions`: lint + build.

## Deploy

Hosting:
- Workflow: `.github/workflows/deploy.yml`

Functions:
- Workflow: `.github/workflows/deploy-functions.yml`
- Seleccion de entorno:
  - `main` -> prod
  - `release/*` -> staging
  - `workflow_dispatch` -> dev/staging/prod

Secrets requeridos:
- `FIREBASE_SERVICE_ACCOUNT_AGROCONNECT_APP_420`
- `FIREBASE_PROJECT_ID_DEV`
- `FIREBASE_PROJECT_ID_STAGING`
- `FIREBASE_PROJECT_ID_PROD`
- `SUPERADMIN_EMAILS_DEV`
- `SUPERADMIN_EMAILS_STAGING`
- `SUPERADMIN_EMAILS_PROD`

## Runbook rapido de incidentes

1. Acceso administrativo no funciona:
- Verificar valor vigente de `SUPERADMIN_EMAILS` en el entorno desplegado.
- Ejecutar `syncSuperadminClaims` para usuario afectado.

2. Tests rules fallan en CI:
- Revisar logs del job `firestore-rules`.
- Confirmar Java 21 y compatibilidad de `firebase-tools`.

3. Error en deploy functions:
- Validar secretos de proyecto y service account.
- Confirmar que el workflow genero `functions/.env.<project_id>`.

## Roadmap tecnico corto (siguiente bloque)

1. Reducir `index` bundle por debajo de 500kB (manual chunks: firebase/recharts).
2. Ejecutar `test:rules` en PRs con reporte de casos permitidos/bloqueados.
3. Completar runbook de rollback (hosting + functions) con tiempos RTO/RPO.
