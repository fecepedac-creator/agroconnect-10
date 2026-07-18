import {collection, getDocs, orderBy, query} from "firebase/firestore";

import { db } from "../firebase";
import type { Company } from "../types";

const locale = "es";

type GetCompaniesOptions = {
  demoMode: boolean;
  demoCompanies?: Company[];
};

export async function getCompanies({ demoMode, demoCompanies = [] }: GetCompaniesOptions): Promise<Company[]> {
  if (demoMode) {
    return demoCompanies.filter((company) => company.isPublic);
  }

  const baseRef = collection(db, "publicCompanies");
  const publicQuery = query(baseRef, orderBy("name", "asc"));

  try {
    const publicSnap = await getDocs(publicQuery);
    const list = publicSnap.docs.map(
      (docSnap) => ({ id: docSnap.id, ...(docSnap.data() as any) }) as Company
    );
    list.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), locale));
    return list;
  } catch (e: any) {
    const msg = String(e?.message || "");
    const code = String(e?.code || "");
    if (code !== "failed-precondition" && !msg.toLowerCase().includes("index")) {
      throw e;
    }

    const publicSnap = await getDocs(baseRef);
    const list = publicSnap.docs.map(
      (docSnap) => ({ id: docSnap.id, ...(docSnap.data() as any) }) as Company
    );
    list.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), locale));
    return list;
  }
}
