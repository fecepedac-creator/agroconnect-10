# Protección contra abuso en Functions

## Objetivo

El módulo entrega controles reutilizables para callable Functions sin almacenar IP,
correo ni UID en claro:

- App Check con migración gradual `report` -> `enforce`.
- Rate limit transaccional por identidad, acción y ventana.
- Validación de claves de idempotencia.
- Límites de tamaño y complejidad del payload.
- Errores `HttpsError` estables y accionables para el cliente.
- Campo `expiresAt` preparado para una política TTL de Firestore.

`abusePolicy.ts` no depende de Firebase y contiene la política testeable.
`abuseProtection.ts` implementa App Check, SHA-256 y acceso transaccional a
Firestore.

## Configuración recomendada

Configurar `ABUSE_HASH_SALT` como secreto aleatorio de al menos 32 caracteres,
distinto por ambiente. No reutilizar API keys, contraseñas ni secretos de firma.
Configurar `APP_CHECK_MODE=report` al comenzar.

Progresión sugerida:

1. Mantener `report` entre 7 y 14 días y medir `app_check_missing` por versión.
2. Corregir clientes legítimos sin token App Check.
3. Activar `enforce` primero en staging y en operaciones de escritura de bajo volumen.
4. Validar métricas, soporte y falsos positivos.
5. Extender `enforce` a producción y al resto de callables sensibles.

No se debe usar IP o correo como identidad persistida. Para usuarios autenticados,
usar `request.auth.uid` únicamente como entrada del hash. Para tráfico anónimo,
generar un identificador de instalación rotatorio validado por App Check. La sal
impide correlacionar hashes entre ambientes o reconstruir identificadores comunes.

## Integración exacta en `index.ts`

Importar el helper:

```ts
import {protectCallable} from "./abuseProtection.js";
```

Invocarlo al inicio del callback, después de exigir autenticación y antes de leer o
escribir datos de negocio:

```ts
export const applyToJob = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

  await protectCallable(request, {
    action: "apply-to-job",
    identity: uid,
    appCheckMode: process.env.APP_CHECK_MODE || "report",
    idempotencyKey: request.data?.idempotencyKey,
    requireIdempotencyKey: true,
    payloadLimits: {maxBytes: 8 * 1024, maxDepth: 5},
    rateLimit: {limit: 5, windowSeconds: 60, ttlSeconds: 86_400},
  });

  // Operación transaccional de negocio existente.
});
```

La clave de idempotencia debe además registrarse dentro de la misma transacción de
negocio, con resultado y expiración, para impedir que dos solicitudes válidas
produzcan dos efectos. Este módulo valida su formato, pero deliberadamente no decide
la semántica ni la colección de idempotencia de cada operación.

Para cada callable se debe definir una acción estable en minúsculas. No incluir UID,
correo, empresa ni parámetros dinámicos en `action`; esos datos pertenecen a
`identity` y sólo participan del hash.

## Políticas iniciales

| Acción | Límite inicial | Ventana | Idempotencia |
| --- | ---: | ---: | --- |
| `apply-to-job` | 5 | 60 s | Obligatoria |
| `invite-worker` | 20 | 60 s | Obligatoria |
| `submit-safety-report` | 3 | 10 min | Obligatoria |
| `request-data-deletion` | 2 | 24 h | Obligatoria |
| Lecturas sensibles | 60 | 60 s | Opcional |

Los valores son un punto de partida. Deben ajustarse con percentiles reales y alertas,
no aumentando límites después de un incidente sin analizar la causa.

## TTL y privacidad

Habilitar una política TTL para la colección `abuseRateLimits` usando el campo
`expiresAt`. El documento contiene sólo:

- contador;
- inicio de ventana;
- última actualización;
- expiración TTL.

El ID es SHA-256 de `sal + identidad + acción + inicio de ventana`. No registrar la
identidad original en logs asociados al rate limit. La eliminación TTL no es
instantánea, por lo que `expiresAt` debe tratarse como retención máxima esperada y no
como un borrado sin demora.

## Costos y operación

Cada solicitud protegida consume normalmente una lectura y una escritura
transaccional de Firestore. Una solicitud ya excedida consume al menos una lectura.
Aplicar el helper indiscriminadamente a lecturas de alto volumen puede aumentar el
costo y la latencia; priorizar escrituras, contacto, denuncias, autenticación y
operaciones financieras. Vigilar contención, reintentos de transacción, lecturas,
escrituras y documentos TTL.

Alertar por aumentos de `resource-exhausted`, `app_check_missing`, errores internos de
protección y costo por acción. Nunca usar modo fail-open silencioso en operaciones que
creen matches, revelen contacto, modifiquen pagos o cambien privilegios.

## Verificación antes de activar `enforce`

- App Check configurado para web y proveedores permitidos.
- Clientes vigentes enviando token válido.
- `ABUSE_HASH_SALT` presente en staging y producción.
- TTL habilitado en `abuseRateLimits.expiresAt`.
- Pruebas de concurrencia y del límite exacto ejecutadas contra emulador.
- Cliente interpreta `failed-precondition`, `invalid-argument` y
  `resource-exhausted` sin reintentos agresivos.
- Dashboard de errores y costos segmentado por acción.
