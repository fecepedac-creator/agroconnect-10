# Auditoria integral de puesta en marcha de MundoConnect

Fecha: 2026-07-17
Rama auditada: `codex/dashboard-ux-hardening`
Commit auditado: `2397866`
Alcance: frontend React, Firebase Auth, Firestore, Rules, Cloud Functions, CI/CD, operaciones, producto, UX y modelo de matching.

## 1. Veredicto ejecutivo

MundoConnect tiene una base tecnica sustancial y varios flujos reales, pero no esta listo para un lanzamiento publico, operacion pagada ni captacion masiva. El estado recomendado es:

- Desarrollo local y emuladores: **GO**.
- Demo controlada sin datos personales reales: **GO con supervision**.
- Piloto cerrado con empresas y trabajadores reales: **NO-GO hasta cerrar los bloqueadores P0 y P1 marcados como gate**.
- Lanzamiento publico o servicio pagado: **NO-GO**.
- Expansion mas alla de agricultura y seguridad: **NO-GO**.

La principal conclusion es que el proyecto ya demuestra un ciclo basico de registro, oferta, postulacion, interes bilateral, contacto, contratacion y evaluacion. Sin embargo, todavia no garantiza contencion de empresas suspendidas, integridad de cupos, elegibilidad, consistencia de estados, recuperacion de datos, despliegue trazable ni atencion operacional.

## 2. Que esta realmente implementado

### Implementado y probado

- Registro e inicio de sesion de trabajadores.
- Acceso separado para empresa y SuperAdmin.
- Perfiles de trabajador y preferencias basicas.
- Publicacion de ofertas de agricultura y seguridad.
- Postulacion, invitacion, interes bilateral y liberacion condicionada del contacto.
- Marcado de contratacion y evaluacion bilateral basica.
- Membresias de empresa y custom claims.
- Denuncias, solicitudes de eliminacion y auditoria administrativa basica.
- Registro manual de facturas y pagos.
- Outbox de correo por SMTP.
- Reglas Firestore con una matriz relevante de abuso.
- CI con lint, build, Functions, Rules y E2E emulado.

### Parcial, prototipo o solo documentado

- Matching inteligente: actualmente es filtrado por sector y decisiones bilaterales, no ranking de compatibilidad.
- Suscripciones: existe libro manual, no cobro, renovacion ni conciliacion automatizada.
- WhatsApp: enlaces manuales `wa.me`, sin API, entrega, opt-out ni plantillas.
- Push: no implementado.
- Asistencia: hay permisos y un servicio local aislado, no un flujo auditable.
- Multiempresa: backend parcial, sin selector operativo de membresia.
- Multisector: solo agricultura y seguridad son dominio real; los demas son landings.
- Observabilidad, costos y retencion: principalmente documentos o entrada manual.
- Backup: script manual asincrono; no existe restore probado.
- Soporte e incidentes: runbook sin responsables ni canales confirmados.

## 3. Baseline ejecutado

| Control | Resultado |
|---|---|
| `npm run build` | PASS |
| `npm run lint` | PASS |
| `npm --prefix functions test` | PASS, 11/11 |
| `npm run test:rules` | PASS, 48/48 |
| `npm run test:e2e:emulated` | PASS, 33/33 |
| `npm run check:firebase-envs` | FAIL: staging y prod no configurados |
| `npm audit --omit=dev` | FAIL: 1 vulnerabilidad critica transitiva |
| `npm --prefix functions audit --omit=dev` | FAIL: 1 critica y 9 moderadas |

Advertencias adicionales:

- Functions solicita Node 22, pero el entorno local ejecuto Node 24.
- Firebase Emulator informa que `firebase-functions` esta desactualizado.
- El bundle Firebase supera 687 kB antes de gzip y Vite reporta chunks grandes.

## 4. Gobierno de codigo y despliegue

El repositorio no tiene rama `main`. La rama predeterminada remota es `fix/restore-agroconnect`, mientras los workflows de despliegue escuchan `main` y `release/*` (`.github/workflows/deploy.yml:3-7`). La rama auditada esta 31 commits por delante de la rama predeterminada y el PR #40 apunta a otra rama `codex/*`, no a una rama estable.

