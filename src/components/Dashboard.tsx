import React from "react";
import { AlertCircle, Briefcase, CheckCircle2, Search, Users } from "lucide-react";
import { JobOffer, Worker, WorkerStatus } from "../types";

interface DashboardProps {
  workers: Worker[];
  jobs: JobOffer[];
  globalWorkers: Worker[];
  onRadarClick?: () => void;
  demoMode?: boolean;
  companyStats?: Record<string, number> | null;
  globalStats?: Record<string, number> | null;
  isAdmin?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ workers, jobs, globalWorkers, onRadarClick, demoMode = false, companyStats = null, globalStats = null, isAdmin = false }) => {
  const stats = isAdmin ? globalStats : companyStats;
  const activeWorkers = workers.filter((worker) => worker.status === WorkerStatus.ACTIVE).length;
  const activeJobs = stats?.jobsActive ?? jobs.filter((job) => job.isActive || job.jobStatus === "active").length;
  const workersTotal = stats?.workersTotal ?? workers.length;
  const workersActive = companyStats?.workersActive ?? activeWorkers;
  const applications = stats?.applicationsTotal ?? 0;
  const hires = stats?.hiresTotal ?? 0;
  const openPositions = jobs
    .filter((job) => job.isActive || job.jobStatus === "active")
    .reduce((total, job) => total + Math.max(0, job.workersNeeded - job.workersFilled), 0);

  const cards = isAdmin
    ? [
        { label: "Empresas activas", value: globalStats?.companiesActive ?? 0, icon: Users, style: "bg-emerald-50 text-emerald-700" },
        { label: "Ofertas activas", value: activeJobs, icon: Briefcase, style: "bg-amber-50 text-amber-700" },
        { label: "Postulaciones", value: applications, icon: Search, style: "bg-blue-50 text-blue-700" },
        { label: "Contrataciones", value: hires, icon: CheckCircle2, style: "bg-indigo-50 text-indigo-700" },
      ]
    : [
        { label: "Ofertas activas", value: activeJobs, icon: Briefcase, style: "bg-amber-50 text-amber-700" },
        { label: "Postulaciones", value: applications, icon: Search, style: "bg-blue-50 text-blue-700" },
        { label: "Equipo contratado", value: workersTotal, icon: Users, style: "bg-emerald-50 text-emerald-700" },
        { label: "Trabajando actualmente", value: workersActive, icon: CheckCircle2, style: "bg-indigo-50 text-indigo-700" },
      ];

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-extrabold text-gray-900">Resumen</h2>
          {demoMode && <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">Modo demostración</span>}
        </div>
        <p className="mt-1 text-sm text-gray-500">{isAdmin ? "Estado general de MundoConnect." : "Lo importante de tu proceso de contratación, en un solo lugar."}</p>
      </div>

      {demoMode && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Estos datos pertenecen al modo demostración y no representan actividad real de una empresa.</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, style }) => (
          <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className={`mb-4 inline-flex rounded-xl p-3 ${style}`}><Icon size={22} aria-hidden="true" /></div>
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className="mt-1 text-3xl font-extrabold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {!isAdmin && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-700"><Search size={22} /></div>
              <div className="flex-1">
                <h3 className="font-extrabold text-gray-900">Candidatos disponibles</h3>
                <p className="mt-1 text-sm text-gray-500">{globalWorkers.length > 0 ? `${globalWorkers.length} personas autorizaron aparecer en la búsqueda de talento.` : "Todavía no hay candidatos disponibles con los criterios actuales."}</p>
                <button type="button" onClick={() => onRadarClick?.()} className="mt-4 min-h-11 rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-black">Buscar candidatos</button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className={`rounded-xl p-3 ${openPositions > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{openPositions > 0 ? <AlertCircle size={22} /> : <CheckCircle2 size={22} />}</div>
              <div>
                <h3 className="font-extrabold text-gray-900">Cupos por cubrir</h3>
                <p className="mt-1 text-sm text-gray-500">{activeJobs === 0 ? "No tienes ofertas publicadas. Crea una oferta para comenzar a recibir postulaciones." : openPositions > 0 ? `Quedan ${openPositions} cupos disponibles en tus ofertas activas.` : "Los cupos informados en tus ofertas activas están cubiertos."}</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
