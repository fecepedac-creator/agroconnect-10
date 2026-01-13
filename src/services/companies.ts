import { collection, getDocs, orderBy, query, where } from "firebase/firestore";

import { db } from "../firebase";
import type { Company } from "../types";

const locale = "es";

type GetCompaniesOptions = {
  demoMode: boolean;
  demoCompanies?: Company[];
};

export async function getCompanies({ demoMode, demoCompanies = [] }: GetCompaniesOptions): Promise<Company[]> {
  if (demoMode) {
    return demoCompanies;
  }

  const baseRef = collection(db, "companies");
  const publicQuery = query(baseRef, where("isPublic", "==", true), orderBy("name", "asc"));
  const legacyPublicQuery = query(baseRef, where("public", "==", true), orderBy("name", "asc"));

  try {
    const [publicSnap, legacySnap] = await Promise.all([getDocs(publicQuery), getDocs(legacyPublicQuery)]);
    const combined = new Map<string, Company>();
    publicSnap.docs.forEach((docSnap) => {
      combined.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() as any) } as Company);
    });
    legacySnap.docs.forEach((docSnap) => {
      if (!combined.has(docSnap.id)) {
        combined.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() as any) } as Company);
      }
    });
    const list = Array.from(combined.values());
    list.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), locale));
    return list;
  } catch (e: any) {
    const msg = String(e?.message || "");
    const code = String(e?.code || "");
    if (code !== "failed-precondition" && !msg.toLowerCase().includes("index")) {
      throw e;
    }

    const [publicSnap, legacySnap] = await Promise.all([
      getDocs(query(baseRef, where("isPublic", "==", true))),
      getDocs(query(baseRef, where("public", "==", true))),
    ]);
    const combined = new Map<string, Company>();
    publicSnap.docs.forEach((docSnap) => {
      combined.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() as any) } as Company);
    });
    legacySnap.docs.forEach((docSnap) => {
      if (!combined.has(docSnap.id)) {
        combined.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() as any) } as Company);
      }
    });
    const list = Array.from(combined.values());
    list.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), locale));
    return list;
  }
}