Firebase Hosting live fue actualizado el 2026-07-15 mediante CLI, pero la version publicada no contiene una etiqueta de commit. El HTML desplegado referencia assets distintos al build local. Por ello no se puede demostrar que el codigo auditado sea el codigo publicado.

Este punto debe corregirse antes de interpretar un CI verde como evidencia de produccion.

## 5. Matriz de madurez

Escala: 0 inexistente, 1 prototipo, 2 parcial, 3 piloto controlado, 4 produccion, 5 escala.

| Eje | Nivel | Diagnostico |
|---|---:|---|
| Propuesta y flujo principal | 3 | El ciclo basico existe, pero faltan estados y controles laborales. |
| Trabajador | 2 | Funcional, pero faltan errores, reintentos, notificaciones y accesibilidad validada. |
| Empresa | 2 | Puede operar ofertas y candidatos, pero hay riesgo de contexto, cupos y eliminacion. |
| SuperAdmin | 2 | Amplio, monolitico y con varias operaciones manuales o sin feedback. |
| Matching | 1 | Match bilateral funcional; compatibilidad y ranking aun no existen. |
| Seguridad y privacidad | 2 | Buenas reglas base, con brechas importantes de suspension, datos publicos y abuso. |
| Integridad de datos | 2 | Varias proyecciones sin una fuente canonica plenamente protegida. |
| Pruebas | 3 | Buen E2E feliz y Rules; faltan concurrencia, fallos, accesibilidad y unitarias frontend. |
| CI/CD | 2 | Checks utiles; ramas, ambientes, promocion y trazabilidad no estan resueltos. |
| Observabilidad y soporte | 1 | Mayormente runbook; no hay SLO, alertas ni owners operativos. |
| Backup y continuidad | 1 | Export manual; restore y RPO/RTO no demostrados. |
| Billing y cobro | 1 | Registro manual, no suscripcion comercial operativa. |
| Escala y costos | 1 | Listeners y consultas completas, sin paginacion sistematica ni budgets. |
| Multisector | 1 | Dos sectores reales; resto solo presentacion. |

## 6. Hallazgos P0: bloqueadores de lanzamiento

En este informe P0 significa bloqueador inmediato de puesta en marcha, aunque no siempre sea una vulnerabilidad explotada.

### P0-01. Suspender una empresa no revoca su acceso

Evidencia: `firestore.rules:70-78`, `functions/src/index.ts:513-517`, `functions/src/index.ts:862-875`, `functions/src/index.ts:1374-1380`.

La decision `suspend_company` cambia el estado del documento empresa, pero las reglas y `hasCompanyAccess` solo verifican que la membresia siga activa. La empresa puede conservar lectura y operaciones, incluido acceso a contactos de matches.

Accion requerida:

- Exigir membresia activa y empresa activa en Rules y callables.
- Revocar o suspender membresias al suspender la empresa.
- Revocar grants de contacto y forzar renovacion de tokens.
- Agregar Rules tests, integration tests y E2E de suspension inmediata.

Gate: una empresa suspendida no puede leer datos privados, operar matches, publicar, invitar ni recuperar contactos.

### P0-02. No existen staging y produccion separados

Evidencia: `.firebaserc:3-6`, `scripts/validate-firebase-environments.mjs:5-18`.

`dev` usa el proyecto actual y `staging`/`prod` son placeholders. El validador estricto falla. Solo existe evidencia de un proyecto Firebase de MundoConnect dentro de las credenciales disponibles.

Accion requerida:

- Crear proyectos Firebase separados para dev, staging y produccion.
- Configurar aliases, secretos, dominios Auth y configuracion web por ambiente.
- Prohibir fallbacks a un proyecto real cuando falten variables de staging/prod.
- Ejecutar smoke tests por ambiente con identidades distintas.

Gate: el validador pasa y cada ambiente tiene project ID, secretos, datos y Auth independientes.

### P0-03. No hay una rama estable ni trazabilidad del despliegue

Evidencia: rama predeterminada `fix/restore-agroconnect`; workflows en `.github/workflows/deploy.yml:3-7`; PR #40 encadenado a `codex/mundoconnect-launch-phases-1-3`.

El pipeline de produccion espera una rama que no existe. La version live fue desplegada por CLI y no registra commit. No se puede reproducir ni identificar con certeza la fuente de produccion.

Accion requerida:

