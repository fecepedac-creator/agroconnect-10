# Conectar Firestore con Admin SDK (Opción A)

Esta guía explica cómo habilitar acceso de lectura/escritura a Firestore usando el SDK Admin para ejecutar validaciones y checklist técnicos desde un entorno local o de CI.

## Requisitos
- Proyecto Firebase (idealmente **staging**).
- Permisos para crear una **Service Account key**.
- Node.js disponible (este repo usa Node para tooling).

## Paso 1: generar la clave de Service Account
1. Ve a **Firebase Console → Configuración del proyecto → Cuentas de servicio**.
2. En **SDK de Firebase Admin**, selecciona **Generar nueva clave privada**.
3. Descarga el archivo JSON y guárdalo localmente en una ruta segura (no lo subas a git).

## Paso 2: guardar la clave localmente
Guarda el JSON en una ruta fuera del repo o dentro de un directorio ignorado, por ejemplo:

```bash
mkdir -p credentials
# Copia aquí tu archivo JSON descargado, por ejemplo:
# credentials/firebase-admin.json
```

> Nota: si guardas el archivo en el repo, asegúrate de que esté en `.gitignore`.

## Paso 3: configurar la variable de entorno
Exporta la variable `GOOGLE_APPLICATION_CREDENTIALS` apuntando al JSON:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="credentials/firebase-admin.json"
```

## Paso 4: instalar el SDK Admin
```bash
npm install firebase-admin
```

## Paso 5: script mínimo de verificación
Crea un script para validar la conexión:

```ts
// scripts/firestore-admin-check.ts
import admin from "firebase-admin";

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

async function run() {
  const snapshot = await db.collection("companies").limit(5).get();
  console.log("companies:", snapshot.size);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Ejecuta:

```bash
node scripts/firestore-admin-check.ts
```

Si imprime un número sin error, la conexión con Firestore quedó operativa.

## Paso 6: ejecutar chequeos de Sprint (conteos rápidos)
El repo incluye un script para obtener métricas rápidas de Firestore (roles, companies, jobs, etc.):

```bash
node scripts/sprint-checks.mjs
```

El resultado se imprime en una tabla con los conteos actuales. Puedes pegar esa salida para actualizar el checklist de sprints.

## Buenas prácticas de seguridad
- Usa un **proyecto staging** para pruebas.
- No subas la clave privada al repositorio.
- Revoca la clave si se expone por accidente.
