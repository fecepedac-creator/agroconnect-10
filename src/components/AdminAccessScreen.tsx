import {useState} from "react";
import {GoogleAuthProvider, signInWithPopup, signOut} from "firebase/auth";
import {ArrowLeft, KeyRound, ShieldAlert} from "lucide-react";
import {auth, syncSuperadminClaims} from "../firebase";

type Props = {onAuthorized: () => void};

export default function AdminAccessScreen({onAuthorized}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      if (auth.currentUser) await signOut(auth);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({prompt: "select_account"});
      const credential = await signInWithPopup(auth, provider);
      await syncSuperadminClaims();
      const token = await credential.user.getIdTokenResult(true);
      const role = String(token.claims.role || "").toLowerCase();
      const allowed = token.claims.superadmin === true || token.claims.admin === true || role === "superadmin" || role === "admin";
      if (!allowed) {
        await signOut(auth);
        throw new Error("Esta cuenta no tiene autorización de SuperAdmin.");
      }
      onAuthorized();
    } catch (loginError: unknown) {
      const code = typeof loginError === "object" && loginError && "code" in loginError ? String(loginError.code) : "";
      if (code !== "auth/popup-closed-by-user") {
        setError(loginError instanceof Error ? loginError.message : "No se pudo verificar el acceso administrativo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080b12] text-white">
      <header className="mx-auto flex min-h-20 max-w-5xl items-center px-5 lg:px-8">
        <button onClick={() => window.location.assign("/")} className="flex items-center gap-2 text-sm font-bold text-white/45 hover:text-white"><ArrowLeft size={18} /> Volver</button>
      </header>
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center px-5 pb-20 lg:px-8">
        <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 shadow-2xl sm:p-10">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-300"><ShieldAlert size={27} /></span>
          <p className="mt-7 text-xs font-black uppercase tracking-[0.18em] text-red-300">Acceso restringido</p>
          <h1 className="mt-3 text-3xl font-black">Control MundoConnect</h1>
          <p className="mt-4 font-medium leading-relaxed text-white/55">Área exclusiva para SuperAdmin. Todos los intentos y acciones administrativas pueden ser auditados.</p>
          {error && <div role="alert" className="mt-6 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm font-bold text-red-200">{error}</div>}
          <button onClick={handleLogin} disabled={loading} className="mt-7 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-white px-6 font-black text-slate-950 transition hover:bg-slate-100 disabled:opacity-60"><KeyRound size={20} /> {loading ? "Verificando..." : "Ingresar con Google"}</button>
          <p className="mt-5 text-center text-xs font-semibold leading-relaxed text-white/35">Conocer esta dirección no concede acceso. Los permisos se validan en Firebase Auth y nuevamente en el servidor.</p>
        </section>
      </main>
    </div>
  );
}
