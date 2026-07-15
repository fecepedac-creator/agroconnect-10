# Runbook de confianza y operacion

## Responsables requeridos

Antes del piloto se deben completar nombres y canales reales:

| Funcion | Responsable | Canal | SLA inicial |
|---|---|---|---|
| Soporte a trabajadores | Pendiente | Pendiente | 1 dia habil |
| Soporte a empresas | Pendiente | Pendiente | 1 dia habil |
| Privacidad y eliminacion | Pendiente | Pendiente | Acuse en 2 dias habiles |
| Seguridad e incidentes | Pendiente | Pendiente | Evaluacion inmediata |
| Revision empresarial | Pendiente | Pendiente | Antes de publicar |

## Verificacion de empresa

1. Recibir solicitud sin conceder acceso automatico.
2. Confirmar razon social, RUT, representante y canal corporativo.
3. Verificar centro de trabajo y responsable de contratacion.
4. Revisar manualmente la primera oferta: remuneracion, jornada, lugar, traslado,
   implementos, requisitos y contacto.
5. Registrar evidencia minima y decision sin subir documentos sensibles innecesarios.
6. Crear membresia de empresa solo despues de aprobar.
7. Suspender ante cambios anormales de contacto, pago o ubicacion.

## Denuncias y apelacion

Prioridad alta:

- Cobro al trabajador.
- Oferta o empresa falsa.
- Condiciones diferentes a las publicadas.
- Discriminacion, acoso o amenaza.
- Extraccion o divulgacion de datos.

Procedimiento:

1. Registrar denunciante, entidad denunciada, categoria y evidencia disponible.
2. Ocultar preventivamente la oferta cuando exista riesgo actual.
3. Evitar prometer una conclusion antes de revisar a ambas partes.
4. Documentar decision, responsable, fecha y medidas.
5. Permitir apelacion por un canal humano.
6. Escalar hechos posiblemente delictivos o emergencias a autoridades competentes; la
   plataforma no reemplaza canales de emergencia.

## Solicitudes de privacidad

1. La solicitud desde el perfil crea `data_deletion_requests/{uid}`.
2. El perfil queda `discoverable=false` y se elimina su proyeccion de busqueda.
3. Confirmar identidad sin solicitar mas informacion de la necesaria.
4. Clasificar datos: eliminables, anonimizables o sujetos a retencion justificada.
5. Procesar Auth, `users`, `workers`, documentos y referencias operativas.
6. Registrar resultado y notificar al solicitante.
7. Nunca borrar auditorias o evidencia de seguridad sin validar la obligacion aplicable.

## Incidente de seguridad

1. Contener: suspender credenciales, funcion o acceso afectado.
2. Preservar logs y no modificar evidencia original.
3. Determinar personas, datos, periodo y sistemas involucrados.
4. Rotar secretos comprometidos y revocar sesiones cuando corresponda.
5. Restaurar desde version conocida y ejecutar smoke tests.
6. Evaluar comunicaciones legales y a afectados con asesoria competente.
7. Documentar causa raiz y acciones preventivas.

## Gate diario del piloto

- Ofertas activas verificadas.
- Disponibilidad de trabajadores actualizada.
- Denuncias P0/P1 sin atraso.
- Cola de comunicaciones sin elementos estancados.
- Errores de Auth, Functions y Firestore revisados.
- Copia de seguridad y version desplegada identificables.

