import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileText,
  Lock,
  LogOut,
  MapPin,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { auth, db } from "../firebase";
import { logoutWorker } from "../services/workerAuth";
import WorkerAuthScreen from "./WorkerAuthScreen";
import type { JobOffer } from "../types";

type WorkerPortalProps = {
  onExit?: () => void;
};

type JobListing = JobOffer & {
  id: string;
  companyId: string;
  companyName?: string;
};

type WorkerProfile = {
  fullName?: string;
  rut?: string;
  phone?: string;
};

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

const usePath = () => {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to === window.location.pathname) return;
    window.history.pushState({}, "", to);
    setPath(to);
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
  const companyCache = useRef(new Map<string, string>());

  useEffect(() => {
    const q = query(collectionGroup(db, "jobs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, async (snap) => {
      const entries = await Promise.all(
        snap.docs.map(async (docSnap) => {
          const data = docSnap.data() as any;
          const companyId = docSnap.ref.parent.parent?.id ?? data.companyId ?? "";
          let companyName = data.companyName ?? "";

          if (!companyName && companyId) {
            const cached = companyCache.current.get(companyId);
            if (cached) {
              companyName = cached;
            } else {
              const companySnap = await getDoc(doc(db, "companies", companyId));
              if (companySnap.exists()) {
                companyName = (companySnap.data() as any).name ?? "";
                if (companyName) companyCache.current.set(companyId, companyName);
              }
            }
          }

          return {
            id: docSnap.id,
            title: data.title ?? "",
            description: data.description ?? "",
            workersNeeded: data.workersNeeded ?? 0,
            workersFilled: data.workersFilled ?? 0,
            startDate: data.startDate ?? "",
            location: data.location ?? "",
            coordinates: data.coordinates ?? { lat: 0, lng: 0 },
            isActive: data.isActive ?? false,
            jobStatus: data.jobStatus ?? (data.isActive ? "active" : "future"),
            category: data.category ?? "Otros",
            paymentType: data.paymentType,
            payMode: data.payMode,
            payAmount: data.payAmount,
            payDetail: data.payDetail,
            skillsRequired: data.skillsRequired,
            benefits: data.benefits,
            transportInfo: data.transportInfo,
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

const LockedSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="relative rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 p-5">
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2 text-emerald-700">
      <Lock size={20} />
      <p className="text-xs font-black uppercase tracking-widest">{title}</p>
      <p className="text-[11px] font-semibold text-emerald-700/80">Regístrate gratis para desbloquear</p>
    </div>
    <div className="blur-sm opacity-60 select-none pointer-events-none">{children}</div>
  </div>
);

const PublicLayout = ({ children, onAuthClick }: { children: React.ReactNode; onAuthClick: () => void }) => (
  <div className="min-h-screen bg-gray-50 text-gray-900">
    <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black">A</div>
          <div>
            <div className="text-base font-extrabold text-gray-900">AgroConnect</div>
            <div className="text-[10px] font-semibold text-emerald-600 uppercase">Portal Trabajador</div>
          </div>
        </div>
        <button onClick={onAuthClick} className="text-sm font-bold text-emerald-700 hover:text-emerald-800">
          Ingresar / Registrarme
        </button>
      </div>
    </header>
    <main className="max-w-6xl mx-auto px-4 py-8 pb-28">{children}</main>
  </div>
);

const WorkerLayout = ({ children, onNavigate, onLogout }: { children: React.ReactNode; onNavigate: (to: string) => void; onLogout: () => void }) => (
  <div className="min-h-screen bg-gray-50 text-gray-900">
    <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black">A</div>
          <div>
            <div className="text-base font-extrabold text-gray-900">AgroConnect</div>
            <div className="text-[10px] font-semibold text-emerald-600 uppercase">Portal Trabajador</div>
          </div>
        </div>
        <nav className="flex flex-wrap gap-2">
          <button onClick={() => onNavigate("/trabajos")} className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
            Ofertas
          </button>
          <button onClick={() => onNavigate("/worker")} className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
            Inicio
          </button>
          <button
            onClick={() => onNavigate("/worker/postulaciones")}
            className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700"
          >
            Postulaciones
          </button>
          <button onClick={() => onNavigate("/worker/perfil")} className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
            Mi Perfil
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
  </div>
);

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
      </div>
    </div>
  </button>
);

const JobDetailPublic = ({ job }: { job: JobListing }) => (
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
      <p className="text-sm text-gray-500 mt-6 leading-relaxed">
        {job.description ? `${job.description.slice(0, 180)}...` : "Detalles en proceso de publicación."}
      </p>
    </div>

    <LockedSection title="Pago y beneficios">
      <div className="flex flex-wrap gap-2 text-xs text-gray-600 font-semibold">
        <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">Pago: {job.paymentType || "Por definir"}</span>
        <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">Beneficios adicionales</span>
        <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">Transporte incluido</span>
      </div>
    </LockedSection>

    <LockedSection title="Requisitos completos">
      <div className="text-sm text-gray-600 space-y-2">
        <p>Experiencia previa en faenas agrícolas.</p>
        <p>Disponibilidad inmediata y puntualidad.</p>
        <p>Documentación al día.</p>
      </div>
    </LockedSection>
  </div>
);

const JobDetailPrivate = ({ job, applied, onApply }: { job: JobListing; applied: boolean; onApply: () => void }) => (
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
        {job.benefits?.transport && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 flex items-start gap-3">
            <ShieldCheck size={18} className="text-emerald-600" />
            <div>
              <p className="font-bold text-emerald-800">Transporte incluido</p>
              <p className="text-xs text-emerald-700">{job.transportInfo || "Detalles a confirmar."}</p>
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
        disabled={applied}
        className={`flex-1 px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition ${
          applied
            ? "bg-emerald-100 text-emerald-600 cursor-not-allowed"
            : "bg-emerald-600 text-white hover:bg-emerald-700"
        }`}
      >
        {applied ? "Ya postulaste" : "Postular ahora"}
      </button>
      <div className="flex-1 rounded-2xl border border-gray-100 bg-white p-4 text-xs text-gray-500 flex items-center gap-2">
        <ClipboardList size={16} className="text-emerald-600" />
        Tu postulación quedará registrada en tu perfil.
      </div>
    </div>
  </div>
);

const WorkerPortal: React.FC<WorkerPortalProps> = ({ onExit }) => {
  const { path, navigate } = usePath();
  const { authUser, loading } = useAuthUser();
  const jobs = useJobs();
  const applications = useWorkerApplications(authUser?.uid);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [workerDocs, setWorkerDocs] = useState<WorkerDocument[]>([]);

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
    if (!authUser && path.startsWith("/worker")) {
      navigate("/trabajos");
    }
  }, [authUser, navigate, path]);

  useEffect(() => {
    if (authUser && path === "/auth") {
      navigate("/worker");
    }
  }, [authUser, navigate, path]);

  const visibleJobs = useMemo(
    () => jobs.filter((job) => (job.jobStatus ?? "active") !== "closed"),
    [jobs]
  );

  const jobIdMatch = path.match(/^\/trabajos\/([^/]+)$/);
  const selectedJob = jobIdMatch ? visibleJobs.find((job) => job.id === jobIdMatch[1]) : undefined;

  const appliedToSelected = selectedJob
    ? applications.some((app) => app.jobId === selectedJob.id && app.companyId === selectedJob.companyId)
    : false;

  const handleApply = async () => {
    if (!authUser || !selectedJob) return;

    const applicationId = `${selectedJob.companyId}_${selectedJob.id}`;
    const applicationRef = doc(db, "workers", authUser.uid, "applications", applicationId);

    await setDoc(
      applicationRef,
      {
        jobId: selectedJob.id,
        companyId: selectedJob.companyId,
        jobTitle: selectedJob.title,
        companyName: selectedJob.companyName ?? "",
        appliedAt: serverTimestamp(),
        status: "postulado",
      },
      { merge: true }
    );
  };

  const handleLogout = async () => {
    await logoutWorker();
    if (onExit) onExit();
    navigate("/trabajos");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Cargando portal...</div>
    );
  }

  if (path === "/auth") {
    return <WorkerAuthScreen onSuccess={() => navigate("/worker")} onBack={() => navigate("/trabajos")} />;
  }

  if (path === "/worker" && authUser) {
    return (
      <WorkerLayout onNavigate={navigate} onLogout={handleLogout}>
        <div className="grid gap-6">
          <div className="bg-white rounded-3xl border border-emerald-100 p-6 shadow-sm">
            <h2 className="text-xl font-extrabold text-gray-900">¡Hola, {workerProfile?.fullName || "Trabajador"}!</h2>
            <p className="text-sm text-gray-500 mt-2">
              Aquí podrás revisar tus postulaciones y actualizar tu perfil.
            </p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-100">
                <div className="text-xs text-emerald-700 font-bold">Postulaciones activas</div>
                <div className="text-2xl font-black text-emerald-700 mt-2">{applications.length}</div>
              </div>
              <div className="rounded-2xl bg-white p-4 border border-gray-100">
                <div className="text-xs text-gray-500 font-bold">Ofertas disponibles</div>
                <div className="text-2xl font-black text-gray-800 mt-2">{visibleJobs.length}</div>
              </div>
              <div className="rounded-2xl bg-white p-4 border border-gray-100">
                <div className="text-xs text-gray-500 font-bold">Perfil</div>
                <div className="text-sm font-semibold text-gray-700 mt-2">{workerProfile?.rut || "Sin RUT"}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-gray-900">Últimas ofertas</h3>
              <button onClick={() => navigate("/trabajos")} className="text-xs font-bold text-emerald-600">
                Ver todas
              </button>
            </div>
            <div className="mt-4 grid gap-4">
              {visibleJobs.slice(0, 3).map((job) => (
                <JobCardPrivate
                  key={`${job.companyId}-${job.id}`}
                  job={job}
                  applied={applications.some((app) => app.jobId === job.id && app.companyId === job.companyId)}
                  onSelect={() => navigate(`/trabajos/${job.id}`)}
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
      <WorkerLayout onNavigate={navigate} onLogout={handleLogout}>
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-xl font-extrabold text-gray-900">Mis postulaciones</h2>
          <p className="text-sm text-gray-500 mt-2">Sigue el estado de tus postulaciones.</p>
          <div className="mt-6 grid gap-4">
            {applications.length === 0 && (
              <div className="text-sm text-gray-400 text-center py-12 border border-dashed rounded-2xl">
                Aún no tienes postulaciones registradas.
              </div>
            )}
            {applications.map((app) => (
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
      <WorkerLayout onNavigate={navigate} onLogout={handleLogout}>
        <div className="grid gap-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <UserIcon size={24} />
              </div>
              <div>
                <div className="text-lg font-extrabold text-gray-900">{workerProfile?.fullName || "Perfil"}</div>
                <div className="text-xs text-gray-500">{workerProfile?.rut || "RUT por confirmar"}</div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
              <div className="rounded-2xl border border-gray-100 p-4">
                <div className="text-xs text-gray-400 font-bold uppercase">Teléfono</div>
                <div className="mt-2 font-semibold text-gray-700">{workerProfile?.phone || "Sin teléfono"}</div>
              </div>
              <div className="rounded-2xl border border-gray-100 p-4">
                <div className="text-xs text-gray-400 font-bold uppercase">UID</div>
                <div className="mt-2 font-mono text-xs text-gray-500 break-all">{authUser.uid}</div>
              </div>
            </div>
          </div>

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
        <WorkerLayout onNavigate={navigate} onLogout={handleLogout}>
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">Ofertas disponibles</h2>
              <p className="text-sm text-gray-500 mt-2">Postula con un clic y da seguimiento desde tu perfil.</p>
            </div>
            {jobIdMatch && selectedJob ? (
              <JobDetailPrivate job={selectedJob} applied={appliedToSelected} onApply={handleApply} />
            ) : (
              <div className="grid gap-4">
                {visibleJobs.map((job) => (
                  <JobCardPrivate
                    key={`${job.companyId}-${job.id}`}
                    job={job}
                    applied={applications.some((app) => app.jobId === job.id && app.companyId === job.companyId)}
                    onSelect={() => navigate(`/trabajos/${job.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </WorkerLayout>
      );
    }

    return (
      <PublicLayout onAuthClick={() => navigate("/auth")}> 
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-2xl font-extrabold text-gray-900">Trabajos agrícolas disponibles</h2>
            <p className="text-sm text-gray-500 mt-2">
              Explora ofertas reales y crea tu cuenta para postular.
            </p>
          </div>
          {jobIdMatch && selectedJob ? (
            <JobDetailPublic job={selectedJob} />
          ) : (
            <div className="grid gap-4">
              {visibleJobs.map((job) => (
                <JobCardPublic key={`${job.companyId}-${job.id}`} job={job} onSelect={() => navigate(`/trabajos/${job.id}`)} />
              ))}
            </div>
          )}
        </div>
        <RegisterCTASticky onClick={() => navigate("/auth")} />
      </PublicLayout>
    );
  }

  return (
    <PublicLayout onAuthClick={() => navigate("/auth")}> 
      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm text-center">
        <Briefcase size={32} className="text-emerald-600 mx-auto" />
        <h2 className="text-xl font-extrabold text-gray-900 mt-4">Portal Trabajador</h2>
        <p className="text-sm text-gray-500 mt-2">Accede a las ofertas en /trabajos para comenzar.</p>
        <button
          onClick={() => navigate("/trabajos")}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 text-white text-xs font-black uppercase tracking-widest"
        >
          Ver trabajos
        </button>
      </div>
    </PublicLayout>
  );
};

export default WorkerPortal;
