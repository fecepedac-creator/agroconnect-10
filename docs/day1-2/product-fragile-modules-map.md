# Dia 1-2: Mapa de Modulos Fragiles (Product)

Fecha: 2026-03-08

## Criterio de fragilidad

Un modulo se considera fragil si combina alto acoplamiento, alto volumen de cambios esperados y alto impacto de regresión en negocio.

## Ranking de fragilidad

### 1) Muy alto: `src/App.tsx`

- Evidencia:
  - tamaño aprox: 672 lineas
  - orquesta auth state, routing de roles, carga de datos, navegación y estado global.
- Riesgo: una regresión pequeña afecta login/admin/worker simultáneamente.

### 2) Muy alto: `src/components/AdminPanel.tsx`

- Evidencia:
  - tamaño aprox: 2680 lineas
  - concentra responsabilidades de gestión, configuración y operaciones admin.
- Riesgo: bajo aislamiento funcional y alta probabilidad de side effects.

### 3) Alto: `src/components/LoginScreen.tsx`

- Evidencia:
  - tamaño aprox: 607 lineas
  - mezcla UX, auth flows (popup/redirect), intents y lógica de autorización.
- Riesgo: flujo de entrada crítico con variabilidad alta por rol.

### 4) Alto: `src/components/Jobs.tsx`

- Evidencia:
  - tamaño aprox: 441 lineas
  - concentra operaciones de oferta laboral (núcleo de valor producto).
- Riesgo: regresiones impactan publicación y pipeline de contratación.

### 5) Alto: `src/services/workerAuth.ts`

- Evidencia:
  - tamaño aprox: 160 lineas
  - opera identidad (`worker_usernames`, login por RUT/email, reset).
  - líneas críticas: `src/services/workerAuth.ts:96`, `src/services/workerAuth.ts:104`, `src/services/workerAuth.ts:120`, `src/services/workerAuth.ts:128`
- Riesgo: seguridad e integridad de cuenta.

### 6) Alto: `functions/src/index.ts`

- Evidencia:
  - archivo monolítico de múltiples dominios (auth, stats, AI, email, triggers).
  - líneas de auth críticas: `functions/src/index.ts:120`, `functions/src/index.ts:171`, `functions/src/index.ts:207`
- Riesgo: cualquier cambio afecta dominios cruzados y observabilidad de incidentes.

## Recomendación de refactor incremental (D6-D11)

1. Separar `App.tsx` en shell + auth gate + role routing.
2. Dividir `AdminPanel.tsx` por tabs/casos de uso.
3. Separar lógica de auth de `LoginScreen.tsx` hacia servicios/hooks.
4. Extraer `functions/src/index.ts` por dominios (`auth.ts`, `stats.ts`, `ai.ts`, `comms.ts`).
5. Mantener PRs pequeños con pruebas de regresión por módulo.
