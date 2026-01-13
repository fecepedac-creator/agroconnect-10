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
  const orderedQuery = query(
    baseRef,
    where("status", "==", "active"),
    where("visibility", "==", "public"),
    orderBy("name", "asc")
  );

  try {
    const snap = await getDocs(orderedQuery);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Company[];
  } catch (e: any) {
    const msg = String(e?.message || "");
    const code = String(e?.code || "");
    if (code !== "failed-precondition" && !msg.toLowerCase().includes("index")) {
      throw e;
    }

    const fallbackQuery = query(baseRef, where("status", "==", "active"), where("visibility", "==", "public"));
    const snap = await getDocs(fallbackQuery);
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Company[];
    list.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), locale));
    return list;
  }
}