- Crear `main` desde una linea de historia revisada.
- Integrar los PR encadenados de forma ordenada.
- Proteger `main` y prohibir pushes directos.
- Desplegar solo artefactos inmutables generados por CI.
- Etiquetar releases y registrar commit, proyecto, actor y rollback.

Gate: cada version live se mapea de forma inequivoca a un commit y un artefacto aprobado.

### P0-04. No existe recuperacion de datos demostrada

Evidencia: `ops/backup-firestore.ps1:23-36`, `docs/implementation/platform-v1-runbook.md:9-10,47-59`.

El export es manual y asincrono. No se verifica finalizacion, no hay restore, simulacro, RPO/RTO ni tag conocido. El repositorio no contiene tags.

Accion requerida:

- Automatizar export y verificar su finalizacion.
- Proteger el bucket con IAM y retencion.
- Definir RPO y RTO.
- Restaurar en un proyecto aislado y validar conteos/invariantes.
- Probar rollback de Hosting, Functions, Rules e indices desde un tag.

Gate: restore drill exitoso y documentado con tiempos medidos.

### P0-05. Soporte e incidentes no tienen responsables reales

Evidencia: `docs/implementation/trust-and-operations-runbook.md:5-15`.

Responsables y canales permanecen pendientes. Un sistema con denuncias, PII y empresas suspendibles no puede operar sin responsable de guardia y escalamiento.

Accion requerida:

- Asignar owner primario y suplente para soporte, privacidad, seguridad y pagos.
- Definir canales monitoreados y SLA.
- Ejecutar tabletop de denuncia grave, fuga de datos, fraude y caida.

Gate: canales probados y turnos aceptados por personas reales.

### P0-06. Clave Google/Gemini expuesta en historial Git

Evidencia: el `.env` local contiene un patron de Google API key; el archivo estuvo versionado en `364eac8` y `704c71b` y fue retirado del HEAD en `2414a68`. `ops/security-scan.ps1:10-14` no detecta patrones `AIza...`.

Aunque `.env` ahora este ignorado, la clave permanece recuperable desde clones, forks, caches o backups del historial.

Accion requerida:

- Revocar y rotar inmediatamente la clave sin reutilizarla.
- Restringir la nueva credencial por API, proyecto, cuota y servicio.
- Revisar consumo historico y alertas de facturacion.
- Incorporar Gitleaks o TruffleHog y patrones de Google API keys al CI.
- Evaluar limpieza de historial, asumiendo que rotar es obligatorio aun si se reescribe Git.

Gate: credencial anterior revocada, nueva clave restringida y escaneo integral del historial aprobado.

## 7. Hallazgos P1: riesgos altos

### P1-01. Empresas publicas pueden exponer el documento interno completo

Evidencia: `firestore.rules:388-392`, `docs/database-schema.md:17`, `src/services/companies.ts:18`.

Si `isPublic` es verdadero, se puede leer el documento `companies`, que puede contener RUT y contactos administrativos. Ya existe `publicCompanies`, pero el frontend no lo usa como unica proyeccion publica.

Remediacion: denegar lectura publica de `companies` y consumir solo `publicCompanies` con allowlist de campos.

### P1-02. Eliminar una oferta deja publicacion y subcolecciones huerfanas

Evidencia: `src/components/Jobs.tsx:2,22`, `functions/src/index.ts:1903`.

La UI borra directamente el documento. No existe trigger de delete y Firestore no borra subcolecciones. La oferta publica puede sobrevivir y las aplicaciones quedar huerfanas.

Remediacion: comando `closeJob` transaccional, despublicacion, expiracion de matches y auditoria. No usar delete cliente.

### P1-03. La contratacion no controla cupos

Evidencia: `functions/src/index.ts:823-859`, `src/components/Jobs.tsx:50`.

`markMatchHired` no incrementa `workersFilled`, no compara `workersNeeded` ni cierra la oferta al completar capacidad.

Remediacion: transaccion con oferta, match y aplicaciones; control concurrente de capacidad y reversa auditada.

### P1-04. Postulacion e invitacion no aplican politica de elegibilidad

Evidencia: `functions/src/index.ts:571`, `functions/src/index.ts:653`, `functions/src/index.ts:1207`.

No se valida de manera central disponibilidad, consentimiento vigente, sector, requisitos, OS10, credenciales ni cupos.

