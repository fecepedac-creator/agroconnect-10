import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { browserLocalPersistence, connectAuthEmulator, getAuth, setPersistence, type Auth } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from "firebase/functions";

/**
 * Inicialización central de Firebase (una sola fuente de verdad).
 * - Evita doble init en Vite/HMR
 * - Exporta app, db, auth (y helpers) para imports consistentes
 *
 * Proyecto: agroconnect-10-14242150-423d4
 */
const developmentDefaults = {
  apiKey: "AIzaSyApfbowH8aWZBjfyjAgggpUXLkDWjDYGmA",
  authDomain: "agroconnect-10-14242150-423d4.firebaseapp.com",
  projectId: "agroconnect-10-14242150-423d4",
  storageBucket: "agroconnect-10-14242150-423d4.firebasestorage.app",
  messagingSenderId: "517674718866",
  appId: "1:517674718866:web:b8d82bf49234458b28b84b",
};

// Deploy workflows provide these values per environment. Defaults keep local
// development compatible with the existing Firebase project.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || developmentDefaults.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || developmentDefaults.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || developmentDefaults.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || developmentDefaults.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || developmentDefaults.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || developmentDefaults.appId,
};

export const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);
export const functions: Functions = getFunctions(app, "us-central1");

const useFirebaseEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";
const emulatorState = globalThis as typeof globalThis & {__mundoconnectEmulatorsConnected?: boolean};

if (useFirebaseEmulators && !emulatorState.__mundoconnectEmulatorsConnected) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", {disableWarnings: true});
  connectFirestoreEmulator(db, "127.0.0.1", 8085);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  emulatorState.__mundoconnectEmulatorsConnected = true;
}

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn("[Auth] Failed to set local persistence:", error);
});

type AuthDebugPayload = {
  email: string | null;
  uid: string | null;
  claims: Record<string, unknown>;
  issuedAt: string | null;
  expiresAt: string | null;
};

export async function debugAuthClaims(): Promise<AuthDebugPayload | null> {
  if (!import.meta.env.DEV) {
    return null;
  }

  const user = auth.currentUser;
  if (!user) {
    console.warn("[Auth Debug] No hay usuario autenticado.");
    return null;
  }

  const token = await user.getIdTokenResult(true);
  const payload: AuthDebugPayload = {
    email: user.email ?? null,
    uid: user.uid ?? null,
    claims: (token?.claims || {}) as Record<string, unknown>,
    issuedAt: token?.issuedAtTime ?? null,
    expiresAt: token?.expirationTime ?? null,
  };
  console.info("[Auth Debug] Claims:", payload);
  return payload;
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as any).__auth = auth;
  (window as any).__debugAuthClaims = debugAuthClaims;
}

/**
 * Sincroniza el acceso del usuario autenticado:
 * - Si su email coincide con adminEmail de alguna empresa => role=company_admin + companyId
 * - Si no coincide => role=worker (por defecto)
 *
 * Esta lógica corre del lado servidor (Cloud Function) para NO depender de reglas ni exponer privilegios.
 * 
 * IMPORTANTE: Esta función también actualiza los custom claims del token de Auth.
 * Después de llamarla, se hace un refresh automático del token para obtener los claims actualizados.
 */
export async function syncUserAccess(): Promise<{
  ok: boolean;
  role: "company_admin" | "company_hr" | "worker" | "none";
  companyId: string | null;
  claimsUpdated?: boolean;
}> {
  const fn = httpsCallable(functions, "syncUserAccess");
  const res = await fn({});
  const data = res.data as {
    ok: boolean;
    role: "company_admin" | "company_hr" | "worker" | "none";
    companyId: string | null;
    claimsUpdated?: boolean;
  };
  
  // Refresh token only when backend confirms custom claims update.
  if (data.ok && data.claimsUpdated === true && auth.currentUser) {
    try {
      await auth.currentUser.getIdToken(true);
      console.info("[Auth] Token refreshed after syncUserAccess - claims updated");
    } catch (e) {
      console.warn("[Auth] Failed to refresh token after syncUserAccess:", e);
    }
  }
  
  return data;
}

/**
 * Setea claims de superadmin si el email está en la allowlist del servidor.
 * 
 * IMPORTANTE: Esta función actualiza los custom claims del token de Auth.
 * Después de llamarla, se hace un refresh automático del token para obtener los claims actualizados.
 */
export async function syncSuperadminClaims(): Promise<{ ok: boolean }> {
  const fn = httpsCallable(functions, "syncSuperadminClaims");
  const res = await fn({});
  const data = res.data as { ok: boolean };
  
  // Force token refresh to get updated claims
  if (data.ok && auth.currentUser) {
    try {
      await auth.currentUser.getIdToken(true);
      console.info("[Auth] Token refreshed after syncSuperadminClaims - claims updated");
    } catch (e) {
      console.warn("[Auth] Failed to refresh token after syncSuperadminClaims:", e);
    }
  }
  
  return data;
}

/**
 * Permite agregar o quitar permisos de superadmin a un usuario por email.
 * Solo puede ser ejecutado por un superadmin existente.
 * 
 * IMPORTANTE: Esta función actualiza los custom claims del usuario objetivo.
 * Si el usuario objetivo está autenticado actualmente, necesitará refrescar su token.
 */
export async function setSuperadminByEmail(
  email: string,
  makeSuperadmin = true
): Promise<{ ok: boolean; uid: string; email: string; superadmin: boolean }> {
  const fn = httpsCallable(functions, "setSuperadminByEmail");
  const res = await fn({ email, makeSuperadmin });
  return res.data as { ok: boolean; uid: string; email: string; superadmin: boolean };
}

/**
 * Fuerza un refresh del token de autenticación.
 * Útil cuando se sabe que los claims han sido actualizados en el servidor.
 * 
 * @returns Los claims actualizados o null si no hay usuario autenticado
 */
export async function forceTokenRefresh(): Promise<Record<string, unknown> | null> {
  const user = auth.currentUser;
  if (!user) {
    console.warn("[Auth] No authenticated user to refresh token");
    return null;
  }
  
  try {
    const tokenResult = await user.getIdTokenResult(true);
    console.info("[Auth] Token force-refreshed successfully");
    return (tokenResult?.claims || {}) as Record<string, unknown>;
  } catch (e) {
    console.error("[Auth] Failed to force refresh token:", e);
    throw e;
  }
}
