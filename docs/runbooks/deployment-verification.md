# Verificacion de despliegue y recuperacion

## Criterio de entrada

No iniciar una verificacion de produccion si CI, reglas, Functions o E2E fallaron. Registrar proyecto, URL de Hosting, commit, run de GitHub, responsable y targets desplegados. Nunca inferir el proyecto desde `.firebaserc`: usar el ID explicito del manifiesto de despliegue.

## Smoke HTTP publico

El smoke no inicia sesion, no escribe datos y no usa fixtures. Solo valida que Hosting y las rutas publicas respondan `200`, entreguen HTML y no redirijan a autenticacion.

```bash
node ops/post-deploy-smoke.mjs \
  --base-url https://sitio-staging.web.app \
  --routes /,/agro,/seguridad \
  --output smoke-staging.json
```

HTTP solo se permite para `localhost`. Una respuesta exitosa no valida Firebase Auth, Firestore, Functions ni flujos privados.

## Checklist post-deploy

1. Confirmar que proyecto, environment y URL coinciden con el manifiesto inmutable del run.
2. Ejecutar `post-deploy-smoke.mjs` en staging y adjuntar JSON al cambio.
3. Revisar errores de Hosting y Functions desde el momento del deploy, sin copiar datos personales al ticket.
4. Validar manualmente navegacion publica en escritorio y movil, incluida `/`, `/agro` y `/seguridad`.
5. Con cuentas controladas del entorno, validar login, rol trabajador, rol empresa y rechazo de acceso cruzado. No usar cuentas reales en staging.
6. Confirmar que Firestore Rules e indexes publicados corresponden al commit.
7. Verificar una operacion critica de lectura y escritura con datos de prueba aislados y eliminarlos mediante el procedimiento aprobado.
8. Registrar resultado, hora, ejecutor y enlaces a logs. Solo entonces promover el release.

## Verificacion post-restore

1. Confirmar que la importacion finalizo sin operaciones pendientes.
2. Comparar conteos y documentos de control contra el inventario del export.
3. Detectar documentos posteriores que no fueron eliminados por el import.
4. Validar reglas, indices, referencias y funciones consumidoras en el proyecto aislado.
5. Ejecutar smoke HTTP si existe una aplicacion de recuperacion asociada.
6. Medir RPO y RTO reales y adjuntar evidencia al ejercicio o incidente.

## Rollback

Un fallo de smoke detiene la promocion. Si staging falla, corregir y repetir CI/E2E; no desplegar produccion. Si produccion falla, evaluar primero rollback de Hosting/Functions al artefacto conocido, porque restaurar Firestore es una accion de datos independiente y de mayor riesgo. Cualquier restauracion a produccion requiere incidente declarado, aprobacion dual, export de preservacion y frase de confirmacion exacta.

## Escalamiento

| Severidad | Ejemplo | Accion inicial |
| --- | --- | --- |
| SEV-1 | Perdida/corrupcion amplia o acceso indebido | Incident Commander, congelar cambios, preservar evidencia, comunicar cada 30 min |
| SEV-2 | Flujo critico caido sin perdida confirmada | Rollback de release, comunicar cada 60 min, investigar datos |
| SEV-3 | Ruta secundaria o degradacion parcial | Ticket priorizado, mitigacion y seguimiento en horario operativo |

El cierre exige causa raiz, linea de tiempo, impacto, decisiones, acciones con responsable/fecha y actualizacion de este runbook si hubo una brecha de procedimiento.