Remediacion: servicio `evaluateEligibility` versionado y explicable, usado por postulacion, invitacion y contratacion.

### P1-05. Se puede eludir el ciclo canonico mediante escrituras cliente

Evidencia: `firestore.rules:354-364`, `firestore.rules:432-442`.

Trabajadores pueden crear aplicaciones directamente y empresas actualizar estados sin pasar siempre por la maquina de estados de Functions.

Remediacion: negar mutaciones operativas cliente y usar comandos idempotentes de backend; o validar atomicidad completa con `getAfter`.

### P1-06. Registro y cambio de RUT no son atomicos

Evidencia: `src/services/workerAuth.ts:111-130`, `src/services/workerAuth.ts:223-226`.

Auth, perfiles e indice de RUT se escriben en secuencia. Un fallo deja cuenta parcial o RUT divergente.

Remediacion: reserva y actualizacion transaccional server-side, reconciliador y compensacion de cuentas incompletas.

### P1-07. Una empresa puede habilitar reputacion sin trabajo comprobado

Evidencia: `functions/src/index.ts:825`, `functions/src/index.ts:940-994`.

La empresa marca `hired` unilateralmente y la evaluacion queda disponible sin aceptacion, inicio ni finalizacion del trabajo.

Remediacion: estados `hire_proposed`, `hire_accepted`, `started`, `completed`, `cancelled`, `disputed`; evaluar solo tras finalizacion o cierre administrativo.

### P1-08. Falta indice para busqueda de trabajadores

Evidencia: `src/App.tsx:355`, `firestore.indexes.json:2`.

La consulta combina disponibilidad y orden temporal, pero el indice compuesto no esta versionado.

Remediacion: agregar el indice y test de integracion en staging. Los emuladores no garantizan detectar todos los indices productivos.

### P1-09. No hay App Check ni rate limiting

Evidencia: 25 callables en `functions/src/index.ts`; no hay `enforceAppCheck`, captcha, cuota por identidad ni throttling.

Autenticacion y reglas protegen autorizacion, pero no automatizacion abusiva, spam de postulaciones/denuncias ni consumo de Functions/IA.

Remediacion: App Check gradual, rate limits server-side por UID/IP/accion, limites de payload, idempotencia y alertas.

### P1-10. Dependencias con vulnerabilidades conocidas

Evidencia: `npm audit --omit=dev` y `npm --prefix functions audit --omit=dev`.

Existe `websocket-driver@0.7.4` transitivo por Firebase Realtime Database, con advisory critico; Functions presenta ademas nueve advisories moderados en la cadena Firebase/Google.

Remediacion: actualizar lockfiles y paquetes con pruebas completas; documentar excepciones solo si se demuestra no alcanzabilidad y fecha de expiracion.

### P1-11. Errores de datos se presentan como ceros o vacios reales

Evidencia: `src/App.tsx:279,337`, `src/components/Dashboard.tsx:19-30`, `src/components/WorkerPortal.tsx:116-121,183,206,602`.

Listeners sin callback de error y fallbacks a cero hacen indistinguible una coleccion vacia de una falla de permisos, indice o red.

Remediacion: estado explicito `loading/ready/empty/error/stale`, reintento y telemetria.

### P1-12. Acciones criticas del trabajador no controlan fallos o doble envio

Evidencia: `src/components/WorkerPortal.tsx:681-699`, `src/components/WorkerPortal.tsx:555-564`.

Postular y responder matches no tienen manejo consistente de error, busy state ni idempotencia visual.

Remediacion: comandos idempotentes, botones bloqueados durante envio, feedback accesible y reintentos seguros.

### P1-13. Contexto de oferta puede perderse al abrir candidatos

Evidencia: `src/components/Jobs.tsx:58`, `src/components/GlobalSearch.tsx:28`.

El callback no transporta `jobId` y la busqueda puede elegir la primera oferta, no la seleccionada.

Remediacion: ruta o estado con `jobId` obligatorio y test con multiples ofertas.

### P1-14. Email no tiene retry recuperable ni DLQ

Evidencia: `functions/src/index.ts:2432-2539`.

El trigger procesa solo creacion; fallos quedan en `error` y el watchdog no reintenta. Gmail SMTP agrega limites de cuota y reputacion.

