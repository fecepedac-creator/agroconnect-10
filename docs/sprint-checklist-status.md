# Sprint Checklists (estado ejecutado en revisión estática)

> Nota de alcance: en este entorno no es posible ejecutar logins reales, Firebase Auth en vivo, ni acceder a un proyecto Firebase con datos/credenciales.  
> Por lo tanto, la “ejecución” corresponde a **revisión de código y reglas** (estado estático), y los pasos de pruebas reales quedan marcados como pendientes.

## Verificación real con Admin SDK (cómo actualizar este checklist)
1. Configura `GOOGLE_APPLICATION_CREDENTIALS` como se indica en `docs/admin-sdk-setup.md`.
2. Ejecuta: `node scripts/sprint-checks.mjs`.
3. Pega la salida en este documento para registrar los conteos reales por Sprint.

## Pilar 1 — Persistencia real en Firestore (fuente de verdad)
## Pilar 2 — Autenticación y accesos seguros (SuperAdmin / Empresa / Worker)
## Pilar 3 — Servicios externos (IA, geolocalización, correo)
## Pilar 4 — Mensajería por empresa (email/WhatsApp propios)

---

## Sprint 1 — Accesos y roles
**Objetivo:** asegurar accesos consistentes por rol (SuperAdmin, Empresa, Worker).

**Checklist con avance**
- [✅] Validar reglas de SuperAdmin (allowlist/email/claims) en `firestore.rules`.
  - Acción ejecutada: revisión de reglas y helper `isSuperAdmin`.
- [⚠️] Probar login Google con email allowlisted → acceso AdminPanel.
  - Acción ejecutada: **no ejecutable** sin credenciales/entorno vivo.
- [⚠️] Probar login Google con email no allowlisted → acceso denegado.
  - Acción ejecutada: **no ejecutable** sin credenciales/entorno vivo.
- [✅] Flujo Empresa: `syncUserAccess` asigna `role=company_admin` + `companyId`.
  - Acción ejecutada: revisión de Function + llamada desde `LoginScreen`.
- [✅] Flujo Worker: registro/login crea `users`, `workers`, `worker_usernames`.
  - Acción ejecutada: revisión de `workerAuth.ts`.
- [✅] Reglas de acceso por rol (jobs, applications, companies).
  - Acción ejecutada: revisión de `firestore.rules`.
- [⚠️] Pruebas cruzadas reales (empresa no accede a otras empresas, worker no escribe empresas).
  - Acción ejecutada: **no ejecutable** sin entorno en vivo.
- [⚠️] Validar que todas las companies tengan `adminEmail` (o definir flujo alternativo sin `adminEmail`).
  - Acción ejecutada: verificación real detectó `empresa_demo` sin `adminEmail`.

**Verificación real (Admin SDK):**
- Se confirmó conexión real a Firestore con Admin SDK y lectura de `companies` (2 docs, IDs `Sg8Ia9rogL42ldARsOqg`, `empresa_demo`).
- Resultado adicional: `empresa_demo` sin `adminEmail` y no hay `company_admin` sin `companyId`.

**Grado de avance estimado:** 70% (revisión estática completa, conexión real confirmada; pruebas de login/roles aún pendientes).

---

## Sprint 2 — Persistencia real en Firestore
**Objetivo:** eliminar datos “fantasma” y asegurar escritura/lectura real.

**Checklist con avance**
- [✅] Jobs persisten en Firestore y usan `onSnapshot`.
  - Acción ejecutada: revisión de `Jobs.tsx`.
- [✅] Broadcasts guardan historial en Firestore.
  - Acción ejecutada: revisión de `Broadcasts.tsx`.
- [✅] Company dashboard consume `stats_companies` (si existe).
  - Acción ejecutada: revisión de `App.tsx` + `Dashboard.tsx`.
- [⚠️] Validar que Workers/GlobalSearch no dependan de datos demo en prod.
  - Acción ejecutada: detectado uso de `INITIAL_WORKERS`/`MOCK_GLOBAL_WORKERS` en `App.tsx`; requiere ajuste/validación en entorno real.
- [⚠️] Validar que todos los formularios críticos escriben Firestore sin fallos de reglas.
  - Acción ejecutada: **no ejecutable** sin entorno vivo.
- [⚠️] Verificación real: subcolecciones de `billing_payments`/`billing_invoices` existen pero están vacías.
  - Acción ejecutada: conteo real con Admin SDK; requiere validar si la UI crea docs correctamente.

**Grado de avance estimado:** 55% (persistencia clave OK, pero uso de datos demo sigue presente y pruebas reales pendientes).

---

## Sprint 3 — Métricas por empresa (stats)
**Objetivo:** dashboards con métricas reales por empresa.

**Checklist con avance**
- [✅] UI lee `stats_companies/{companyId}`.
  - Acción ejecutada: revisión de `App.tsx`.
- [✅] Reglas restringen `stats_companies` a SuperAdmin.
  - Acción ejecutada: revisión de `firestore.rules`.
- [⚠️] Validar acceso real a métricas por empresa (puede estar bloqueado).
  - Acción ejecutada: identificado bloqueo por reglas; requiere definición de política y pruebas reales.

