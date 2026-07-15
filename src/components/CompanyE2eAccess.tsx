import {useState} from "react";
import {signInWithEmailAndPassword} from "firebase/auth";
import {doc, getDoc} from "firebase/firestore";
import {auth, db} from "../firebase";
import type {Company} from "../types";

type Props = {onAuthorized: (company: Company) => void};

export default function CompanyE2eAccess({onAuthorized}: Props) {
  const [email, setEmail] = useState("empresa@mundoconnect.test");
  const [password, setPassword] = useState("MundoConnect123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async () => {
    setLoading(true);
    setError(null);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const token = await credential.user.getIdTokenResult(true);
      const companyId = String(token.claims.companyId || "");
      if (!companyId) throw new Error("La cuenta E2E no tiene empresa asociada.");
      const companySnap = await getDoc(doc(db, "companies", companyId));
      if (!companySnap.exists()) throw new Error("La empresa E2E no existe.");
      const data = companySnap.data() as Partial<Company> & {adminEmail?: string};
      onAuthorized({
        ...data,
        id: companySnap.id,
        name: data.name || "Empresa",
        subscriptionPlan: data.subscriptionPlan || "Basic",
        contactEmail: data.contactEmail || data.adminEmail || "",
      } as Company);
    } catch (loginError: unknown) {
      setError(loginError instanceof Error ? loginError.message : "No se pudo validar el acceso E2E.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="company-e2e-access" className="mt-5 space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-amber-900">Acceso aislado E2E</p>
      <input aria-label="Correo E2E empresa" value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-12 w-full rounded-xl border border-amber-200 px-3" />
      <input aria-label="Clave E2E empresa" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-12 w-full rounded-xl border border-amber-200 px-3" />
      {error && <p role="alert" className="text-sm font-bold text-red-800">{error}</p>}
      <button onClick={login} disabled={loading} className="min-h-12 w-full rounded-xl bg-amber-900 font-black text-white disabled:opacity-60">{loading ? "Ingresando..." : "Ingresar al entorno E2E"}</button>
    </div>
  );
}
