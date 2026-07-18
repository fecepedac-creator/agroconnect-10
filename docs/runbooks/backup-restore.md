# Runbook de backup y restauracion de Firestore

## Objetivo y alcance

Este procedimiento cubre la base `(default)` de Firestore. No incluye Authentication, Storage, secretos, configuracion de Functions ni archivos de Hosting; esos componentes requieren respaldos y procedimientos separados.

## Objetivos operacionales

| Objetivo | Meta inicial | Medicion |
| --- | --- | --- |
| RPO | 24 horas | Antiguedad del ultimo export exitoso de produccion |
| RTO tecnico | 4 horas | Desde autorizacion del incidente hasta validacion en proyecto de recuperacion |
| Retencion | 30 dias o politica superior del bucket | Lifecycle de Cloud Storage |
| Prueba de restauracion | Trimestral y antes de cambios de alto riesgo | Evidencia del run, conteos y smoke |

La meta debe revisarse con negocio. Un export diario no garantiza un RPO menor a 24 horas.

## Configuracion requerida

1. Crear buckets distintos para staging y produccion, en ubicacion compatible con Firestore.
2. Configurar `FIREBASE_PROJECT_ID_STAGING`, `FIREBASE_PROJECT_ID_PROD`, `FIRESTORE_BACKUP_BUCKET_STAGING` y `FIRESTORE_BACKUP_BUCKET_PROD` como secretos de GitHub.
3. Configurar `GCP_WORKLOAD_IDENTITY_PROVIDER` y `GCP_BACKUP_SERVICE_ACCOUNT` para OIDC sin llaves JSON persistentes.
4. Dar a la cuenta de backup permisos minimos para exportar Firestore y escribir en el bucket. Dar al servicio administrado de Firestore acceso al bucket segun la documentacion de Google Cloud.
5. Proteger los environments `staging` y `production`; produccion debe exigir aprobador.
6. Activar versionado, retencion y lifecycle del bucket conforme a la politica legal.

## Backup

El workflow `.github/workflows/backup-firestore.yml` ejecuta produccion diariamente a las `05:17 UTC`. Staging se ejecuta manualmente. No usa el alias `default`: siempre resuelve proyecto y bucket explicitos.

Para un backup manual, seleccionar el environment y escribir exactamente:

```text
BACKUP <project-id> TO gs://<bucket>
```

Cada ejecucion conserva como artifact el log y `export-metadata.json`, vinculados a run, intento y commit. Confirmar ademas que la ruta exportada contiene el archivo general de metadatos de Firestore antes de declarar el backup utilizable.

## Prueba trimestral de restauracion

1. Abrir ticket de cambio con responsable, export elegido, proyecto de recuperacion y ventana.
2. Crear o vaciar un proyecto aislado de recuperacion. No usar produccion ni staging como primera opcion.
3. Otorgar temporalmente al agente de Firestore del proyecto destino lectura sobre el export.
4. Ejecutar primero sin `-Apply`:

```powershell
./ops/restore-firestore.ps1 `
  -SourceProjectId "proyecto-origen" `
  -SourceBucket "gs://bucket-backup" `
  -ExportPath "gs://bucket-backup/firestore/prod/proyecto-origen/20260717T051700Z-run" `
  -TargetEnvironment dev `
  -TargetProjectId "proyecto-recuperacion" `
  -ExpectedTargetProjectId "proyecto-recuperacion" `
  -Confirmation "RESTORE proyecto-recuperacion FROM gs://bucket-backup/firestore/prod/proyecto-origen/20260717T051700Z-run"
```

5. Revisar el resumen y repetir con `-Apply` tras aprobacion.
6. Comparar colecciones criticas, conteos, documentos centinela no personales, timestamps y relaciones referenciales con la evidencia previa al incidente.
7. Ejecutar las pruebas de reglas contra emulador y el smoke HTTP de la aplicacion conectada al entorno de recuperacion.
8. Eliminar accesos temporales y registrar duracion real, perdida estimada y hallazgos.

## Restauracion excepcional in-place

La restauracion al mismo proyecto esta bloqueada salvo `-AllowInPlace`. Produccion ademas exige `-AllowProductionTarget`. Ambos switches son controles tecnicos, no reemplazan aprobacion de incidente, respaldo previo, congelamiento de escrituras y plan de reversa. Firestore import no elimina documentos extra existentes; una restauracion no equivale automaticamente a volver toda la base a un punto exacto.

## Incidentes y rollback

1. Declarar incidente y nombrar Incident Commander.
2. Detener despliegues y, si corresponde, escrituras de negocio sin perder evidencia.
3. Determinar si el problema requiere rollback de codigo, correccion de datos o restauracion. No importar datos para corregir un fallo solo de frontend/backend.
4. Tomar export de preservacion antes de una accion destructiva si el estado lo permite.
5. Restaurar primero en proyecto aislado y validar.
6. Para rollback de release, usar el procedimiento de despliegue y su manifiesto; el backup de Firestore no revierte Hosting ni Functions.
7. Comunicar estado, alcance y proxima actualizacion; conservar logs y artifacts del incidente.
8. Cerrar con postmortem, acciones preventivas y actualizacion de RPO/RTO.

