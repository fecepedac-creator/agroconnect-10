import React, { useEffect, useMemo, useState } from "react";
import { GoogleAuthProvider, getRedirectResult, signInWithRedirect, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, syncUserAccess } from "../firebase";
import { completeCompanyLogin, startCompanyLogin } from "../services/authCompany";
import { UserRole, type Company, type Lead } from "../types";

type Props = {
  companies: Company[];
  companiesLoading?: boolean;
  companiesError?: string | null;
  onRetryCompanies?: () => void;
  onSelectRole: (role: UserRole, companyData?: Company) => void;
  onRegisterLead: (leadData: Omit<Lead, "id" | "status" | "createdAt" | "updatedAt">) => Promise<{
    ok: boolean;
    message?: string;
  }>;
};

export default function LoginScreen({
  companies,
  companiesLoading = false,
  companiesError = null,
  onRetryCompanies,
  onSelectRole,
  onRegisterLead,
}: Props) {
  const LOGIN_INTENT_KEY = "agroconnect_login_intent";
  const [loading, setLoading] = useState<null | "worker" | "admin" | "companyAdmin">(null);
  const [error, setError] = useState<string | null>(null);

  // Modal /empresas (público)
  const [openCompanies, setOpenCompanies] = useState(false);
  const [q, setQ] = useState("");
  const [openLead, setOpenLead] = useState(false);
  const [leadFeedback, setLeadFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [leadError, setLeadError] = useState<string | null>(null);

  // Lead form
  const [leadCompanyName, setLeadCompanyName] = useState("");
  const [leadRut, setLeadRut] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadRegion, setLeadRegion] = useState("");
  const [leadNotes, setLeadNotes] = useState("");

  // Hover/Focus visual
  const [hoverSide, setHoverSide] = useState<null | "worker" | "company">(null);

  // Fondo (usa tus imágenes en /public)
  const bgLeft = "/bg-left.jpg";
  const bgRight = "/bg-right.jpg";

  // Allowlist de superadmins por email (rápido para empezar)
  const SUPERADMIN_EMAILS = useMemo(() => {
    const raw = (import.meta as any)?.env?.VITE_SUPERADMIN_EMAILS ?? "fecepedac@gmail.com";
    return String(raw)
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }, []);

  const centerLogo = useMemo(() => {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6">
        <div className="bg-white/90 rounded-3xl shadow-xl border border-white/40 px-10 py-10 max-w-md">
          <div className="flex items-center justify-center gap-3 mb-2">
            {/* Sprout */}
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 21c0-6 6-10 10-10 0 8-6 10-10 10Z"
                  stroke="#059669"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 21c0-6-6-10-10-10 0 8 6 10 10 10Z"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            {/* WiFi */}
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M5 12.55a11 11 0 0 1 14 0" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
                <path d="M8.5 15.2a6 6 0 0 1 7 0" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
                <path d="M12 18.5h.01" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Agro<span className="text-emerald-600">Connect</span>
          </h1>
          <div className="text-xs font-bold tracking-[0.35em] text-slate-500 mt-1">CHILE</div>

          <p className="text-sm text-slate-600 mt-4 leading-relaxed">
            La plataforma inteligente que conecta necesidades agrícolas con talento local en tiempo real.
          </p>
        </div>
      </div>
    );
  }, []);

  const handleWorker = () => {
    setError(null);
    setLoading("worker");
    onSelectRole(UserRole.WORKER);
    setLoading(null);
  };

  // ✅ NUEVO: Acceso corporativo abre /empresas (público) — NO autentica aquí
  const handleOpenCompanies = () => {
    setError(null);
    setOpenCompanies(true);
    setOpenLead(false);
  };

  // Sólo cuando el usuario aprieta “Ingresar como administrador”
  const handleCompanyAdminLogin = async (company: Company) => {
    setError(null);
    setLoading("companyAdmin");
    try {
      sessionStorage.setItem(LOGIN_INTENT_KEY, JSON.stringify({ role: "companyAdmin", companyId: company.id }));
      await startCompanyLogin();
    } catch (e: any) {
      setError(e?.message || "No se pudo iniciar sesión con Google.");
    } finally {
      setLoading(null);
    }
  };

  const handleSendLead = async () => {
    setError(null);
    setLeadFeedback(null);
    setLeadError(null);

    // Validación mínima
    if (!leadCompanyName.trim() || !leadRut.trim() || !leadEmail.trim()) {
      setLeadError("Completa al menos: Empresa, RUT y Email.");
      return;
    }

    const emailOk = /^\S+@\S+\.\S+$/.test(leadEmail.trim());
    if (!emailOk) {
      setLeadError("El email no tiene un formato válido.");
      return;
    }

    const rutOk = /^[0-9kK.-]{7,15}$/.test(leadRut.trim());
    if (!rutOk) {
      setLeadError("El RUT no tiene un formato válido.");
      return;
    }

    const res = await onRegisterLead({
      companyName: leadCompanyName.trim(),
      rut: leadRut.trim(),
      email: leadEmail.trim(),
      phone: leadPhone.trim() || undefined,
      region: leadRegion.trim() || undefined,
      notes: (leadNotes || "Solicito incorporación de mi empresa a AgroConnect.").trim(),
    });

    // Reset + feedback simple
    if (!res.ok) {
      setLeadFeedback({ type: "error", message: res.message || "No se pudo enviar la solicitud." });
      return;
    }

    setLeadFeedback({ type: "success", message: "Solicitud enviada. Te contactaremos." });
    setOpenLead(false);
    setLeadCompanyName("");
    setLeadRut("");
    setLeadEmail("");
    setLeadPhone("");
    setLeadRegion("");
    setLeadNotes("");
  };

  const handleAdminUnlock = async () => {
    setError(null);
    setLoading("admin");
    try {
      const provider = new GoogleAuthProvider();
      sessionStorage.setItem(LOGIN_INTENT_KEY, JSON.stringify({ role: "admin" }));
      await signInWithRedirect(auth, provider);
    } catch (e: any) {
      setError(e?.message || "No se pudo iniciar sesión de SuperAdmin.");
    } finally {
      setLoading(null);
    }
  };

  useEffect(() => {
    const consumeRedirect = async () => {
      const rawIntent = sessionStorage.getItem(LOGIN_INTENT_KEY);
      if (!rawIntent) return;
      const intent = JSON.parse(rawIntent) as { role?: "admin" | "companyAdmin"; companyId?: string };

      try {
        if (intent.role === "admin") {
          const cred = await getRedirectResult(auth);
          if (!cred?.user) return;
          const email = (cred.user.email || "").trim().toLowerCase();
          if (!email) {
            await signOut(auth);
            setError("Tu cuenta Google no tiene email disponible. Intenta con otra cuenta.");
            return;
          }
          if (SUPERADMIN_EMAILS.length === 0) {
            await signOut(auth);
            setError("SuperAdmin no configurado. Define VITE_SUPERADMIN_EMAILS en .env (emails separados por coma).");
            return;
          }
          if (!SUPERADMIN_EMAILS.includes(email)) {
            await signOut(auth);
            setError("No tienes permisos de SuperAdmin para esta app.");
            return;
          }
          onSelectRole(UserRole.ADMIN);
        }

        if (intent.role === "companyAdmin") {
          const user = await completeCompanyLogin();
          if (!user) return;
          const access = await syncUserAccess();
          if (!access?.companyId || access?.role !== "company_admin") {
            setError("Tu usuario no tiene permisos de empresa. Verifica tu correo administrador.");
            return;
          }
          const resolvedCompanyId = access.companyId;
          let company = companies.find((c) => c.id === resolvedCompanyId);
          if (!company) {
            const snap = await getDoc(doc(db, "companies", resolvedCompanyId));
            if (!snap.exists()) {
              setError("No se encontró la empresa seleccionada. Intenta nuevamente.");
              return;
            }
            const data = snap.data() as Company;
            company = {
              id: snap.id,
              name: data?.name || "Empresa",
              subscriptionPlan: data?.subscriptionPlan || "Basic",
              contactEmail: data?.contactEmail || data?.adminEmail || "",
              ...data,
            };
          }
          onSelectRole(UserRole.COMPANY, company);
          setOpenCompanies(false);
        }
      } catch (e: any) {
        setError(e?.message || "No se pudo completar el inicio de sesión.");
      } finally {
        sessionStorage.removeItem(LOGIN_INTENT_KEY);
      }
    };

    void consumeRedirect();
  }, [companies, onSelectRole, SUPERADMIN_EMAILS]);

  // Atenuación de paneles según hover
  const leftDim = hoverSide === "company";
  const rightDim = hoverSide === "worker";

  const filteredCompanies = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return companies || [];
    return (companies || []).filter((c: any) => {
      const n = String(c?.name ?? "").toLowerCase();
      const r = String((c as any)?.rut ?? "").toLowerCase();
      const g = String((c as any)?.region ?? "").toLowerCase();
      return n.includes(term) || r.includes(term) || g.includes(term);
    });
  }, [companies, q]);

  const hasCompanies = (companies || []).length > 0;
  const hasResults = (filteredCompanies || []).length > 0;

  const companyPlaceholder = (company: Company) => {
    const name = String(company?.name || "").trim();
    if (!name) return "AC";
    const parts = name.split(/\s+/).slice(0, 2);
    const initials = parts.map((part) => part[0]).join("").toUpperCase();
    return initials || "AC";
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Fondo dividido */}
      <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-2">
        <div
          className="relative transition duration-300"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(16,185,129,0.75), rgba(2,132,199,0.10)), url(${bgLeft})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: leftDim ? "grayscale(0.2) brightness(0.75)" : "none",
          }}
        >
          <div className="absolute inset-0 bg-black/10" />
        </div>

        <div
          className="relative transition duration-300"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(15,23,42,0.70), rgba(37,99,235,0.10)), url(${bgRight})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: rightDim ? "grayscale(0.2) brightness(0.75)" : "none",
          }}
        >
          <div className="absolute inset-0 bg-black/10" />
        </div>
      </div>

      {/* Contenido */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {/* Card Trabajador */}
          <div
            onMouseEnter={() => setHoverSide("worker")}
            onMouseLeave={() => setHoverSide(null)}
            className={[
              "rounded-3xl bg-white/15 backdrop-blur-md border border-white/20 shadow-xl p-7 text-white",
              "transition duration-300",
              "hover:bg-white/20 hover:border-white/30 hover:shadow-2xl hover:-translate-y-1",
            ].join(" ")}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="white" strokeWidth="2" />
                  <path d="M20 21a8 8 0 0 0-16 0" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <div className="text-xl font-extrabold">Soy Trabajador</div>
                <div className="text-xs opacity-80">Ingreso con RUT + contraseña</div>
              </div>
            </div>

            <p className="text-sm opacity-90 leading-relaxed">
              Busco oportunidades laborales en el campo. Postulación rápida y simple.
            </p>

            <button
              onClick={handleWorker}
              disabled={!!loading}
              className="mt-6 w-full rounded-2xl bg-emerald-600/90 hover:bg-emerald-600 disabled:opacity-60 text-white font-extrabold py-3 transition"
            >
              {loading === "worker" ? "Ingresando..." : "Ingresar al Portal →"}
            </button>

            <div className="mt-4 text-xs opacity-80">No pedimos correo. Tu RUT funciona como usuario.</div>
          </div>

          {/* Centro (logo) */}
          <div className="flex items-center justify-center">{centerLogo}</div>

          {/* Card Empresa */}
          <div
            onMouseEnter={() => setHoverSide("company")}
            onMouseLeave={() => setHoverSide(null)}
            className={[
              "rounded-3xl bg-white/15 backdrop-blur-md border border-white/20 shadow-xl p-7 text-white",
              "transition duration-300",
              "hover:bg-white/20 hover:border-white/30 hover:shadow-2xl hover:-translate-y-1",
            ].join(" ")}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path d="M3 21h18" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  <path d="M5 21V7l7-4 7 4v14" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M9 21v-8h6v8" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="text-xl font-extrabold">Soy Empresa</div>
                <div className="text-xs opacity-80">Directorio público + acceso admin</div>
              </div>
            </div>

            <p className="text-sm opacity-90 leading-relaxed">
              Ve y busca empresas adheridas, solicita incorporación y entra como administrador sólo cuando corresponda.
            </p>

            <button
              onClick={handleOpenCompanies}
              className="mt-6 w-full rounded-2xl bg-blue-600/90 hover:bg-blue-600 text-white font-extrabold py-3 transition"
            >
              /empresas → (Directorio público)
            </button>

            {error && (
              <div className="mt-4 text-sm text-red-100 bg-red-600/20 border border-red-400/30 p-3 rounded-2xl">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL /empresas (público) */}
      {openCompanies && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpenCompanies(false)} />
          <div className="relative w-full max-w-4xl rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="text-2xl font-extrabold text-gray-900">Empresas adheridas</div>
                <div className="text-sm text-gray-500">Directorio público</div>
              </div>
              <button
                onClick={() => setOpenCompanies(false)}
                className="px-3 py-2 rounded-xl bg-gray-900 text-white hover:bg-gray-800"
              >
                Cerrar
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nombre, RUT o región…"
                  className="w-full md:max-w-xl px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
                <button
                  onClick={() => setOpenLead(true)}
                  className="px-4 py-3 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                >
                  Solicitar incorporación
                </button>
              </div>

              {leadFeedback && (
                <div
                  className={[
                    "text-sm rounded-2xl p-4 border",
                    leadFeedback.type === "success"
                      ? "text-emerald-900 bg-emerald-50 border-emerald-200"
                      : "text-amber-900 bg-amber-50 border-amber-200",
                  ].join(" ")}
                >
                  {leadFeedback.message}
                </div>
              )}

              {companiesError && (
                <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                  <span>{companiesError}</span>
                  {onRetryCompanies && (
                    <button
                      onClick={onRetryCompanies}
                      className="px-3 py-2 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700"
                    >
                      Reintentar
                    </button>
                  )}
                </div>
              )}

              {companiesLoading && (
                <div className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-2xl p-4">
                  Cargando empresas...
                </div>
              )}

              {!companiesLoading && !companiesError && !hasCompanies && (
                <div className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-2xl p-4">
                  No hay empresas adheridas aún.
                </div>
              )}

              {!companiesLoading && !companiesError && hasCompanies && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(filteredCompanies || []).map((c: any) => (
                      <div key={c.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-lg font-extrabold text-gray-900">{c.name || "Empresa"}</div>
                            <div className="text-xs text-gray-500">
                              {[
                                (c as any)?.rubro ? `Rubro: ${(c as any).rubro}` : null,
                                (c as any)?.region ? `Región: ${(c as any).region}` : null,
                                (c as any)?.rut ? `RUT: ${(c as any).rut}` : null,
                              ]
                                .filter(Boolean)
                                .join(" • ")}
                            </div>
                          </div>
                          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center overflow-hidden">
                            {c.logoUrl ? (
                              <img src={c.logoUrl} alt={`Logo ${c.name || "Empresa"}`} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-emerald-600 font-extrabold">{companyPlaceholder(c)}</span>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <button
                            onClick={() => handleCompanyAdminLogin(c)}
                            disabled={loading === "companyAdmin"}
                            className="w-full rounded-2xl bg-blue-600 text-white font-extrabold py-3 hover:bg-blue-700 disabled:opacity-60"
                          >
                            {loading === "companyAdmin" ? "Conectando..." : "Ingresar como administrador"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {!hasResults && (
                    <div className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-2xl p-4">
                      No se encontraron empresas con ese criterio.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Sub-modal Lead */}
            {openLead && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-4">
                <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
                  <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                    <div className="text-lg font-extrabold text-gray-900">Solicitar incorporación</div>
                    <button
                      onClick={() => setOpenLead(false)}
                      className="px-3 py-2 rounded-xl bg-gray-900 text-white hover:bg-gray-800"
                    >
                      Cerrar
                    </button>
                  </div>

                  <div className="p-5 space-y-3">
                    <input
                      value={leadCompanyName}
                      onChange={(e) => setLeadCompanyName(e.target.value)}
                      placeholder="Nombre de empresa *"
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200"
                    />
                    <input
                      value={leadRut}
                      onChange={(e) => setLeadRut(e.target.value)}
                      placeholder="RUT *"
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200"
                    />
                    <input
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      placeholder="Email *"
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200"
                    />
                    <input
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      placeholder="Teléfono (opcional)"
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200"
                    />
                    <input
                      value={leadRegion}
                      onChange={(e) => setLeadRegion(e.target.value)}
                      placeholder="Región (opcional)"
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200"
                    />
                    <textarea
                      value={leadNotes}
                      onChange={(e) => setLeadNotes(e.target.value)}
                      placeholder="Notas (opcional)"
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 min-h-[110px]"
                    />

                    {leadError && (
                      <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl p-3">
                        {leadError}
                      </div>
                    )}

                    <button
                      onClick={handleSendLead}
                      className="w-full rounded-2xl bg-emerald-600 text-white font-extrabold py-3 hover:bg-emerald-700"
                    >
                      Enviar solicitud
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUPERADMIN: Candado flotante */}
      <button
        onClick={handleAdminUnlock}
        disabled={loading === "admin"}
        className={[
          "fixed right-4 bottom-4 z-20",
          "w-12 h-12 rounded-2xl shadow-lg border border-white/20",
          "bg-slate-900/60 hover:bg-slate-900/75 backdrop-blur",
          "flex items-center justify-center transition",
          loading === "admin" ? "opacity-70 cursor-not-allowed" : "",
        ].join(" ")}
        title="SuperAdmin (Google)"
        aria-label="SuperAdmin (Google)"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-white">
          <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <path
            d="M6 11h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"
            stroke="white"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
