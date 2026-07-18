# Resultado de hardening P0/P1

Fecha: 2026-07-17
Rama: `codex/p0-launch-hardening`
Estado: codigo listo para revision; despliegue bloqueado hasta validar staging.

## Alcance completado

- Autoridad de empresa basada en membresia activa y empresa activa.
- Revocacion operativa para empresas suspendidas o con pago vencido.
- Proyecciones publicas separadas para empresas, ofertas y trabajadores.
- Cierre auditable de ofertas sin borrado ni subcolecciones huerfanas.
- Elegibilidad central para postulacion, invitacion y contratacion.
- Control transaccional de cupos y cierre automatico al completar capacidad.
- Contratacion y termino de trabajo bilaterales, con disputa y evaluacion posterior.
- Reserva atomica de RUT chileno y proteccion contra colisiones.
- Consentimiento explicito para descubrimiento del perfil del trabajador.
- Estados visibles de carga, vacio, error y reintento en rutas criticas.
- CI con Rules, Functions, E2E emulado, auditoria y escaneo de secretos.
- Backup, restore aislado, smoke post-deploy y runbooks de recuperacion.

## Evidencia local

| Control | Resultado |
| --- | --- |
| Frontend lint | PASS, 0 errores |
| Frontend build | PASS |
| Functions lint | PASS, 0 errores y 45 advertencias heredadas |
| Functions unitarias | PASS, 29/29 |
| Firestore Rules | PASS, 63/63 |
| E2E Firebase emulado | PASS, 42/42 |
| Escaneo de secretos en arbol actual | PASS |
| Auditoria de dependencias high/critical | PASS, 0 high/critical |

Los E2E cubren escritorio y movil. Incluyen registro de trabajador agricola y
de seguridad, acceso de empresa, cierre de oferta, cupos concurrentes, RUT,
matching bilateral, contacto, reputacion, denuncias y eliminacion de datos.

## Gates externos pendientes

1. Crear y configurar proyectos Firebase independientes para `staging` y `prod`.
2. Rotar las credenciales historicas y restringir las nuevas por API, proyecto y cuota.
3. Sanear el historial Git. El escaneo detecta material en `.env`,
   `functions/.env.demo-mundoconnect` y `src/firebase.ts`; el arbol actual esta limpio.
4. Configurar secretos por ambiente, App Check y `ABUSE_HASH_SALT`.
5. Ejecutar deploy en staging, smoke publico, login por rol y restore drill aislado.
6. Definir responsables reales de soporte, privacidad, seguridad y pagos.

Produccion permanece en estado NO-GO mientras cualquiera de estos gates este abierto.

## Riesgos residuales no bloqueantes para revision

- El vendor chunk de Firebase supera 500 kB sin comprimir.
- Functions mantiene 45 advertencias `no-explicit-any` sin errores de lint.
- La auditoria de Functions informa 8 vulnerabilidades moderadas transitivas. La
  correccion propuesta por npm exige una actualizacion mayor y debe probarse en una
  rama separada.
- WhatsApp sigue siendo enlace manual; no existe API, opt-in, plantillas ni entrega.
- Billing sigue siendo un libro manual; no hay suscripcion ni conciliacion automatica.
- Ranking inteligente, push, SLO y alertas de produccion siguen fuera de esta ola.

## Secuencia de promocion

1. Revisar y aprobar el PR sin desplegar.
2. Cerrar credenciales, alias y responsables externos.
3. Promover el mismo commit a staging mediante GitHub Actions.
4. Ejecutar el checklist de `docs/runbooks/deployment-verification.md`.
5. Corregir cualquier fallo y repetir todas las compuertas.
6. Promover a produccion solo con evidencia de staging y rollback disponible.