Remediacion: proveedor transaccional, backoff, maximo de intentos, DLQ, idempotencia y alertas de antiguedad.

### P1-15. Borrado de datos personales no es reanudable

Evidencia: `functions/src/index.ts:1437-1488`.

Los borrados de documentos, Auth y auditoria son secuenciales sin checkpoints. Un fallo intermedio deja estado parcial.

Remediacion: workflow idempotente por etapas, checkpoints, reconciliacion y alerta de solicitudes atascadas.

### P1-16. Borrado declarado como completo conserva copias de PII

Evidencia: `functions/src/index.ts:1317-1319` guarda UID y email en `safety_reports`; el flujo de `functions/src/index.ts:1438-1488` no inventaria ni anonimiza todas las colecciones de auditoria, denuncias y comunicaciones.

Remediacion: inventario por UID/email, anonimizar segun politica legal, verificar ausencia posterior y cubrir excepciones de conservacion con fundamento y acceso restringido.

### P1-17. Ingreso publico de leads y preadmisiones permite spam y campos no controlados

Evidencia: `firestore.rules:301` y `firestore.rules:557-577` permiten creaciones no autenticadas con validacion incompleta; no hay App Check, CAPTCHA, rate limit, deduplicacion ni TTL.

Remediacion: endpoint controlado, esquema `hasOnly`, limites estrictos, validacion de formato, App Check/CAPTCHA, cuotas, deduplicacion, consentimiento y expiracion.

### P1-18. Algunas rutas multiempresa confian en `users` obsoleto

Evidencia: `firestore.rules:54-60`, `firestore.rules:537-545` y `firestore.rules:577` usan rol/companyId cacheado para comunicaciones o preadmisiones en lugar de exigir siempre membresia activa.

Remediacion: tratar `users.role/companyId` solo como cache; todas las autorizaciones deben comprobar membresia activa y estado activo de la empresa.

## 8. Hallazgos P2 y deuda estructural

- Tres representaciones del proceso (`matches` y dos aplicaciones) sin fuente canonica declarada: `functions/src/index.ts:610,629,845`.
- Estados `withdrawn`, `expired` y `closed` sin comandos ni scheduler: `functions/src/matchPolicy.ts:12`, `functions/src/index.ts:622`.
- Consultas y listeners sin paginacion: `src/components/WorkerPortal.tsx:120,206`, `src/components/CompanyMatches.tsx:62`.
- Busqueda limitada a 100 candidatos sin cursor ni ranking server-side.
- Multiempresa sin selector de membresia activa: `functions/src/index.ts:167-225`.
- Multisector limitado por tipos a agricultura y seguridad: `src/types.ts:84`, `functions/src/index.ts:1818`.
- Navegacion de empresa y SuperAdmin vive en estado de memoria, sin rutas profundas: `src/App.tsx:68,553`, `src/components/AdminPanel.tsx:398`.
- URL de oferta inexistente vuelve silenciosamente al listado: `src/components/WorkerPortal.tsx:674,954-980`.
- Targets tactiles menores a 44 px y ausencia de estado actual: `src/components/WorkerPortal.tsx:281-295`.
- Modales administrativos sin semantica, manejo de foco o Escape: `src/components/AdminPanel.tsx:2447,2664,2752`.
- `CompanyDashboard.tsx` no esta conectado al flujo real, creando implementacion divergente.
- `AdminPanel.tsx` supera 2.800 lineas; `functions/src/index.ts` supera 2.500 lineas.
- No hay pruebas unitarias frontend, axe, cobertura minima ni regresion visual.
- Solo las landings publicas se prueban como dispositivo movil completo.
- Billing es libro manual; no hay checkout, webhook, renovacion, reembolso ni conciliacion.
- WhatsApp es manual y push no existe.
- Costos, retencion e infraestructura se capturan manualmente o viven en runbooks.
- No hay logging estructurado general, SLO, uptime checks ni alertas productivas.
- CI/CD no despliega ni prueba de forma integrada Storage Rules y Realtime Database Rules.
- Functions usa `us-central1` mientras Firestore esta en `southamerica-west1`, lo que requiere medir latencia y costo interregional antes de fijar arquitectura.
- `src/firebase.ts:13-31` contiene fallback a un proyecto real; un build sin variables puede conectarse al ambiente equivocado.

