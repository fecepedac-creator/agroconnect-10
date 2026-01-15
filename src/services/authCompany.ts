// src/services/authCompany.ts
import { GoogleAuthProvider, getRedirectResult, signInWithRedirect, signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

const provider = new GoogleAuthProvider();

export async function startCompanyLogin() {
  await signInWithRedirect(auth, provider);
}

export async function completeCompanyLogin() {
  const cred = await getRedirectResult(auth);
  if (!cred?.user) return null;
  const user = cred.user;

  const uid = user.uid;

  const base = {
    uid,
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
