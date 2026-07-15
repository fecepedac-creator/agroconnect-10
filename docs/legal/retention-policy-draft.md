# Politica de retencion de datos (borrador operativo)

Este documento debe ser validado por asesoria legal chilena antes del lanzamiento comercial.

| Dato | Uso | Retencion propuesta | Accion final |
| --- | --- | --- | --- |
| Perfil trabajador activo | Match laboral | Mientras la cuenta este activa | Eliminacion o anonimizacion por solicitud |
| Postulaciones y matches | Trazabilidad del servicio | 24 meses desde cierre | Anonimizar identificador personal |
| Contact grants | Coordinacion tras match | 30 dias | Eliminar automaticamente |
| Evaluaciones | Confianza y calidad | Mientras sean utiles y licitas | Anonimizar con la cuenta |
| Denuncias | Seguridad e investigacion | 24 meses desde resolucion | Eliminar PII y conservar estadistica |
| Auditoria administrativa | Seguridad | 24 meses | Eliminar o agregar estadisticamente |
| Solicitud de eliminacion | Cumplimiento | Hasta completar o rechazar | Auditoria anonimizada |

## Controles

- Acceso minimo por rol y empresa.
- Datos de contacto liberados solo tras match mutuo.
- Resoluciones sensibles solo mediante Cloud Functions y SuperAdmin.
- Export Firestore verificado antes de cambios de alto riesgo.
- Revision trimestral de registros vencidos y accesos administrativos.
