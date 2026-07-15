import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "../firebase";
import { normalizeRut } from "../utils/rut";

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
  createdAt?: any;
  updatedAt?: any;
  lastSeen?: any;
};

const USERS_COLLECTION = "users";
const WORKERS_COLLECTION = "workers";
const WORKER_USERNAMES_COLLECTION = "worker_usernames";

const buildWorkerProfile = (payload: {
  uid: string;
  fullName: string;
  email: string;
  phone?: string;
  rut?: string;
  providers: string[];
  commune?: string;
  primaryTrade?: string;
  sectors?: Array<"agriculture" | "security">;
  mobility?: "needs_transport" | "public_transport" | "own_transport";
}): WorkerProfile => ({
  uid: payload.uid,
  displayName: payload.fullName,
  fullName: payload.fullName,
  rut: payload.rut,
  email: payload.email,
  phone: payload.phone,
  commune: payload.commune,
  primaryTrade: payload.primaryTrade,
  sectors: payload.sectors,
  mobility: payload.mobility,
  role: "worker",
  authProviders: payload.providers,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  lastSeen: serverTimestamp(),
});

const upsertWorkerDocs = async (uid: string, data: Partial<WorkerProfile>) => {
  await setDoc(doc(db, USERS_COLLECTION, uid), data, { merge: true });
  await setDoc(doc(db, WORKERS_COLLECTION, uid), data, { merge: true });
};

const upsertWorkerUsername = async (rut: string, payload: { uid: string; email: string }) => {
  await setDoc(
    doc(db, WORKER_USERNAMES_COLLECTION, rut),
    { ...payload, updatedAt: serverTimestamp() },
    { merge: true }
  );
};

export async function registerWorker(input: WorkerRegisterInput) {
  const rutNorm = input.rut ? normalizeRut(input.rut) : undefined;
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();

  const cred = await createUserWithEmailAndPassword(auth, email, input.password);
  const uid = cred.user.uid;

  const profile = buildWorkerProfile({
    uid,
    fullName,
    email,
    phone: input.phone?.trim() || undefined,
    rut: rutNorm,
    providers: ["password"],
    commune: input.commune.trim(),
    primaryTrade: input.primaryTrade.trim(),
    sectors: input.sectors,
    mobility: input.mobility,
  });

  await upsertWorkerDocs(uid, profile);
  if (rutNorm) {
    await upsertWorkerUsername(rutNorm, { uid, email });
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
  const rutNorm = normalizeRut(rut);
  await upsertWorkerDocs(uid, { rut: rutNorm, updatedAt: serverTimestamp() });
  await upsertWorkerUsername(rutNorm, { uid, email });
}

export async function logoutWorker() {
  await auth.signOut();
}
