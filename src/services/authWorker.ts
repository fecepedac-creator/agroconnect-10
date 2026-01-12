// src/services/authWorker.ts
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { normalizeRut, rutToInternalEmail } from "./rut";

export type WorkerRegisterInput = {
  fullName: string;
  rut: string;
  phone: string; // solo dígitos idealmente
  email: string;
  password: string;
};

export async function registerWorker(input: WorkerRegisterInput) {
  const rutNorm = normalizeRut(input.rut);
  const email = input.email.trim().toLowerCase();

  const cred = await createUserWithEmailAndPassword(auth, email, input.password);
  const uid = cred.user.uid;

  // Perfil mínimo (duplicado en /users y /workers para reglas simples y UI futura)
  const base = {
    uid,
    role: "worker",
    fullName: input.fullName.trim(),
    rut: rutNorm,
    phone: input.phone.trim(),
    email,
    provider: "email_password",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastSeen: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, "users", uid), base, { merge: true });
    await setDoc(doc(db, "workers", uid), base, { merge: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("registerWorker Firestore error: users/workers", error);
    throw error;
  }

  return cred.user;
}

export async function loginWorker(identifier: string, password: string) {
  const raw = identifier.trim();
  const email = raw.includes("@") ? raw.toLowerCase() : rutToInternalEmail(normalizeRut(raw));
  const cred = await signInWithEmailAndPassword(auth, email, password);

  // lastSeen
  const uid = cred.user.uid;
  await setDoc(doc(db, "users", uid), { lastSeen: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  await setDoc(doc(db, "workers", uid), { lastSeen: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });

  return cred.user;
}

export async function logoutWorker() {
  await signOut(auth);
}
