import React, { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileText,
  LogOut,
  MapPin,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { auth, db, functions } from "../firebase";
import { logoutWorker } from "../services/workerAuth";
import WorkerAuthScreen from "./WorkerAuthScreen";
import WorkerProfileEditor, {type EditableWorkerProfile} from "./WorkerProfileEditor";
import WorkerCredentialsPanel from "./WorkerCredentialsPanel";
import type { JobOffer } from "../types";
import {SECTOR_EXPERIENCES, sectorQuery, type EmploymentSector} from "../sectorExperience";
import {getSectorTheme} from "../sectorTheme";

type WorkerPortalProps = {
  onExit?: () => void;
  sector?: EmploymentSector;
};

type JobListing = JobOffer & {
  id: string;
  companyId: string;
  companyName?: string;
};

type WorkerProfile = EditableWorkerProfile;

type WorkerDocument = {
  id: string;
  status?: string;
  updatedAt?: any;
  fileName?: string;
};

type WorkerApplication = {
  id: string;
  jobId: string;
  companyId: string;
  jobTitle?: string;
  companyName?: string;
  appliedAt?: any;
  status?: string;
};

type WorkerMatch = {
  id: string;
  jobId?: string;
  companyId?: string;
  jobTitle?: string;
  companyName?: string;
  state?: string;
  companyDecision?: string;
  workerDecision?: string;
};

type MatchContact = {
  phone?: string | null;
  email?: string | null;
};

type ReviewState = "loading" | "not-reviewed" | "reviewed" | "error";

const usePath = () => {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const navigate = useCallback((to: string) => {
    const nextUrl = new URL(to, window.location.origin);
    if (`${nextUrl.pathname}${nextUrl.search}` === `${window.location.pathname}${window.location.search}`) return;
    window.history.pushState({}, "", `${nextUrl.pathname}${nextUrl.search}`);
    setPath(nextUrl.pathname);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return { path, navigate };
};

const useAuthUser = () => {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { authUser, loading };
};

const useJobs = () => {
  const [jobs, setJobs] = useState<JobListing[]>([]);

  useEffect(() => {
    const q = query(collection(db, "publicJobs"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, async (snap) => {
      const entries = await Promise.all(
        snap.docs.map(async (docSnap) => {
          const data = docSnap.data() as any;
          const companyId = data.companyId ?? "";
          const companyName = data.companyName ?? "";

          return {
            id: String(data.jobId || docSnap.id),
            title: data.title ?? "",
            description: data.description ?? "",
            workersNeeded: data.workersNeeded ?? 0,
            workersFilled: data.workersFilled ?? 0,
            startDate: data.startDate ?? "",
            location: data.location ?? "",
            coordinates: data.coordinates ?? { lat: 0, lng: 0 },
            isActive: data.isActive ?? false,
            publishPublic: data.publishPublic === true,
            jobStatus: data.jobStatus ?? (data.isActive ? "active" : "future"),
            sector: data.sector ?? "agriculture",
            category: data.category ?? "Otros",
            paymentType: data.paymentType,
            payMode: data.payMode,
            payAmount: data.payAmount,
            payDetail: data.payDetail,
            skillsRequired: data.skillsRequired,
            benefits: data.benefits,
            transportMode: data.transportMode,
            transportInfo: data.transportInfo,
            pickupPoints: data.pickupPoints,
            departureTime: data.departureTime,
            returnTime: data.returnTime,
            transportCost: data.transportCost,
            shiftType: data.shiftType,
            shiftPattern: data.shiftPattern,
            requiresOs10: data.requiresOs10,
            facilityType: data.facilityType,
            otherBenefits: data.otherBenefits,
            companyId,
            companyName,
          } as JobListing;
        })
      );

      setJobs(entries);
    });

    return () => unsub();
  }, []);

  return jobs;
};

const useWorkerApplications = (uid?: string) => {
  const [applications, setApplications] = useState<WorkerApplication[]>([]);

  useEffect(() => {
    if (!uid) {
      setApplications([]);
      return;
    }

    const q = query(collection(db, "workers", uid, "applications"), orderBy("appliedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as any),
      }));
      setApplications(list as WorkerApplication[]);
    });

    return () => unsub();
  }, [uid]);

  return applications;
};

const useWorkerMatches = (uid?: string) => {
  const [matches, setMatches] = useState<WorkerMatch[]>([]);

  useEffect(() => {
    if (!uid) {
      setMatches([]);
      return;
    }
    const matchesQuery = query(
      collection(db, "matches"),
      where("workerId", "==", uid),
      orderBy("updatedAt", "desc")
    );
    const unsub = onSnapshot(matchesQuery, (snap) => {
      setMatches(snap.docs.map((matchDoc) => ({
        id: matchDoc.id,
        ...(matchDoc.data() as Omit<WorkerMatch, "id">),
      })));
    });
    return () => unsub();
  }, [uid]);

  return matches;
};

const RegisterCTASticky = ({ onClick }: { onClick: () => void }) => (
  <div className="fixed bottom-0 inset-x-0 z-40 bg-emerald-600 text-white">
    <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="font-extrabold text-sm sm:text-base tracking-tight">Regístrate gratis para postular</div>
      <button
        onClick={onClick}
        className="bg-white text-emerald-700 px-5 py-2 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg hover:bg-emerald-50"
      >
        Crear cuenta
      </button>
    </div>
  </div>
);

const SectorBrand = ({sector}: {sector: EmploymentSector}) => {
  const experience = SECTOR_EXPERIENCES[sector];
  const isAgriculture = sector === "agriculture";

  return (
    <div className="flex items-center gap-2">
      <div className={[
        "flex h-10 w-10 items-center justify-center rounded-2xl text-white font-black",
        isAgriculture ? "bg-emerald-700" : "bg-blue-950",
      ].join(" ")}>
        {isAgriculture ? "A" : "S"}
      </div>
      <div>
        <div className="text-base font-extrabold text-gray-900">{experience.brand}</div>
        <div className={[
          "text-[11px] font-bold uppercase tracking-wide",
          isAgriculture ? "text-emerald-700" : "text-blue-800",
        ].join(" ")}>Trabajo cerca de ti</div>
      </div>
    </div>
  );
};

const PublicLayout = ({ children, onAuthClick, sector }: { children: React.ReactNode; onAuthClick: () => void; sector: EmploymentSector }) => {
  const theme = getSectorTheme(sector);
  return <div className={`min-h-screen text-gray-900 ${theme.page}`}>
    <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <SectorBrand sector={sector} />
        <button onClick={onAuthClick} className={`text-sm font-bold ${theme.accentText}`}>
          Ingresar / Registrarme
        </button>
      </div>
    </header>
    <main className="max-w-6xl mx-auto px-4 py-8 pb-28">{children}</main>
  </div>;
};

const WorkerLayout = ({ children, onNavigate, onLogout, sector }: { children: React.ReactNode; onNavigate: (to: string) => void; onLogout: () => void; sector: EmploymentSector }) => {
  const theme = getSectorTheme(sector);
  return <div className={`min-h-screen text-gray-900 ${theme.page}`} data-sector={sector}>
    <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectorBrand sector={sector} />
        <nav aria-label="Navegación del trabajador" className="flex flex-wrap gap-2">
          <button onClick={() => onNavigate("/worker")} className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
            Inicio
          </button>
          <button onClick={() => onNavigate("/trabajos")} className={`px-3 py-1.5 rounded-full text-xs font-bold ${theme.buttonMuted}`}>
            Buscar trabajo
          </button>
          <button
            onClick={() => onNavigate("/worker/postulaciones")}
            className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700"
          >
            Mis postulaciones
          </button>
          <button onClick={() => onNavigate("/worker/perfil")} className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
            Mi perfil
          </button>
        </nav>
        <button
          onClick={onLogout}
          className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-800"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </header>
    <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
  </div>;
};

const JobCardPublic = ({ job, onSelect }: { job: JobListing; onSelect: () => void }) => (
  <button
    onClick={onSelect}
    className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition p-5"
  >
    <div className="flex items-start justify-between gap-4">
      <div>
        <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
          {job.category}
        </span>
        <h3 className="text-lg font-extrabold text-gray-900 mt-2">{job.title}</h3>
        <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
          <Building2 size={14} /> {job.companyName || "Empresa"}
        </p>
      </div>
      <div className="text-right text-xs text-gray-400 font-semibold">
        <div className="flex items-center gap-1 justify-end">
          <MapPin size={14} className="text-emerald-600" /> {job.location || "Ubicación por confirmar"}
        </div>
        <div className="flex items-center gap-1 justify-end mt-1">
          <Calendar size={14} className="text-emerald-600" /> {job.startDate || "Jornada por confirmar"}
        </div>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
      {(job.sector ?? "agriculture") === "agriculture" ? (
        <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-800">
          {job.transportMode === "employer_transport" ? "Transporte incluido" : job.transportMode === "worker_own" ? "Llegada por cuenta propia" : "Transporte por confirmar"}
        </span>
      ) : (
        <>
          <span className="rounded-full bg-blue-50 px-3 py-2 text-blue-900">Turno {job.shiftType === "night" ? "noche" : job.shiftType === "rotating" ? "rotativo" : "día"}</span>
          {job.requiresOs10 && <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-900">OS10 requerido</span>}
        </>
      )}
    </div>
  </button>
);

const JobCardPrivate = ({ job, onSelect, applied }: { job: JobListing; onSelect: () => void; applied: boolean }) => (
  <button
    onClick={onSelect}
    className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition p-5"
  >
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
            {job.category}
          </span>
          <h3 className="text-lg font-extrabold text-gray-900 mt-2">{job.title}</h3>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
            <Building2 size={14} /> {job.companyName || "Empresa"}
          </p>
        </div>
        <div className="text-right text-xs text-gray-400 font-semibold">
          <div className="flex items-center gap-1 justify-end">
            <MapPin size={14} className="text-emerald-600" /> {job.location || "Ubicación por confirmar"}
          </div>
          <div className="flex items-center gap-1 justify-end mt-1">
            <Calendar size={14} className="text-emerald-600" /> {job.startDate || "Jornada por confirmar"}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-gray-600 font-semibold">
        {job.paymentType && <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full">Pago: {job.paymentType}</span>}
        {job.payMode && <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">{job.payMode}</span>}
        {job.payAmount && (
          <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">${job.payAmount.toLocaleString("es-CL")}</span>
        )}
        {applied && (
          <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full flex items-center gap-1">
            <CheckCircle2 size={14} /> Ya postulado
          </span>
        )}
        {(job.sector ?? "agriculture") === "agriculture" && job.transportMode === "employer_transport" && (
          <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">Transporte incluido</span>
        )}
        {job.sector === "security" && (
          <span className="bg-blue-50 text-blue-900 px-3 py-1 rounded-full">Turno {job.shiftPattern || job.shiftType || "por confirmar"}</span>
        )}
      </div>
    </div>
  </button>
);

const JobDetailPublic = ({ job }: { job: JobListing }) => {
  const isAgriculture = (job.sector ?? "agriculture") === "agriculture";

  return <div className="space-y-6">
    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
      <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
        {job.category}
      </span>
      <h2 className="text-2xl font-extrabold text-gray-900 mt-3">{job.title}</h2>
      <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
        <Building2 size={14} /> {job.companyName || "Empresa"}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-emerald-600" /> {job.location || "Ubicación por confirmar"}
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-emerald-600" /> {job.startDate || "Jornada por confirmar"}
        </div>
      </div>
      <p className="text-sm text-gray-500 mt-6 leading-relaxed">
        {job.description || "Detalles en proceso de publicación."}
      </p>
    </div>

    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-black text-gray-900">Condiciones importantes</h3>
      <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold text-gray-700">
        <span className="rounded-full bg-blue-50 px-3 py-2 text-blue-800">Pago: {job.payAmount ? `$${job.payAmount.toLocaleString("es-CL")}` : job.paymentType || "Por confirmar"}</span>
        {isAgriculture ? (
          <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-800">
            {job.transportMode === "employer_transport" ? "Transporte proporcionado" : job.transportMode === "transport_allowance" ? "Asignación de movilización" : job.transportMode === "worker_own" ? "Llegada por cuenta propia" : "Transporte por confirmar"}
          </span>
        ) : (
          <>
            <span className="rounded-full bg-slate-100 px-3 py-2 text-slate-800">Turno {job.shiftPattern || job.shiftType || "por confirmar"}</span>
            <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-900">{job.requiresOs10 ? "OS10 requerido" : "OS10 no obligatorio"}</span>
          </>
        )}
      </div>
      <div className="mt-5 space-y-2 text-base leading-relaxed text-gray-600">
        {isAgriculture && job.pickupPoints && <p><strong className="text-gray-900">Puntos de encuentro:</strong> {job.pickupPoints}</p>}
        {isAgriculture && job.departureTime && <p><strong className="text-gray-900">Salida:</strong> {job.departureTime} {job.returnTime ? `· Regreso aproximado ${job.returnTime}` : ""}</p>}
        {!isAgriculture && job.facilityType && <p><strong className="text-gray-900">Instalación:</strong> {job.facilityType}</p>}
        {job.otherBenefits && <p><strong className="text-gray-900">Incluye:</strong> {job.otherBenefits}</p>}
      </div>
    </section>
  </div>;
};

const SafetyReportButton = ({job}: {job: JobListing}) => {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("different_conditions");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const submit = async () => {
    setStatus("sending");
    try {
      const submitSafetyReport = httpsCallable(functions, "submitSafetyReport");
      await submitSafetyReport({category, details, companyId: job.companyId, jobId: job.id});
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  if (!open) {
    return <button onClick={() => setOpen(true)} className="min-h-12 w-full rounded-2xl border border-red-200 bg-white px-4 text-sm font-black text-red-800"><AlertTriangle className="mr-2 inline" size={18} /> Reportar esta oferta</button>;
  }

  if (status === "sent") {
    return <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-900">Denuncia recibida. El equipo revisará la oferta.</div>;
  }

  return (
    <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
      <h3 className="font-black text-red-950">Reportar un problema</h3>
      <select aria-label="Categoría de denuncia" value={category} onChange={(event) => setCategory(event.target.value)} className="mt-3 min-h-12 w-full rounded-xl border border-red-200 bg-white px-3">
        <option value="different_conditions">Condiciones diferentes</option>
        <option value="false_offer">Oferta o empresa falsa</option>
        <option value="worker_fee">Cobro al trabajador</option>
        <option value="discrimination">Discriminación o maltrato</option>
        <option value="privacy">Uso indebido de datos</option>
        <option value="other">Otro problema</option>
      </select>
      <textarea aria-label="Detalle de denuncia" value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1000} className="mt-3 min-h-28 w-full rounded-xl border border-red-200 bg-white p-3" placeholder="Describe lo ocurrido sin incluir información sensible innecesaria." />
      {status === "error" && <p role="alert" className="mt-2 text-sm font-bold text-red-800">No pudimos registrar la denuncia. Intenta nuevamente.</p>}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button onClick={() => setOpen(false)} className="min-h-12 rounded-xl border border-red-200 bg-white font-black text-red-900">Cancelar</button>
        <button onClick={submit} disabled={status === "sending" || details.trim().length < 10} className="min-h-12 rounded-xl bg-red-800 font-black text-white disabled:opacity-50">{status === "sending" ? "Enviando..." : "Enviar denuncia"}</button>
      </div>
    </section>
  );
};

const JobDetailPrivate = ({ job, applied, applying, onApply }: { job: JobListing; applied: boolean; applying: boolean; onApply: () => void }) => (
  <div className="space-y-6">
    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
      <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
        {job.category}
      </span>
      <h2 className="text-2xl font-extrabold text-gray-900 mt-3">{job.title}</h2>
      <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
        <Building2 size={14} /> {job.companyName || "Empresa"}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-emerald-600" /> {job.location || "Ubicación por confirmar"}
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-emerald-600" /> {job.startDate || "Jornada por confirmar"}
        </div>
      </div>
      <p className="text-sm text-gray-600 mt-6 leading-relaxed">{job.description || "Sin descripción adicional."}</p>
      <div className="flex flex-wrap gap-2 mt-5 text-xs font-semibold">
        {job.paymentType && <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full">Pago: {job.paymentType}</span>}
        {job.payMode && <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">{job.payMode}</span>}
        {job.payAmount && (
          <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">${job.payAmount.toLocaleString("es-CL")}</span>
        )}
        {job.payDetail && <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">{job.payDetail}</span>}
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        {(job.sector ?? "agriculture") === "agriculture" && job.transportMode === "employer_transport" && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 flex items-start gap-3">
            <ShieldCheck size={18} className="text-emerald-600" />
            <div>
              <p className="font-bold text-emerald-800">Transporte incluido</p>
              <p className="text-xs text-emerald-700">{job.pickupPoints || job.transportInfo || "Detalles a confirmar."}</p>
              {job.departureTime && <p className="mt-1 text-xs text-emerald-700">Salida {job.departureTime}{job.returnTime ? ` · Regreso ${job.returnTime}` : ""}</p>}
            </div>
          </div>
        )}
        {job.sector === "security" && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 flex items-start gap-3">
            <ShieldCheck size={18} className="text-blue-800" />
            <div>
              <p className="font-bold text-blue-950">Turno {job.shiftPattern || job.shiftType || "por confirmar"}</p>
              <p className="text-xs text-blue-800">{job.requiresOs10 ? "Requiere OS10 vigente" : "OS10 no obligatorio"}</p>
              {job.facilityType && <p className="mt-1 text-xs text-blue-800">{job.facilityType}</p>}
            </div>
          </div>
        )}
        {job.otherBenefits && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 flex items-start gap-3">
            <FileText size={18} className="text-blue-600" />
            <div>
              <p className="font-bold text-blue-800">Beneficios extra</p>
              <p className="text-xs text-blue-700">{job.otherBenefits}</p>
            </div>
          </div>
        )}
      </div>
    </div>

    <div className="flex flex-col sm:flex-row gap-3">
      <button
        onClick={onApply}
        disabled={applied || applying}
        aria-busy={applying}
        className={`flex-1 px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition ${
          applied
            ? "bg-emerald-100 text-emerald-600 cursor-not-allowed"
            : "bg-emerald-600 text-white hover:bg-emerald-700"
        }`}
      >
        {applied ? "Ya postulaste" : applying ? "Enviando postulacion..." : "Postular ahora"}
      </button>
      <div className="flex-1 rounded-2xl border border-gray-100 bg-white p-4 text-xs text-gray-500 flex items-center gap-2">
        <ClipboardList size={16} className="text-emerald-600" />
        Tu postulación quedará registrada en tu perfil.
      </div>
    </div>
    <SafetyReportButton job={job} />
  </div>
);

const WorkerPortal: React.FC<WorkerPortalProps> = ({ onExit, sector = "agriculture" }) => {
  const { path, navigate } = usePath();
  const experience = SECTOR_EXPERIENCES[sector];
  const go = useCallback((to: string) => navigate(`${to}${sectorQuery(sector)}`), [navigate, sector]);
  const { authUser, loading } = useAuthUser();
  const jobs = useJobs();
  const applications = useWorkerApplications(authUser?.uid);
  const matches = useWorkerMatches(authUser?.uid);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [workerDocs, setWorkerDocs] = useState<WorkerDocument[]>([]);
  const [matchContacts, setMatchContacts] = useState<Record<string, MatchContact>>({});
  const [matchNotice, setMatchNotice] = useState<string | null>(null);
  const [reviewScores, setReviewScores] = useState<Record<string, number>>({});
  const [reviewStates, setReviewStates] = useState<Record<string, ReviewState>>({});
  const [reviewErrors, setReviewErrors] = useState<Record<string, string>>({});
  const [reviewBusy, setReviewBusy] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!authUser) {
      setWorkerProfile(null);
      setWorkerDocs([]);
      return;
    }

    const workerRef = doc(db, "workers", authUser.uid);
    const docsRef = collection(db, "workers", authUser.uid, "documents");

    const unsubWorker = onSnapshot(workerRef, (snap) => {
      setWorkerProfile((snap.data() as WorkerProfile) ?? null);
    });

    const unsubDocs = onSnapshot(docsRef, (snap) => {
      setWorkerDocs(snap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as any) })));
    });

    return () => {
      unsubWorker();
      unsubDocs();
    };
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      setReviewStates({});
      setReviewErrors({});
      return;
    }

    const reviewableMatches = matches.filter((match) => ["hired", "closed"].includes(match.state || ""));
    const reviewableIds = new Set(reviewableMatches.map((match) => match.id));
    setReviewStates((current) => {
      const next: Record<string, ReviewState> = {};
      reviewableMatches.forEach((match) => {
        next[match.id] = current[match.id] === "reviewed" ? "reviewed" : "loading";
      });
      return next;
    });
    setReviewErrors((current) => Object.fromEntries(
      Object.entries(current).filter(([matchId]) => reviewableIds.has(matchId))
    ));

    if (reviewableMatches.length === 0) return;

    const reviewsQuery = query(collection(db, "match_reviews"), where("authorUid", "==", authUser.uid));
    return onSnapshot(reviewsQuery, (snapshot) => {
      const reviewedIds = new Set(snapshot.docs
        .map((review) => review.data())
        .filter((review) => review.side === "worker_to_company")
        .map((review) => String(review.matchId || "")));
      setReviewStates(Object.fromEntries(reviewableMatches.map((match) => [
        match.id,
        reviewedIds.has(match.id) ? "reviewed" : "not-reviewed",
      ])));
      setReviewErrors({});
    }, () => {
      setReviewStates(Object.fromEntries(reviewableMatches.map((match) => [match.id, "error"])));
      setReviewErrors(Object.fromEntries(reviewableMatches.map((match) => [
        match.id,
        "No pudimos comprobar si esta evaluacion ya fue enviada. Intenta recargar la pagina.",
      ])));
    });
  }, [authUser, matches]);

  useEffect(() => {
    if (!loading && !authUser && path.startsWith("/worker")) {
      go("/trabajos");
    }
  }, [authUser, go, loading, path]);

  const visibleJobs = useMemo(
    () => jobs.filter((job) => (
      job.publishPublic === true &&
      job.isActive === true &&
      (job.jobStatus ?? "active") !== "closed" &&
      (job.sector ?? "agriculture") === sector
    )),
    [jobs, sector]
  );

  const jobIdMatch = path.match(/^\/trabajos\/([^/]+)$/);
  const selectedJob = jobIdMatch ? visibleJobs.find((job) => job.id === jobIdMatch[1]) : undefined;

  const appliedToSelected = selectedJob
    ? applications.some((app) => app.jobId === selectedJob.id && app.companyId === selectedJob.companyId)
    : false;

  const handleApply = async () => {
    if (!authUser || !selectedJob || actionBusy) return;

    setActionError(null);
    setActionBusy(`apply-${selectedJob.id}`);
    try {
      const applyToJob = httpsCallable(functions, "applyToJob");
      await applyToJob({
        companyId: selectedJob.companyId,
        jobId: selectedJob.id,
      });
    } catch (error: any) {
      setActionError(error?.message || "No pudimos registrar tu postulacion. Intenta nuevamente.");
    } finally {
      setActionBusy("");
    }
  };

  const handleMatchDecision = async (
    matchId: string,
    decision: "interested" | "declined"
  ) => {
    if (actionBusy) return;
    setActionError(null);
    setActionBusy(`match-${matchId}`);
    try {
      const respondToMatch = httpsCallable(functions, "respondToMatch");
      await respondToMatch({matchId, decision});
    } catch (error: any) {
      setActionError(error?.message || "No pudimos guardar tu respuesta. Intenta nuevamente.");
    } finally {
      setActionBusy("");
    }
  };

  const handleRevealContact = async (matchId: string) => {
    setMatchNotice(null);
    try {
      const getMatchContact = httpsCallable(functions, "getMatchContact");
      const result = await getMatchContact({matchId});
      const data = result.data as {contact?: MatchContact};
      setMatchContacts((current) => ({...current, [matchId]: data.contact || {}}));
    } catch (error: any) {
      setMatchNotice(error?.message || "No se pudo mostrar el contacto.");
    }
  };

  const handleSubmitReview = async (matchId: string) => {
    const overall = reviewScores[matchId];
    if (!overall) {
      setMatchNotice("Selecciona una calificación antes de enviar.");
      return;
    }
    setMatchNotice(null);
    setReviewBusy(matchId);
    try {
      const submitMatchReview = httpsCallable(functions, "submitMatchReview");
      await submitMatchReview({matchId, overall});
      setReviewStates((current) => ({...current, [matchId]: "reviewed"}));
    } catch (error: any) {
      setMatchNotice(error?.message || "No se pudo enviar la evaluación.");
    } finally {
      setReviewBusy("");
    }
  };

  const handleLogout = async () => {
    await logoutWorker();
    if (onExit) onExit();
    go("/trabajos");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Cargando portal...</div>
    );
  }

  if (path.startsWith("/auth")) {
    const initialMode = path.startsWith("/auth/register") ? "register" : "login";
    return (
      <WorkerAuthScreen
        onSuccess={() => go("/worker")}
        onBack={() => go("/trabajos")}
        initialMode={initialMode}
        sector={sector}
      />
    );
  }

  if (path === "/worker" && authUser) {
    return (
      <WorkerLayout onNavigate={go} onLogout={handleLogout} sector={sector}>
        <div className="grid gap-6">
          <div className={`bg-white rounded-3xl border p-6 shadow-sm ${getSectorTheme(sector).softBorder}`}>
            <h2 className="text-xl font-extrabold text-gray-900">¡Hola, {workerProfile?.fullName || "Trabajador"}!</h2>
            <p className="text-sm text-gray-500 mt-2">
              Aquí podrás revisar tus postulaciones y actualizar tu perfil.
            </p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`rounded-2xl p-4 border ${getSectorTheme(sector).soft}`}>
                <div className="text-xs font-bold">Postulaciones activas</div>
                <div className="text-2xl font-black mt-2">{applications.length}</div>
              </div>
              <div className="rounded-2xl bg-white p-4 border border-gray-100">
                <div className="text-xs text-gray-500 font-bold">Ofertas disponibles</div>
                <div className="text-2xl font-black text-gray-800 mt-2">{visibleJobs.length}</div>
              </div>
              <button onClick={() => go("/worker/perfil")} className={`rounded-2xl bg-white p-4 border border-gray-100 text-left ${getSectorTheme(sector).hoverBorder}`}>
                <div className="text-xs text-gray-500 font-bold">Perfil</div>
                <div className="text-sm font-semibold text-gray-700 mt-2">{workerProfile?.rut ? "Datos principales completos" : "Completar RUT y datos personales"}</div>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-gray-900">Últimas ofertas</h3>
              <button onClick={() => go("/trabajos")} className={`text-xs font-bold ${getSectorTheme(sector).accentText}`}>
                Ver todas
              </button>
            </div>
            <div className="mt-4 grid gap-4">
              {visibleJobs.length === 0 && <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">Todavía no hay ofertas disponibles en esta área.</div>}
              {visibleJobs.slice(0, 3).map((job) => (
                <JobCardPrivate
                  key={`${job.companyId}-${job.id}`}
                  job={job}
                  applied={applications.some((app) => app.jobId === job.id && app.companyId === job.companyId)}
                  onSelect={() => go(`/trabajos/${job.id}`)}
                />
              ))}
            </div>
          </div>
        </div>
      </WorkerLayout>
    );
  }

  if (path === "/worker/postulaciones" && authUser) {
    return (
      <WorkerLayout onNavigate={go} onLogout={handleLogout} sector={sector}>
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-xl font-extrabold text-gray-900">Mis postulaciones</h2>
          <p className="text-sm text-gray-500 mt-2">Cada trabajo aparece una sola vez con su estado actual.</p>
          <div className="mt-6 grid gap-4">
            {matches
              .filter((match) => ["matched", "hired"].includes(String(match.state || "")))
              .map((match) => {
                const contact = matchContacts[match.id];
                return (
                  <div key={match.id} className="rounded-3xl border-2 border-emerald-300 bg-emerald-50 p-5">
                    <div className="text-sm font-black uppercase tracking-wide text-emerald-800">Ambos están interesados</div>
                    <div className="mt-2 text-xl font-black text-gray-900">{match.jobTitle || "Oferta de trabajo"}</div>
                    <div className="mt-1 text-base text-gray-700">{match.companyName || "Empresa"}</div>
                    <p className="mt-3 text-sm leading-relaxed text-emerald-900">La empresa también está interesada. Ya pueden coordinar los siguientes pasos.</p>
                    {!contact ? (
                      <button onClick={() => handleRevealContact(match.id)} className="mt-4 min-h-12 w-full rounded-2xl bg-emerald-700 text-base font-black text-white">
                        Ver datos de contacto
                      </button>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4 text-base font-bold text-gray-800">
                        {contact.phone && <a className="block text-emerald-800 underline" href={`https://wa.me/${contact.phone.replace(/[^0-9]/g, "")}`}>Escribir por WhatsApp: {contact.phone}</a>}
                        {contact.email && <a className="mt-2 block text-emerald-800 underline" href={`mailto:${contact.email}`}>{contact.email}</a>}
                        {!contact.phone && !contact.email && <span>La empresa aún no ha informado un contacto.</span>}
                      </div>
                    )}
                    {match.state === "hired" && (
                      <div className="mt-5 border-t border-emerald-200 pt-5">
                        {!reviewStates[match.id] || reviewStates[match.id] === "loading" ? (
                          <p role="status" aria-live="polite" className="font-bold text-gray-700">Comprobando evaluacion...</p>
                        ) : reviewStates[match.id] === "error" ? (
                          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 font-bold text-red-800">{reviewErrors[match.id]}</p>
                        ) : reviewStates[match.id] === "reviewed" ? (
                          <p className="font-black text-emerald-800">Gracias por evaluar esta experiencia.</p>
                        ) : (
                          <>
                            <p className="text-sm font-black text-gray-900">¿Cómo fue tu experiencia con la empresa?</p>
                            <div className="mt-3 grid grid-cols-5 gap-2">
                              {[1, 2, 3, 4, 5].map((score) => (
                                <button key={score} disabled={reviewBusy === match.id} onClick={() => setReviewScores((current) => ({...current, [match.id]: score}))} className={`min-h-12 rounded-xl text-lg font-black disabled:opacity-50 ${reviewScores[match.id] === score ? "bg-amber-400 text-amber-950" : "border border-gray-200 bg-white text-gray-500"}`}>
                                  {score}★
                                </button>
                              ))}
                            </div>
                            <button disabled={reviewBusy === match.id || !reviewScores[match.id]} aria-busy={reviewBusy === match.id} onClick={() => handleSubmitReview(match.id)} className="mt-3 min-h-12 w-full rounded-2xl bg-slate-900 text-sm font-black text-white disabled:opacity-50">{reviewBusy === match.id ? "Enviando evaluación..." : "Enviar evaluación"}</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            {matches
              .filter((match) => match.state === "company_interested")
              .map((match) => (
                <div key={match.id} className="border-2 border-emerald-200 bg-emerald-50 rounded-2xl p-4">
                  <div className="text-xs font-black uppercase tracking-wide text-emerald-700">
                    Una empresa está interesada en ti
                  </div>
                  <div className="mt-2 font-extrabold text-gray-900">{match.jobTitle || "Oferta de trabajo"}</div>
                  <div className="text-sm text-gray-600">{match.companyName || "Empresa"}</div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleMatchDecision(match.id, "declined")}
                      disabled={actionBusy === `match-${match.id}`}
                      aria-busy={actionBusy === `match-${match.id}`}
                      className="min-h-11 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-700"
                    >
                      No me interesa
                    </button>
                    <button
                      onClick={() => handleMatchDecision(match.id, "interested")}
                      disabled={actionBusy === `match-${match.id}`}
                      aria-busy={actionBusy === `match-${match.id}`}
                      className="min-h-11 rounded-xl bg-emerald-600 text-sm font-bold text-white"
                    >
                      Me interesa
                    </button>
                  </div>
                </div>
              ))}
            {matchNotice && <div role="alert" aria-live="assertive" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{matchNotice}</div>}
            {actionError && <div role="alert" aria-live="assertive" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{actionError}</div>}
            {applications.length === 0 && matches.length === 0 && (
              <div className="text-sm text-gray-400 text-center py-12 border border-dashed rounded-2xl">
                Aún no tienes postulaciones registradas.
              </div>
            )}
            {applications.filter((app) => !matches.some((match) =>
              (match.jobId && match.companyId && match.jobId === app.jobId && match.companyId === app.companyId) ||
              (!match.jobId && match.jobTitle === app.jobTitle && match.companyName === app.companyName)
            )).map((app) => (
              <div key={app.id} className="border border-gray-100 rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <div className="text-sm font-extrabold text-gray-900">{app.jobTitle || "Oferta"}</div>
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                    <Building2 size={14} className="text-emerald-600" /> {app.companyName || "Empresa"}
                  </div>
                </div>
                <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-full">
                  {app.status || "postulado"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </WorkerLayout>
    );
  }

  if (path === "/worker/perfil" && authUser) {
    return (
      <WorkerLayout onNavigate={go} onLogout={handleLogout} sector={sector}>
        <div className="grid gap-6">
          <WorkerProfileEditor uid={authUser.uid} email={authUser.email || ""} profile={workerProfile} sector={sector} />

          <WorkerCredentialsPanel uid={authUser.uid} sector={sector} />

          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <h3 className="text-lg font-extrabold text-gray-900">Documentos laborales</h3>
            <p className="text-sm text-gray-500 mt-2">Estado de tus documentos registrados.</p>
            <div className="mt-6 grid gap-3">
              {workerDocs.length === 0 && (
                <div className="text-sm text-gray-400 text-center py-10 border border-dashed rounded-2xl">
                  Aún no hay documentos registrados.
                </div>
              )}
              {workerDocs.map((docItem) => (
                <div key={docItem.id} className="border border-gray-100 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-gray-900">{docItem.id}</div>
                    <div className="text-xs text-gray-500">{docItem.fileName || "Documento en revisión"}</div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                    {docItem.status || "pendiente"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </WorkerLayout>
    );
  }

  if (path.startsWith("/trabajos")) {
    if (authUser) {
      return (
        <WorkerLayout onNavigate={go} onLogout={handleLogout} sector={sector}>
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">{experience.jobsTitle}</h2>
              <p className="text-sm text-gray-500 mt-2">{experience.jobsDescription}</p>
            </div>
            {jobIdMatch && selectedJob ? (
              <>
                {actionError && <div role="alert" aria-live="assertive" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{actionError}</div>}
                <JobDetailPrivate job={selectedJob} applied={appliedToSelected} applying={actionBusy === `apply-${selectedJob.id}`} onApply={handleApply} />
              </>
            ) : (
              <div className="grid gap-4">
                {visibleJobs.map((job) => (
                  <JobCardPrivate
                    key={`${job.companyId}-${job.id}`}
                    job={job}
                    applied={applications.some((app) => app.jobId === job.id && app.companyId === job.companyId)}
                    onSelect={() => go(`/trabajos/${job.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </WorkerLayout>
      );
    }

    return (
      <PublicLayout onAuthClick={() => go("/auth")} sector={sector}>
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-2xl font-extrabold text-gray-900">{experience.jobsTitle}</h2>
            <p className="text-sm text-gray-500 mt-2">{experience.jobsDescription}</p>
          </div>
          {jobIdMatch && selectedJob ? (
            <JobDetailPublic job={selectedJob} />
          ) : (
            <div className="grid gap-4">
              {visibleJobs.map((job) => (
                <JobCardPublic key={`${job.companyId}-${job.id}`} job={job} onSelect={() => go(`/trabajos/${job.id}`)} />
              ))}
              {visibleJobs.length === 0 && (
                <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center">
                  <h3 className="text-lg font-extrabold text-gray-900">Próximamente habrá oportunidades en esta sección</h3>
                  <p className="mt-2 text-base text-gray-500">Estamos incorporando empresas y ofertas verificadas de tu zona.</p>
                </div>
              )}
            </div>
          )}
        </div>
        <RegisterCTASticky onClick={() => go("/auth/register")} />
      </PublicLayout>
    );
  }

  return (
    <PublicLayout onAuthClick={() => go("/auth")} sector={sector}>
      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm text-center">
        <Briefcase size={32} className="text-emerald-600 mx-auto" />
        <h2 className="text-xl font-extrabold text-gray-900 mt-4">Portal Trabajador</h2>
        <p className="text-sm text-gray-500 mt-2">Accede a las ofertas en /trabajos para comenzar.</p>
        <button
          onClick={() => go("/trabajos")}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 text-white text-xs font-black uppercase tracking-widest"
        >
          Ver trabajos
        </button>
      </div>
    </PublicLayout>
  );
};

export default WorkerPortal;
