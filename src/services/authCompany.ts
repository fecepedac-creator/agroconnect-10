// src/services/authCompany.ts
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

const provider = new GoogleAuthProvider();

export async function loginCompanyWithGoogle() {
  const cred = await signInWithPopup(auth, provider);
  const user = cred.user;

  const uid = user.uid;

  const base = {
    uid,
    role: "company",
    email: user.email || null,
    displayName: user.displayName || null,
    phoneNumber: user.phoneNumber || null,
    provider: "google",
    createdAt: serverTimestamp(),
    lastSeen: serverTimestamp(),
  };

  // Perfil base (después lo extendemos a /employers/{uid})
  await setDoc(doc(db, "users", uid), base, { merge: true });

  return user;
}

export async function logoutCompany() {
  await signOut(auth);
}
