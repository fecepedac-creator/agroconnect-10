import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { browserLocalPersistence, getAuth, setPersistence, type Auth } from "firebase/auth";
import { getFunctions, httpsCallable, type Functions } from "firebase/functions";

/**
 * Inicialización central de Firebase (una sola fuente de verdad).
 * - Evita doble init en Vite/HMR
 * - Exporta app, db, auth (y helpers) para imports consistentes
 *
 * Proyecto: agroconnect-10-14242150-423d4
 */
const firebaseConfig = {
  apiKey: "AIzaSyApfbowH8aWZBjfyjAgggpUXLkDWjDYGmA",
  authDomain: "agroconnect-10-14242150-423d4.firebaseapp.com",
  projectId: "agroconnect-10-14242150-423d4",
  storageBucket: "agroconnect-10-14242150-423d4.firebasestorage.app",
  messagingSenderId: "517674718866",
  appId: "1:517674718866:web:b8d82bf49234458b28b84b",
};

export const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn("[Auth] Failed to set local persistence:", error);
});

// Cloud Functions (para aprovisionamiento seguro de roles/usuarios)
export const functions: Functions = getFunctions(app, "us-central1");

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
 */
export async function syncUserAccess(): Promise<{
  ok: boolean;
  role: "company_admin" | "worker" | "none";
  companyId: string | null;
}> {
  const fn = httpsCallable(functions, "syncUserAccess");
  const res = await fn({});
  return res.data as any;
}

export async function syncSuperadminClaims(): Promise<{ ok: boolean }> {
  const fn = httpsCallable(functions, "syncSuperadminClaims");
  const res = await fn({});
  return res.data as any;
}

export async function setSuperadminByEmail(
  email: string,
  makeSuperadmin = true
): Promise<{ ok: boolean; uid: string; email: string; superadmin: boolean }> {
  const fn = httpsCallable(functions, "setSuperadminByEmail");
  const res = await fn({ email, makeSuperadmin });
  return res.data as any;
}