**Grado de avance estimado:** 45% (detecto bloqueo real, falta definición/implementación de acceso para empresa).

---

## Sprint 4 — Mensajería por empresa (email/WhatsApp propios)
**Objetivo:** envíos salgan desde identidad de cada empresa.

**Checklist con avance**
- [✅] Datos de contacto por empresa existen en `companies` (admin/contact/billing) y settings (officialPhone, hrEmail).
  - Acción ejecutada: revisión de `AdminPanel.tsx` + `CompanySettings.tsx`.
- [✅] Cola `comms_outbox` existe y está protegida a SuperAdmin.
  - Acción ejecutada: revisión de `firestore.rules` y `AdminPanel.tsx`.
- [⚠️] Verificación real: `comms_outbox` tiene 1 doc en `queued`, 0 en `sent/error`.
  - Acción ejecutada: conteo real con Admin SDK; sugiere que el trigger `sendEmailFromOutbox` no se ejecuta o falla antes de marcar estado.
- [⚠️] Envío real usa cuenta global (`agroconnect@gmail.com`) vía Functions.
  - Acción ejecutada: revisión de `functions/src/index.ts` (SMTP Gmail).
- [❌] Envíos con identidad propia por empresa (from/WhatsApp Business por empresa).
  - Acción ejecutada: **no implementado**; requiere nuevo modelo y proveedor por empresa.

**Grado de avance estimado:** 35% (estructura base existe, falta identidad por empresa).

---

## Sprint 5 — Servicios externos (IA, geo, correo)
**Objetivo:** asegurar integraciones estables.

**Checklist con avance**
- [✅] IA para ofertas y difusiones usa Functions + Gemini.
  - Acción ejecutada: revisión de `geminiService.ts` y `functions/src/index.ts`.
- [✅] AI Review usa Functions y guarda historial en `audits`.
  - Acción ejecutada: revisión de `AIReview.tsx` y `functions/src/index.ts`.
- [✅] Geolocalización usa API del navegador.
  - Acción ejecutada: revisión de `geolocationService.ts`.
- [⚠️] Confirmar secretos configurados (GEMINI_API_KEY/GMAIL_APP_PASSWORD).
  - Acción ejecutada: **no ejecutable** sin acceso al proyecto Firebase.
- [⚠️] Verificación real: `comms_outbox` quedó en `queued`, revisar secrets/logs de `sendEmailFromOutbox` y Eventarc.
  - Acción ejecutada: hallazgo por conteo real (no hay `sent/error`).

**Grado de avance estimado:** 70% (integración lista, falta validación real de secretos).

---

## Sprint 6 — Limpieza y normalización (publicación/datos)
**Objetivo:** consistencia de datos y flags.

**Checklist con avance**
- [✅] UI pública filtra por `isPublic` en `companies`.
  - Acción ejecutada: revisión de `services/companies.ts`.
- [⚠️] Reglas aceptan `isPublic` o `public` (legacy).
  - Acción ejecutada: detectada dualidad en `firestore.rules`.
- [❌] Migración/normalización de datos legacy `public` → `isPublic`.
  - Acción ejecutada: **no implementado** (requeriría script de migración).

**Grado de avance estimado:** 50% (detección y claridad en UI, falta normalización).

---

## Resumen ejecutivo por pilar
- **Pilar 1 (Persistencia):** parcial. Persisten jobs/broadcasts, pero aún hay datos demo en App y falta validación real.  
- **Pilar 2 (Accesos):** base sólida en reglas/Functions, falta pruebas reales en Firebase.  
- **Pilar 3 (Servicios externos):** integrado en Functions/cliente, falta validación de secretos/ambiente.  
- **Pilar 4 (Mensajería por empresa):** falta identidad por empresa; hoy es centralizado.

---

## Comandos ejecutados para la revisión
- `rg -n "superadmin|allowlist|isSuperAdmin|company_admin|company_hr|worker" firestore.rules src functions -S`
- `sed -n '1,220p' firestore.rules`
- `sed -n '220,520p' firestore.rules`
- `sed -n '1,220p' src/components/LoginScreen.tsx`
- `sed -n '220,520p' src/components/LoginScreen.tsx`
- `sed -n '1,220p' functions/src/index.ts`
- `sed -n '400,940p' functions/src/index.ts`
- `sed -n '1,240p' src/services/workerAuth.ts`
- `sed -n '1,240p' src/components/Dashboard.tsx`
- `sed -n '1,220p' src/App.tsx`
- `sed -n '220,520p' src/App.tsx`
- `sed -n '1,200p' src/services/companies.ts`
- `sed -n '1,240p' src/components/CompanySettings.tsx`
- `rg -n "comms_outbox|mail|notificationEmail|whatsapp" src/components/AdminPanel.tsx`
- `sed -n '840,1000p' src/components/AdminPanel.tsx`
- `rg -n "broadcasts" -n src/components/Broadcasts.tsx`
- `sed -n '100,260p' src/components/Broadcasts.tsx`
- `sed -n '1,200p' src/services/geminiService.ts`
- `sed -n '1,200p' src/services/geolocationService.ts`
