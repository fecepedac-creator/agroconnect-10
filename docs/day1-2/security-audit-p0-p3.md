# Dia 1-2: Auditoria de Seguridad P0-P3

Fecha: 2026-03-08
Scope: `firestore.rules`, `src/firebase.ts`, `src/App.tsx`, `src/services/workerAuth.ts`, `functions/src/index.ts`, artefactos build

## Resumen ejecutivo

- P0: 0 hallazgos
- P1: 4 hallazgos
- P2: 3 hallazgos
- P3: 2 hallazgos

## Hallazgos

### P1-01: Secuestro de identidad por RUT en `worker_usernames`

- Impacto: un usuario autenticado puede tomar control logico de un RUT ajeno en el mapping, afectando login y recuperacion.
- Evidencia:
  - `firestore.rules:183`
  - `firestore.rules:185`
  - `firestore.rules:186`
  - `src/services/workerAuth.ts:104`
  - `src/services/workerAuth.ts:128`
- Riesgo de abuso: alto.
- Mitigacion recomendada (D3-D5): bloquear update arbitrario y mover reasignaciones a Function con validacion server-side + auditoria.

### P1-02: Integridad de aplicaciones vulnerable a manipulación del trabajador

- Impacto: el trabajador dueño del doc puede actualizar campos sensibles (ej. status), distorsionando pipeline operativo y KPIs.
- Evidencia:
  - `firestore.rules:229`
  - `firestore.rules:232`
- Riesgo de abuso: alto.
- Mitigacion recomendada (D3-D5): permitir al worker solo campos no críticos (ej. datos de contacto), mantener `status` y resultado de proceso como write-only por empresa/superadmin.

### P1-03: Artefacto build versionado contiene claves y configuración sensible de entorno

- Impacto: exposición innecesaria de superficie y configuración en artefactos tracked; dificulta control de rotación y auditoría.
- Evidencia:
  - `build-output/assets/index-c02F8y5Q.js:42`
  - `build-output/assets/index-c02F8y5Q.js:85`
- Riesgo de abuso: alto (especialmente por configuración pública y drift de secretos).
- Mitigacion recomendada (D3-D5): sacar `build-output/` del control de versiones y regenerar solo en CI/artifacts.

### P1-04: Inconsistencia entre contrato de claims del cliente y sync real en backend

- Impacto: el cliente asume actualización de claims en `syncUserAccess`, pero backend solo persiste Firestore role/companyId; esto genera estados de autorización confusos.
- Evidencia:
  - `src/firebase.ts:78`
  - `src/firebase.ts:84`
  - `src/firebase.ts:96`
  - `functions/src/index.ts:120`
  - `functions/src/index.ts:148`
  - `functions/src/index.ts:162`
- Riesgo de abuso: alto por decisiones de acceso con señales desalineadas.
- Mitigacion recomendada (D3-D5): definir una sola fuente de verdad para privilegios y un flujo explícito de claim sync/refresh.

### P2-01: Logout parcial (no siempre cierra sesión de Firebase explícitamente)

- Impacto: UX y seguridad operacional degradadas en equipos compartidos si el usuario interpreta cierre completo.
- Evidencia:
  - `src/App.tsx:197`
  - `src/App.tsx:198`
  - `src/App.tsx:596`
- Mitigacion recomendada: llamar `signOut(auth)` en logout global y validar post-logout route guards.

### P2-02: Allowlist superadmin hardcoded en backend

- Impacto: alta fricción operativa y riesgo de drift entre configuración real y código.
- Evidencia:
  - `functions/src/index.ts:23`
  - `functions/src/index.ts:171`
  - `functions/src/index.ts:207`
- Mitigacion recomendada: mover allowlist a configuración segura gestionada por entorno (secret/config + control auditado).

### P2-03: Reglas de lectura de `worker_usernames` demasiado amplias

- Impacto: cualquier usuario autenticado puede consultar mappings y favorecer enumeración de identidad operativa.
- Evidencia:
  - `firestore.rules:184`
- Mitigacion recomendada: restringir read por ownership/flujo específico o mover lookup a callable con rate-limit.

### P3-01: deuda de codificación/encoding en comentarios y textos

- Impacto: mantenibilidad y claridad del equipo (acentos corruptos y ruido documental).
- Evidencia:
  - `src/firebase.ts` (comentarios con caracteres corruptos)
  - `functions/src/index.ts` (múltiples strings/documentación con encoding inconsistente)
- Mitigacion recomendada: normalizar encoding UTF-8 y lint de archivos de texto.

### P3-02: README base no describe arquitectura ni operación real

- Impacto: onboarding lento y mayor error operativo en cambios.
- Evidencia:
  - `README.md`
- Mitigacion recomendada: reemplazar por README operativo (setup, entornos, scripts, CI, runbooks).

## Plan inmediato (D3-D5)

1. Corregir P1-01 y P1-02 en `firestore.rules` + pruebas de abuso.
2. Corregir P1-04 (contrato claims/backend) y cerrar inconsistencias de acceso.
3. Excluir build artifacts versionados y limpiar exposición en repo.
4. Aplicar fixes P2 de logout y allowlist configurable.
