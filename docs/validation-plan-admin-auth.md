# Plan de validación: flujo /admin vs login público

## Objetivo
Verificar que la ruta `/admin` nunca renderiza la landing pública (`LoginScreen`) y que los guards de admin muestran los estados correctos de carga/autorización, sin afectar el comportamiento de rutas públicas.

## Precondiciones
- Disponer de tres cuentas:
  - **Superadmin** (allowlisted y con claims correspondientes).
  - **Admin allowlisted** (sin superadmin).
  - **Usuario no allowlisted** (sin permisos admin).
- Tener acceso al entorno donde se despliega la app o un entorno local funcional.
- Si aplica, poder activar/desactivar `demoMode` desde la configuración admin.

## Casos de prueba

### 1) Visitante sin sesión en `/admin`
1. Abrir una ventana incógnito.
2. Navegar directamente a `/admin`.
3. Confirmar que se muestra **"Cargando acceso..."** (o el loader de admin) y luego el flujo de acceso correspondiente.
4. Confirmar que **no** aparece la landing pública en ningún momento.
5. Confirmar que la URL permanece en `/admin` durante todo el proceso.

### 2) Superadmin allowlisted
1. Iniciar sesión como superadmin.
2. Ir a `/admin` y recargar (hard refresh) 3-5 veces.
3. Confirmar que el panel de admin/superadmin carga después del estado de “Cargando acceso…”.
4. Confirmar que **no** aparece la landing pública en ningún refresh.

### 3) Admin allowlisted (sin superadmin)
1. Iniciar sesión como admin allowlisted.
2. Ir a `/admin` y recargar varias veces.
3. Confirmar que el panel correspondiente se renderiza correctamente después del loader.
4. Confirmar que **no** aparece la landing pública.

### 4) Usuario no allowlisted
1. Iniciar sesión con usuario sin permisos admin.
2. Ir a `/admin`.
3. Confirmar que aparece **"No autorizado"** (o el mensaje de denegación) y que no se muestra la landing pública.

### 5) Rutas públicas con `userRole === null`
1. Cerrar sesión.
2. Navegar a `/` y a `/empresas`.
3. Confirmar que la landing pública (`LoginScreen`) sigue apareciendo normalmente.

### 6) Verificación con `demoMode` (si aplica)
1. Activar `demoMode`.
2. Repetir los casos 1-4.
3. Confirmar que la UI pública usa datos demo sin interferir con el guard de `/admin`.

## Criterios de éxito
- `/admin` nunca muestra la landing pública, aun con refreshes.
- Los estados de `/admin` son consistentes: “Cargando acceso…”, “No autorizado” o panel, según el caso.
- Las rutas públicas conservan el comportamiento previo (landing cuando `userRole === null`).
- La URL de `/admin` no es reemplazada por `/` durante la carga.

## Evidencia recomendada
- Capturas de pantalla del estado inicial y final en cada caso.
- Registro breve del resultado (pass/fail) por caso.
