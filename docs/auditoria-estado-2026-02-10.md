# Auditoría técnica AgroConnect — 2026-02-10

## Alcance ejecutado
- Revisión estática de frontend React+TypeScript, reglas Firestore y Cloud Functions.
- Validación local de build/lint en frontend y functions.
- Typecheck manual con `npx tsc --noEmit` (no existe script dedicado en `package.json`).
- Revisión de commits recientes (últimos 90–180 días).

## Estado actual del proyecto

### Frontend
- `npm run build`: **OK** (compila y genera bundle).
- `npm run lint`: **OK**.
- `npx tsc --noEmit`: **FALLA** por errores de tipos.

Errores críticos de typecheck detectados:
1. Uso de `import.meta.env` sin tipos Vite disponibles (varios archivos).
2. Inconsistencias de tipos entre estados de empresa (`Active`/`active`, `Overdue`/`overdue`).
3. Propiedades opcionales/duplicadas en objetos de `Company` (ej. `adminEmail` no declarado en interfaz).
4. Mezcla de estructuras de stats en dashboard (`workersTotal/workersActive` no existen en una rama del tipo).

### Functions
- `functions/npm run build`: **OK** (TypeScript compila).
- `functions/npm run lint`: **OK**.

## Cambios recientes (90–180 días)
Patrón observado en git:
- Refuerzo de auth/superadmin (claims, popup login, refresh de token).
- Ajustes de reglas de seguridad Firestore.
- Integración de dashboard superadmin y métricas globales.
- Integración de `comms_outbox` + trigger de correo SMTP Gmail.
- Normalización parcial de estado de empresas, pero con mezcla de mayúsculas/minúsculas aún visible en tipos/UI.

## Evidencia de pendientes solicitados

### 1) Envío correos real (Gmail SMTP + Reply-To superadmin + app password + Cloud Functions)
**Estado:** Parcial.
- Implementado trigger `sendEmailFromOutbox` con Gmail SMTP y secret `GMAIL_APP_PASSWORD`.
- `replyTo` sale de `admin/config.notificationEmail` con fallback fijo.
- Limitación: remitente está centralizado (`agroconnect@gmail.com`), no identidad por empresa.
- En checklist de sprint aparece evidencia de outbox en `queued` sin pasar a `sent/error`.

### 2) Resumen cumplimiento 90 días (score 0–100; stats_companies/{companyId})
**Estado:** Parcial.
- Existe KPI de “Cumplimiento (90 días)” con score 0–100 en Panel Empresa.
- El score se calcula con facturas de `billing_invoices` (últimos 90 días), no directamente desde `stats_companies`.
- Sí hay lectura de `stats_companies/{companyId}` para otros KPIs.

### 3) Tendencias 1M/3M/12M (flechas + tooltip; monthly/{YYYY-MM})
**Estado:** Hecho.
- Implementadas tendencias con badges 1m/3m/12m, flechas y `title` como tooltip.
- Fuente: subcolección `stats_companies/{companyId}/monthly/{YYYY-MM}`.

### 4) UX Panel Empresa (modal 60–70% ancho; separar bloques)
**Estado:** Parcial.
- Se ven bloques separados y ordenados por tarjetas/secciones en Panel Empresa.
- En AdminPanel el modal principal usa `max-w-3xl` (ancho fijo relativo), no hay evidencia explícita de requisito “60–70%” como regla de diseño documentada.

### 5) Etiquetas y botones de alerta (🔴 Morosidad / 🟢 Pagos al día)
**Estado:** Parcial.
- Existen etiquetas de estado “Morosidad” y “Pagos al día” con estilos rojo/verde.
- No hay evidencia de uso explícito de emojis 🔴/🟢 en esas etiquetas.

## Riesgos de seguridad/permisos detectados
1. **Superadmin hardcodeado en Functions** (`SUPERADMIN_EMAILS` con email explícito): riesgo operativo y de gobernanza.
2. **Modelo de correo centralizado**: cualquier envío sale como marca global, no por identidad empresarial; posible conflicto legal/comercial.
3. **Dependencia de claims para privilegios**: si no se sincronizan bien, puede haber accesos inconsistentes hasta refrescar token.
4. **Typecheck roto**: hoy no rompe build Vite, pero sí rompe entornos CI estrictos y puede ocultar bugs de runtime.

## Propuesta de plan (2 semanas, sin sobre-ingeniería)
### Semana 1 (estabilidad y bloqueo de riesgos)
1. Corregir typecheck P0/P1 (sin refactor masivo): `import.meta.env`, tipos `Company` y estados.
2. Revisar pipeline real de `comms_outbox` (secret, logs, Eventarc) hasta lograr transición `queued -> sent/error`.
3. Definir una sola convención de estado de empresa (lowercase o Capitalized) en todo el stack.

### Semana 2 (producto y deuda visible)
1. Cerrar brecha de UX solicitada en modal (si negocio exige 60–70%, fijarlo explícitamente en CSS/layout).
2. Completar semántica visual de alertas (si se pide, incorporar 🔴/🟢 en labels de estado).
3. Diseñar fase 2 de mensajería por empresa (dominio remitente por empresa o proveedor multi-tenant) sin implementarla aún en producción.

## Comandos ejecutados en esta auditoría
- `npm run build`
- `npm run lint`
- `npx tsc --noEmit`
- `cd functions && npm run build`
- `cd functions && npm run lint`
- `git log --since='180 days ago' --date=short --pretty=format:'%h|%ad|%an|%s' -- .`
- Revisiones con `sed`/`nl`/`rg` sobre archivos de frontend, functions, reglas y docs.