## 9. Funcionalidades que faltan para un producto operativo

### Nucleo imprescindible para piloto

- Maquina de estados completa y unica para oferta, postulacion, match y contratacion.
- Control transaccional de cupos.
- Aceptacion de contratacion por trabajador.
- Cierre, cancelacion, retiro y expiracion con motivos.
- Notificaciones transaccionales de invitacion, match, contratacion y cambios.
- Politica de elegibilidad por sector y requisitos.
- Disponibilidad y preferencias actualizadas.
- Moderacion que realmente revoque acceso.
- Reintentos y estados de error visibles.

### Confianza

- Verificacion de empresa antes de activarla.
- Evidencia y vigencia de credenciales.
- Reputacion solo despues de trabajo finalizado.
- Disputa y apelacion.
- Prevencion de evaluaciones retaliatorias.
- Auditoria de acceso a PII y contactos.

### Operacion comercial

- Contrato, plan y limites de empresa.
- Facturacion definida para Chile, aunque el cobro inicial sea manual.
- Conciliacion y suspension por mora con procedimiento.
- Soporte, privacidad y SLA.
- Metricas de activacion, postulacion, match, contratacion y retencion.

## 10. Plan de accion para puesta en marcha

### Etapa 0. Control de fuente y alcance

Objetivo: obtener una unica linea de codigo y limitar el piloto.

Entregables:

- Crear `main`, ordenar los PR encadenados y proteger la rama.
- Elegir solo un sector y una zona para el primer piloto.
- Definir que funciones quedan fuera del piloto.
- Eliminar la posibilidad de deploy manual no trazado.
- Crear registro de decision arquitectonica para fuente canonica del matching.

Responsable: Lead de plataforma.
Gate: build reproducible desde `main` y mapa commit -> artefacto -> Firebase.

### Etapa 1. Contencion de seguridad y privacidad

Objetivo: cerrar acceso indebido y abuso antes de usar datos reales.

Entregables:

- Revocacion efectiva por suspension de empresa.
- Proyeccion publica segura de empresas.
- Mutaciones de aplicaciones solo por backend.
- App Check y rate limiting progresivos.
- Actualizacion de dependencias vulnerables.
- Borrado de datos reanudable.
- Tests de abuso para cada control.

Responsable: Security/Data.
Gate: cero P0 y cero P1 de exposicion o autorizacion abiertos.

### Etapa 2. Integridad del dominio laboral

Objetivo: impedir estados imposibles y sobrecontratacion.

Entregables:

- Agregado canonico y maquina de estados versionada.
- `closeJob`, `withdrawApplication`, expiracion y cancelacion.
- Cupos transaccionales y cierre automatico.
- Elegibilidad central y explicable.
- Alta/cambio de RUT server-side.
- Contratacion bilateral y evaluacion posterior a finalizacion.
- Reconciliador de proyecciones.

Responsable: Backend/Domain.
Gate: pruebas de concurrencia, idempotencia y recuperacion aprobadas.

### Etapa 3. Fiabilidad y simplicidad de experiencia

Objetivo: que trabajadores y empresas completen tareas sin soporte tecnico.

Entregables:

- Estados loading, empty, error, stale y retry en todos los paneles.
- Busy state e idempotencia en acciones criticas.
- Contexto de oferta preservado.
- Rutas profundas para empresa y SuperAdmin.
- Controles de al menos 44x44, foco visible y `aria-current`.
- Modales accesibles y navegacion con teclado.
- Pruebas con zoom 200%, Android, iPhone y usuarios 40+.

Responsable: Frontend/UX/QA.
Gate: al menos 80% de usuarios piloto completa registro y postulacion sin ayuda; ningun error silencioso.

### Etapa 4. Ambientes, CI/CD y continuidad

Objetivo: desplegar y recuperar de forma repetible.

Entregables:

- Proyectos dev, staging y prod separados.
- Pipeline unico: build once, test, approve, promote, smoke y rollback.
- Artifact y release inmutables con tag.
- Deploy de Hosting, Functions, Firestore, Storage y Database Rules.
- Backup programado y restore drill.
- Presupuesto, alertas y limites por ambiente.

Responsable: DevOps/SRE.
Gate: release de staging promovida sin rebuild y rollback/restore exitosos.

