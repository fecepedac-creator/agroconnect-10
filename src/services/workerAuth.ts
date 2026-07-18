import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { auth, db, functions } from "../firebase";

export type WorkerRegisterInput = {
  fullName: string;
  rut?: string;
  phone?: string;
  email: string;
  password: string;
  commune: string;
  primaryTrade: string;
  sectors: Array<"agriculture" | "security">;
  mobility: "needs_transport" | "public_transport" | "own_transport";
  consent: {
    version: string;
    matching: true;
    operationalMessages: boolean;
    marketing: boolean;
  };
};

type WorkerProfile = {
  uid: string;
  displayName: string;
  fullName: string;
  rut?: string;
  email: string;
  phone?: string;
  commune?: string;
  primaryTrade?: string;
  sectors?: Array<"agriculture" | "security">;
  mobility?: "needs_transport" | "public_transport" | "own_transport";
  available?: boolean;
  os10Status?: "none" | "in_process" | "valid" | "expired";
  preferredShift?: "day" | "night" | "rotating" | "any";
  role: "worker";
  authProviders: string[];
  consent?: WorkerRegisterInput["consent"] & {acceptedAt: any};
  discoverable?: boolean;
  createdAt?: any;
  updatedAt?: any;
  lastSeen?: any;
};

const USERS_COLLECTION = "users";
const WORKERS_COLLECTION = "workers";

const upsertWorkerDocs = async (uid: string, data: Partial<WorkerProfile>) => {
  const safeData = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as Partial<WorkerProfile>;
  await setDoc(doc(db, USERS_COLLECTION, uid), safeData, { merge: true });
  await setDoc(doc(db, WORKERS_COLLECTION, uid), safeData, { merge: true });
};

const saveWorkerIdentity = httpsCallable<
  | {mode: "register"; email: string; rut?: string; profile: Omit<WorkerRegisterInput, "password" | "email" | "rut">}
  | {mode: "update_rut"; email: string; rut: string},
  {ok: boolean; uid: string; email: string; rut: string | null}
>(functions, "upsertWorkerIdentity");

export async function registerWorker(input: WorkerRegisterInput) {
  const email = input.email.trim().toLowerCase();

  const cred = await createUserWithEmailAndPassword(auth, email, input.password);
  try {
    await saveWorkerIdentity({
      mode: "register",
      email,
      rut: input.rut,
      profile: {
        fullName: input.fullName,
        phone: input.phone,
        commune: input.commune,
        primaryTrade: input.primaryTrade,
        sectors: input.sectors,
        mobility: input.mobility,
        consent: input.consent,
      },
    });
  } catch (error) {
    const code = String((error as {code?: unknown})?.code || "");
    const deterministicFailure = [
      "functions/already-exists",
      "functions/invalid-argument",
      "functions/permission-denied",
    ].includes(code);
    if (deterministicFailure) {
      try {
        await deleteUser(cred.user);
      } catch (cleanupError) {
        console.error("No se pudo compensar la cuenta Auth tras fallar el perfil.", cleanupError);
      }
    }
    throw error;
  }

  return cred.user;
}

export async function loginWorker(identifier: string, password: string) {
  const email = identifier.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Ingresa un correo válido.");
  }
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  await upsertWorkerDocs(uid, { lastSeen: serverTimestamp(), updatedAt: serverTimestamp() });
  return cred.user;
}


export async function sendWorkerPasswordReset(identifier: string) {
  const email = identifier.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Ingresa un correo válido.");
  }
  await sendPasswordResetEmail(auth, email);
  return email;
}


export async function signInWorkerWithGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  const user = cred.user;
  const uid = user.uid;

  const docRef = doc(db, WORKERS_COLLECTION, uid);
  const snap = await getDoc(docRef);

  const displayName = user.displayName || "Trabajador";
  const email = user.email?.toLowerCase() || "";
  const phone = user.phoneNumber || undefined;

  const providers = new Set<string>(snap.exists() ? (snap.data()?.authProviders || []) : []);
  providers.add("google");

  const profileUpdate: Partial<WorkerProfile> = {
    uid,
    displayName,
    fullName: snap.exists() ? snap.data()?.fullName || displayName : displayName,
    email,
    phone,
    role: "worker",
    authProviders: Array.from(providers),
    updatedAt: serverTimestamp(),
    lastSeen: serverTimestamp(),
  };

  if (!snap.exists()) {
    profileUpdate.createdAt = serverTimestamp();
  }

  await upsertWorkerDocs(uid, profileUpdate);

  return { user };
}

export type WorkerProfileUpdateInput = {
  fullName: string;
  phone?: string;
  commune: string;
  primaryTrade: string;
  sectors: Array<"agriculture" | "security">;
  mobility: "needs_transport" | "public_transport" | "own_transport";
  available: boolean;
  os10Status: "none" | "in_process" | "valid" | "expired";
  preferredShift: "day" | "night" | "rotating" | "any";
};

export async function updateWorkerProfile(uid: string, input: WorkerProfileUpdateInput) {
  await upsertWorkerDocs(uid, {
    displayName: input.fullName.trim(),
    fullName: input.fullName.trim(),
    phone: input.phone?.trim() || undefined,
    commune: input.commune.trim(),
    primaryTrade: input.primaryTrade.trim(),
    sectors: input.sectors,
    mobility: input.mobility,
    available: input.available,
    os10Status: input.os10Status,
    preferredShift: input.preferredShift,
    updatedAt: serverTimestamp(),
  });
}

export async function updateWorkerRut(uid: string, rut: string, email: string) {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error("La sesión no corresponde al perfil que intentas actualizar.");
  }
  await saveWorkerIdentity({mode: "update_rut", rut, email});
}

export async function logoutWorker() {
  await auth.signOut();
}
