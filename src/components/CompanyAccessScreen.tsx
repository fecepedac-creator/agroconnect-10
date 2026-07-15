import {lazy, Suspense, useState} from "react";
import {GoogleAuthProvider, signInWithPopup, signOut} from "firebase/auth";
import {doc, getDoc} from "firebase/firestore";
import {ArrowLeft, Building2, CheckCircle2, LockKeyhole, ShieldCheck} from "lucide-react";
import {auth, db, syncUserAccess} from "../firebase";
import type {Company, Lead} from "../types";

type Props = {
  onAuthorized: (company: Company) => void;
  onRegisterLead: (lead: Omit<Lead, "id" | "status" | "createdAt" | "updatedAt">) => Promise<{
    ok: boolean;
    message?: string;
  }>;
};

const CompanyE2eAccess = import.meta.env.MODE === "e2e" && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true"
  ? lazy(() => import("./CompanyE2eAccess"))
  : null;

export default function CompanyAccessScreen({onAuthorized, onRegisterLead}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRequest, setShowRequest] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [rut, setRut] = useState("");
  const [email, setEmail] = useState("");

  const resolveCompanyAccess = async () => {
    const access = await syncUserAccess();
    const allowedRole = access?.role === "company_admin" || access?.role === "company_hr";
    if (!allowedRole || !access.companyId) {
      throw new Error("Esta cuenta no tiene una membresía activa en una empresa.");
    }

    const companySnap = await getDoc(doc(db, "companies", access.companyId));
    if (!companySnap.exists()) {
      throw new Error("La empresa asociada a esta cuenta no está disponible.");
    }
    const data = companySnap.data() as Partial<Company> & {adminEmail?: string};
    onAuthorized({
      ...data,
      id: companySnap.id,
      name: data.name || "Empresa",
      subscriptionPlan: data.subscriptionPlan || "Basic",
      contactEmail: data.contactEmail || data.adminEmail || "",
    } as Company);
  };

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({prompt: "select_account"});
      await signInWithPopup(auth, provider);
      await resolveCompanyAccess();
    } catch (loginError: unknown) {
      const code = typeof loginError === "object" && loginError && "code" in loginError
        ? String(loginError.code)
        : "";
      if (code !== "auth/popup-closed-by-user") {
        const message = loginError instanceof Error ? loginError.message : "No se pudo validar el acceso.";
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUseAnotherAccount = async () => {
    await signOut(auth);
    await handleLogin();
  };

  const handleRequest = async () => {
    setError(null);
    if (!companyName.trim() || !rut.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Completa el nombre, RUT y un correo válido.");
      return;
    }
    setRequesting(true);
    const result = await onRegisterLead({
      companyName: companyName.trim(),
      rut: rut.trim(),
      email: email.trim().toLowerCase(),
      notes: "Solicitud enviada desde el portal de empresas MundoConnect.",
    });
    setRequesting(false);
    if (!result.ok) {
      setError(result.message || "No se pudo enviar la solicitud.");
      return;
    }
    setRequestSent(true);
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 -z-20 bg-cover bg-center opacity-30" style={{backgroundImage: "url(/bg-right.jpg)"}} />
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-950 via-slate-950/95 to-blue-950/85" />
      <header className="mx-auto flex min-h-20 max-w-6xl items-center justify-between px-5 lg:px-8">
        <button onClick={() => window.location.assign("/")} className="flex items-center gap-2 text-sm font-extrabold text-white/70 hover:text-white">
          <ArrowLeft size={18} /> MundoConnect
        </button>
        <span className="rounded-full border border-white/15 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white/55">Portal protegido</span>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-12 px-5 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <section>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-300 text-slate-950"><Building2 size={28} /></span>
          <p className="mt-7 text-xs font-black uppercase tracking-[0.18em] text-amber-300">Administradores de empresas</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Gestiona oportunidades y encuentra personas.</h1>
          <p className="mt-6 max-w-xl text-lg font-medium leading-relaxed text-white/65">Este acceso es exclusivo para representantes autorizados. MundoConnect identifica automáticamente tu empresa después de iniciar sesión.</p>
          <div className="mt-7 space-y-3 text-sm font-bold text-white/65">
            <p className="flex items-center gap-3"><CheckCircle2 className="text-amber-300" size={19} /> No necesitas seleccionar una empresa públicamente.</p>
            <p className="flex items-center gap-3"><CheckCircle2 className="text-amber-300" size={19} /> Solo verás organizaciones donde tengas membresía activa.</p>
            <p className="flex items-center gap-3"><CheckCircle2 className="text-amber-300" size={19} /> Los permisos se verifican nuevamente en el servidor.</p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/15 bg-white p-6 text-slate-950 shadow-2xl sm:p-9">
          {!showRequest ? (
            <>
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-800"><LockKeyhole size={23} /></span>
                <div><h2 className="text-2xl font-black">Acceso de empresa</h2><p className="mt-1 text-sm font-semibold text-slate-500">Utiliza la cuenta Google autorizada.</p></div>
              </div>
              {error && <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div>}
              <button onClick={handleLogin} disabled={loading} className="mt-7 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-blue-700 px-6 font-black text-white transition hover:bg-blue-800 disabled:opacity-60">
                <ShieldCheck size={21} /> {loading ? "Validando membresía..." : "Continuar con Google"}
              </button>
              {CompanyE2eAccess && <Suspense fallback={null}><CompanyE2eAccess onAuthorized={onAuthorized} /></Suspense>}
              {auth.currentUser && error && <button onClick={handleUseAnotherAccount} className="mt-3 min-h-12 w-full rounded-2xl border border-slate-200 font-extrabold text-slate-700 hover:bg-slate-50">Usar otra cuenta Google</button>}
              <div className="my-7 h-px bg-slate-200" />
              <p className="text-center text-sm font-semibold text-slate-500">¿Tu empresa todavía no pertenece a MundoConnect?</p>
              <button onClick={() => {setShowRequest(true); setError(null);}} className="mt-3 min-h-12 w-full rounded-2xl border border-slate-300 font-extrabold text-slate-800 hover:bg-slate-50">Solicitar incorporación</button>
            </>
          ) : requestSent ? (
            <div className="py-10 text-center"><CheckCircle2 className="mx-auto text-emerald-600" size={48} /><h2 className="mt-5 text-2xl font-black">Solicitud recibida</h2><p className="mt-3 font-medium text-slate-600">Revisaremos los datos antes de habilitar cualquier acceso.</p><button onClick={() => setShowRequest(false)} className="mt-7 rounded-2xl bg-slate-950 px-6 py-3 font-black text-white">Volver al acceso</button></div>
          ) : (
            <>
              <h2 className="text-2xl font-black">Solicitar incorporación</h2>
              <p className="mt-2 text-sm font-medium text-slate-500">Enviar una solicitud no concede acceso automático.</p>
              <div className="mt-6 space-y-4">
                <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Nombre de la empresa" className="min-h-12 w-full rounded-2xl border border-slate-200 px-4" />
                <input value={rut} onChange={(event) => setRut(event.target.value)} placeholder="RUT de la empresa" className="min-h-12 w-full rounded-2xl border border-slate-200 px-4" />
                <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Correo de contacto" type="email" className="min-h-12 w-full rounded-2xl border border-slate-200 px-4" />
              </div>
              {error && <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div>}
              <button onClick={handleRequest} disabled={requesting} className="mt-6 min-h-14 w-full rounded-2xl bg-emerald-800 px-6 font-black text-white disabled:opacity-60">{requesting ? "Enviando..." : "Enviar solicitud"}</button>
              <button onClick={() => {setShowRequest(false); setError(null);}} className="mt-3 min-h-12 w-full font-extrabold text-slate-500">Cancelar</button>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
