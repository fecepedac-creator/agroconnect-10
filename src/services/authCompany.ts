// src/services/authCompany.ts
import { GoogleAuthProvider, getRedirectResult, signInWithRedirect, signOut } from "firebase/auth";
import { auth } from "../firebase";

const provider = new GoogleAuthProvider();

export async function startCompanyLogin() {
  await signInWithRedirect(auth, provider);
}

export async function completeCompanyLogin() {
  const cred = await getRedirectResult(auth);
  if (!cred?.user) return null;
  const user = cred.user;

  // El perfil/rol de empresa se sincroniza en syncUserAccess desde Functions.

  return user;
}

export async function logoutCompany() {
  await signOut(auth);
}
