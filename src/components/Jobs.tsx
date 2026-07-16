import React, { useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { Briefcase, Bus, MapPin, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { db } from "../firebase";
import { Company, JobOffer } from "../types";

interface JobsProps {
  jobs: JobOffer[];
  currentCompany: Company | null;
  onCreateOffer: () => void;
  onViewCandidates: () => void;
}

const Jobs: React.FC<JobsProps> = ({ jobs, currentCompany, onCreateOffer, onViewCandidates }) => {
  const [activeTab, setActiveTab] = useState<"future" | "active" | "closed">("active");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const isSuspended = currentCompany?.status === "overdue" || currentCompany?.status === "suspended";

  const deleteJob = async (jobId: string) => {
    if (!currentCompany?.id || !window.confirm("¿Eliminar esta oferta? Esta acción no se puede deshacer.")) return;
    try {
      await deleteDoc(doc(db, "companies", currentCompany.id, "jobs", jobId));
      setNotice({ type: "success", message: "Oferta eliminada." });
    } catch {
      setNotice({ type: "error", message: "No se pudo eliminar la oferta." });
    }
  };

  const filteredJobs = jobs.filter((job) => (job.jobStatus ?? (job.isActive ? "active" : "future")) === activeTab);

  return (
    <div className="space-y-6 pb-12">
      {isSuspended && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong>Publicación suspendida.</strong> Regulariza el estado de la cuenta antes de crear nuevas ofertas.</div>}
      {notice && <div className={`rounded-xl border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{notice.message}</div>}

      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div><h2 className="text-2xl font-extrabold text-gray-900">Ofertas</h2><p className="mt-1 text-sm text-gray-500">Publica vacantes y revisa sus cupos y candidatos.</p></div>
        <button type="button" onClick={onCreateOffer} disabled={isSuspended} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"><Plus size={18} /> Crear oferta</button>
      </div>

      <div className="inline-flex max-w-full overflow-x-auto rounded-xl border border-gray-200 bg-white p-1">
        {(["active", "future", "closed"] as const).map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`min-h-11 whitespace-nowrap rounded-lg px-5 text-sm font-bold ${activeTab === tab ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"}`}>{tab === "active" ? "Activas" : tab === "future" ? "Borradores y futuras" : "Cerradas"}</button>)}
      </div>

      {filteredJobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center"><Briefcase className="mx-auto text-gray-400" size={32} /><h3 className="mt-4 font-bold text-gray-900">No hay ofertas en esta sección</h3><p className="mt-1 text-sm text-gray-500">{activeTab === "active" ? "Crea y publica una oferta para comenzar a recibir postulaciones." : "Las ofertas aparecerán aquí según su estado."}</p>{activeTab === "active" && !isSuspended && <button type="button" onClick={onCreateOffer} className="mt-5 min-h-11 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Crear primera oferta</button>}</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredJobs.map((job) => {
            const remaining = Math.max(0, job.workersNeeded - job.workersFilled);
            return <article key={job.id} className="flex flex-col rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">{job.sector === "security" ? "Seguridad" : "Agricultura"}</span><h3 className="mt-3 text-lg font-extrabold text-gray-900">{job.title}</h3></div>{job.sector === "security" ? <ShieldCheck className="text-blue-800" /> : <Briefcase className="text-emerald-700" />}</div>
                <p className="mt-2 line-clamp-2 text-sm text-gray-600">{job.description || "Sin descripción adicional."}</p>
                <div className="mt-4 space-y-2 text-sm text-gray-600"><p className="flex items-center gap-2"><MapPin size={15} /> {job.location}</p>{job.sector === "agriculture" && <p className="flex items-center gap-2"><Bus size={15} /> {job.transportMode === "employer_transport" ? "Transporte proporcionado" : job.transportMode === "transport_allowance" ? "Asignación de transporte" : job.transportMode === "worker_own" ? "Traslado por cuenta del trabajador" : "Transporte por confirmar"}</p>}<p className="flex items-center gap-2"><Users size={15} /> {job.workersFilled} de {job.workersNeeded} cupos cubiertos</p></div>
                <div className={`mt-4 rounded-xl px-3 py-2 text-sm font-bold ${remaining > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>{remaining > 0 ? `${remaining} cupos por cubrir` : "Cupos cubiertos"}</div>
              </div>
              <div className="flex gap-2 border-t border-gray-100 bg-gray-50 p-4"><button type="button" onClick={onViewCandidates} className="min-h-11 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-800 hover:border-emerald-300 hover:text-emerald-800">Ver candidatos</button><button type="button" onClick={() => void deleteJob(job.id)} aria-label={`Eliminar oferta ${job.title}`} className="min-h-11 min-w-11 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="mx-auto" size={18} /></button></div>
            </article>;
          })}
        </div>
      )}
    </div>
  );
};

export default Jobs;