### Etapa 5. Comunicaciones y operacion humana

Objetivo: cerrar el ciclo fuera de la pantalla.

Entregables:

- Correo transaccional con retry, DLQ y alertas.
- Politica explicita para WhatsApp: manual en piloto o API formal.
- Consentimiento, preferencias y opt-out por canal.
- Owners, turnos, SLA, runbooks y simulacro.
- Cola de denuncias, privacidad y apelaciones con antiguedad visible.

Responsable: Product Ops + SRE.
Gate: mensajes trazables y un incidente simulado resuelto dentro del SLA.

### Etapa 6. Piloto cerrado

Objetivo: validar producto y operacion, no escalar marketing.

Alcance recomendado:

- Una zona del Maule.
- Un solo sector inicial.
- Dos o tres empresas verificadas.
- Grupo acotado de trabajadores incorporados con apoyo presencial o telefonico.
- Cobro manual o piloto gratuito; no prometer suscripcion automatica.

Metricas minimas:

- Finalizacion de registro.
- Tiempo hasta primera postulacion.
- Postulaciones utiles por oferta.
- Tiempo a interes mutuo.
- Matches con contacto exitoso.
- Contrataciones confirmadas por ambas partes.
- No-show, cancelacion y denuncia.
- Tickets de soporte por usuario.
- Costo Firebase por usuario activo y por match.

Gate: dos ciclos completos sin incidente P0, datos reconciliados y soporte sostenible.

### Etapa 7. Lanzamiento pagado y expansion

Objetivo: habilitar crecimiento solo despues de validar el nucleo.

Entregables:

- Planes y limites comerciales.
- Facturacion y conciliacion operativa.
- SLO y capacidad probados.
- Paginacion, indices y control de costos.
- Catalogo de sectores versionado.
- Incorporacion sector por sector, sin fallback silencioso a agricultura.

Gate: indicadores del piloto aprobados, go/no-go firmado y capacidad de soporte financiada.

## 11. Organizacion multiagente recomendada

| Frente | Responsabilidad | No debe aprobar su propio trabajo |
|---|---|---|
| Platform lead | Rama estable, arquitectura, integracion y releases | Cambios de seguridad |
| Security/Data | Rules, claims, PII, suspension, App Check y retencion | Go-live completo |
| Domain/Backend | Estados, cupos, elegibilidad, reconciliacion | UX final |
| Frontend/UX | Simplicidad, errores, accesibilidad y mobile | Reglas de datos |
| QA | Unit, integration, E2E, concurrencia y regresion | Implementacion auditada |
| SRE/Ops | Ambientes, alertas, backup, rollback y costos | Producto comercial |
| Product Ops | Piloto, soporte, empresas, SLA y metricas | Seguridad tecnica |

Regla de merge:

- Ningun cambio directo a `main`.
- Dos aprobaciones para Rules, Auth, billing, eliminacion y contacto.
- CI obligatorio y staging smoke obligatorio.
- Todo cambio de esquema incluye migracion, rollback y reconciliacion.

## 12. Checklist go/no-go

El piloto permanece en NO-GO si cualquiera es falso:

- [ ] Empresa suspendida pierde acceso inmediatamente.
- [ ] No existe lectura publica de PII empresarial o laboral.
- [ ] Staging y prod son proyectos distintos.
- [ ] La version desplegada se vincula a commit y artifact.
- [ ] Backup y restore fueron probados.
- [ ] Cupos y contrataciones son transaccionales.
- [ ] Matching valida consentimiento y elegibilidad.
- [ ] Acciones criticas tienen error, retry e idempotencia.
- [ ] Hay owner y canal real para soporte, privacidad e incidentes.
- [ ] Hay alertas de errores, outbox, denuncias y costos.
- [ ] E2E de suspension, concurrencia y errores pasa en staging.
- [ ] Trabajadores piloto completan tareas esenciales sin asistencia tecnica constante.

## 13. Prioridad inmediata

La secuencia correcta no es crear mas paginas Connect. Es:

1. Unificar fuente y ambientes.
2. Cerrar seguridad y privacidad.
3. Corregir integridad del ciclo laboral.
4. Hacer confiable y simple la experiencia.
5. Operar un piloto cerrado.
6. Solo entonces cobrar, escalar y agregar sectores.
