import React, { useEffect, useMemo, useState } from "react";
import { MapPin, Search, Sliders, UserPlus, Users } from "lucide-react";
import { Company, JobOffer, Worker } from "../types";
import { calculateDistance, getCurrentPosition } from "../services/geolocationService";

interface GlobalSearchProps {
  onInviteWorker: (worker: Worker, jobId: string) => Promise<void>;
  globalWorkers: Worker[];
  jobs: JobOffer[];
  isLoading?: boolean;
  isDemo?: boolean;
  currentCompany?: Company | null;
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ onInviteWorker, globalWorkers, jobs, isLoading = false, isDemo = false, currentCompany = null }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [radius, setRadius] = useState(50);
  const [selectedSkill, setSelectedSkill] = useState("all");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPending, setLocationPending] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [invitingWorkerId, setInvitingWorkerId] = useState<string | null>(null);

  const activeJobs = useMemo(() => jobs.filter((job) => job.isActive || job.jobStatus === "active"), [jobs]);
  const availableSkills = useMemo(() => Array.from(new Set(globalWorkers.flatMap((worker) => worker.skills))).sort(), [globalWorkers]);

  useEffect(() => {
    if (!activeJobs.some((job) => job.id === selectedJobId)) setSelectedJobId(activeJobs[0]?.id || "");
  }, [activeJobs, selectedJobId]);

  useEffect(() => {
    getCurrentPosition().then(setUserLocation).catch(() => setUserLocation(null)).finally(() => setLocationPending(false));
  }, []);

  const results = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return globalWorkers
      .filter((worker) => !query || worker.name.toLowerCase().includes(query) || worker.skills.some((skill) => skill.toLowerCase().includes(query)))
      .filter((worker) => selectedSkill === "all" || worker.skills.includes(selectedSkill))
      .map((worker) => userLocation && worker.coordinates ? { ...worker, distance: calculateDistance(userLocation, worker.coordinates) } : worker)
      .filter((worker) => worker.distance == null || worker.distance <= radius)
      .sort((a, b) => (a.distance ?? Number.MAX_VALUE) - (b.distance ?? Number.MAX_VALUE));
  }, [globalWorkers, radius, searchTerm, selectedSkill, userLocation]);

  const invite = async (worker: Worker) => {
    if (!currentCompany) return setNotice("Selecciona una empresa antes de invitar.");
    if (!selectedJobId) return setNotice("Selecciona una oferta activa antes de invitar.");
    setInvitingWorkerId(worker.id);
    try {
      await onInviteWorker(worker, selectedJobId);
      const job = activeJobs.find((item) => item.id === selectedJobId);
      setNotice(`Invitación enviada a ${worker.name} para ${job?.title || "la oferta seleccionada"}.`);
    } catch (error: any) {
      setNotice(error?.message || "No fue posible enviar la invitación.");
    } finally {
      setInvitingWorkerId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-extrabold text-gray-900">Buscar candidatos</h2><p className="mt-1 text-sm text-gray-500">Solo aparecen personas que autorizaron ser encontradas por empresas.</p></div>{isDemo && <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">Modo demostración</span>}</div>
      {notice && <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{notice}</div>}

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <label className="block text-sm font-bold text-blue-950">Oferta para la invitación<select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-blue-200 bg-white px-3 font-medium text-gray-900"><option value="">Selecciona una oferta activa</option>{activeJobs.map((job) => <option key={job.id} value={job.id}>{job.title} · {job.location}</option>)}</select></label>
        {activeJobs.length === 0 && <p className="mt-2 text-sm text-blue-900">Primero crea y publica una oferta para poder invitar candidatos.</p>}
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row"><label className="relative flex-1"><span className="sr-only">Buscar por nombre o habilidad</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por nombre o habilidad" className="min-h-11 w-full rounded-xl border border-gray-200 py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-blue-500" /></label><label><span className="sr-only">Filtrar por habilidad</span><select value={selectedSkill} onChange={(event) => setSelectedSkill(event.target.value)} className="min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm md:w-56"><option value="all">Todas las habilidades</option>{availableSkills.map((skill) => <option key={skill} value={skill}>{skill}</option>)}</select></label></div>
        <div className="rounded-xl bg-gray-50 p-4"><div className="mb-2 flex justify-between gap-4 text-sm"><span className="flex items-center gap-2 font-bold text-gray-700"><Sliders size={16} /> Distancia máxima</span><span className="font-bold text-blue-700">{radius} km</span></div><input aria-label="Distancia máxima de búsqueda" type="range" min="5" max="200" step="5" value={radius} onChange={(event) => setRadius(Number(event.target.value))} className="w-full accent-blue-700" />{!locationPending && !userLocation && <p className="mt-2 flex items-center gap-1 text-xs text-gray-500"><MapPin size={12} /> No autorizaste ubicación; mostramos resultados sin calcular distancia.</p>}</div>
      </section>

      {isLoading ? <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500">Cargando candidatos disponibles...</div> : results.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-14 text-center"><Users className="mx-auto text-gray-400" /><h3 className="mt-3 font-bold text-gray-900">No encontramos candidatos</h3><p className="mt-1 text-sm text-gray-500">Prueba ampliando la distancia o eliminando filtros.</p></div> : <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{results.map((worker) => <article key={worker.id} className="flex flex-col rounded-2xl border border-gray-100 bg-white shadow-sm"><div className="flex-1 p-5"><div className="flex justify-between gap-3"><div><h3 className="font-extrabold text-gray-900">{worker.name}</h3><p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><MapPin size={13} /> {worker.region || "Ubicación informada"}{worker.distance != null ? ` · ${worker.distance.toFixed(1)} km` : ""}</p></div><span className="h-fit rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">Disponible</span></div><div className="mt-4 flex flex-wrap gap-1">{worker.skills.map((skill) => <span key={skill} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">{skill}</span>)}</div></div><div className="border-t border-gray-100 bg-gray-50 p-4"><button type="button" onClick={() => void invite(worker)} disabled={!selectedJobId || invitingWorkerId === worker.id} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-3 text-sm font-bold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"><UserPlus size={16} /> {invitingWorkerId === worker.id ? "Enviando..." : "Invitar a esta oferta"}</button></div></article>)}</div>}
    </div>
  );
};

export default GlobalSearch;
