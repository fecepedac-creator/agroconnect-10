import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

/**
 * Inicialización central de Firebase (una sola fuente de verdad).
 * - Evita doble init en Vite/HMR
 * - Exporta app, db, auth para imports consistentes
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
