# Lote A - Matriz de Validacion (Security + Tests)

Fecha: 2026-03-08
Scope: hardening de `worker_usernames` y `companies/{companyId}/jobs/{jobId}/applications/{appId}`.

## Cambios de reglas aplicados

1. `worker_usernames`
- `read`: solo owner (`resource.data.uid == myUid()`).
- `create`: solo si no existe mapping previo y owner/email validos.
- `update`: solo owner y sin cambiar `uid` ni `email`.

2. `applications` (companies/jobs)
- `update` de worker: permitido solo si no modifica campos de decision/identidad (`status`, `attendanceStatus`, `workerId`, `companyId`, `jobId`, `createdAt`, `decisionBy`, `decisionAt`).

## Casos de abuso (deben FALLAR)

1. Worker A intenta leer `worker_usernames/{rut}` de Worker B.
2. Worker A intenta crear mapping de un `rut` ya existente.
3. Worker A intenta actualizar `worker_usernames/{rut}` cambiando `email`.
4. Worker A intenta actualizar `applications/{appId}` cambiando `status`.
5. Worker A intenta actualizar `applications/{appId}` cambiando `attendanceStatus`.

## Casos legítimos (deben PASAR)

1. Owner de `worker_usernames/{rut}` lee su propio mapping.
2. Worker crea su mapping inicial de RUT cuando no existe.
3. Worker actualiza `applications/{appId}` solo en campos no sensibles (ej. nota/comentario no crítico).
4. Company admin actualiza `status` de application.
5. Superadmin actualiza application sin restricciones de worker.

## Evidencia esperada

- Emulador rules: resultados `allow`/`deny` por caso.
- Registro en PR con tabla:
  - Caso
  - Resultado esperado
  - Resultado obtenido
  - Evidencia (log/captura)

## Criterio de aceptación del Lote A

- 100% de casos de abuso bloqueados.
- 100% de casos legítimos críticos permitidos.
- Sin regresión en lectura/gestión de applications para empresa/superadmin.
