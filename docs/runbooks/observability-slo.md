# Observabilidad y SLO iniciales

## Alcance

Este runbook define las senales minimas para operar MundoConnect sin registrar RUT, correo, telefono, contenido de mensajes ni payloads completos.

## SLO

| Flujo | Objetivo | Ventana |
| --- | --- | --- |
| Callables criticos | 99% de respuestas exitosas | 7 dias moviles |
| Postulacion, match y contratacion | p95 menor o igual a 2 segundos | 24 horas |
| Verificacion de identidad | p95 menor o igual a 3 segundos | 24 horas |
| Correos en outbox | 95% enviados antes de 5 minutos | 24 horas |
| Outbox bloqueado | Ningun documento en `sending` por mas de 15 minutos | Continuo |
| Estadisticas operacionales | Rezago menor o igual a 15 minutos | Continuo |

## Senales disponibles

- Functions usa eventos JSON `operational_event` con funcion, accion, resultado, codigo estable y duracion.
- El frontend registra errores globales, errores de render y Web Vitals basicos.
- `VITE_TELEMETRY_ENDPOINT` habilita envio por `sendBeacon`; sin esa variable los eventos quedan disponibles en consola solo durante desarrollo.
- `VITE_RELEASE_SHA` identifica la version desplegada.

## Alertas recomendadas en Google Cloud

1. Tasa de `outcome=failure` superior a 1% durante 10 minutos en callables criticos.
2. p95 de `durationMs` superior al SLO durante 15 minutos.
3. Cinco eventos `GEMINI_HTTP_ERROR` en 10 minutos.
4. Cualquier outbox en `sending` por mas de 15 minutos.
5. Dos ejecuciones consecutivas fallidas de Functions programadas.

## Respuesta

1. Confirmar ambiente y version mediante `VITE_RELEASE_SHA` y revision de Functions.
2. Buscar `operational_event` por funcion, accion, resultado y codigo; no buscar por datos personales.
3. Determinar si existe degradacion controlada o perdida de datos.
4. Si hay riesgo de duplicar correos o estados, detener el reproceso automatico antes de reintentar.
5. Registrar incidente, alcance, mitigacion y hora de recuperacion.

## Pendiente de infraestructura

Antes de produccion se debe configurar el endpoint de telemetria, crear las alertas anteriores en Google Cloud Monitoring y validar la retencion de logs por ambiente.
