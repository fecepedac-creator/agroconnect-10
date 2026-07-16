import React, { useState } from "react";
import { Lock, MessageCircle, Search, Users } from "lucide-react";
import { Worker, WorkerStatus } from "../types";

interface WorkersProps {
  workers: Worker[];
  setWorkers: React.Dispatch<React.SetStateAction<Worker[]>>;
}

const statusLabel = (status: WorkerStatus) => {
  if (status === WorkerStatus.ACTIVE) return { label: "Trabajando", style: "bg-blue-50 text-blue-800" };
  if (status === WorkerStatus.CONSENTED) return { label: "Disponible", style: "bg-emerald-50 text-emerald-800" };
  if (status === WorkerStatus.REJECTED) return { label: "Proceso finalizado", style: "bg-gray-100 text-gray-700" };
  return { label: "Pendiente", style: "bg-amber-50 text-amber-800" };
};

const Workers: React.FC<WorkersProps> = ({ workers }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("all");
  const skills = Array.from(new Set(workers.flatMap((worker) => worker.skills))).sort();
  const query = searchTerm.trim().toLowerCase();
  const filteredWorkers = workers.filter((worker) => {
    const matchesText = !query || worker.name.toLowerCase().includes(query) || worker.skills.some((skill) => skill.toLowerCase().includes(query));
    return matchesText && (selectedSkill === "all" || worker.skills.includes(selectedSkill));
  });

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900">Equipo contratado</h2>
        <p className="mt-1 text-sm text-gray-500">Personas incorporadas a tu empresa y sus datos de contacto autorizados.</p>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Buscar integrante del equipo</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por nombre o habilidad" className="min-h-11 w-full rounded-xl border border-gray-200 py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <label>
            <span className="sr-only">Filtrar por habilidad</span>
            <select value={selectedSkill} onChange={(event) => setSelectedSkill(event.target.value)} className="min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm md:w-56">
              <option value="all">Todas las habilidades</option>
              {skills.map((skill) => <option key={skill} value={skill}>{skill}</option>)}
            </select>
          </label>
        </div>

        {filteredWorkers.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-14 text-center">
            <div className="rounded-full bg-gray-100 p-4 text-gray-500"><Users size={28} /></div>
            <h3 className="mt-4 font-bold text-gray-900">{workers.length === 0 ? "Todavía no tienes personas contratadas" : "No encontramos resultados"}</h3>
            <p className="mt-1 max-w-md text-sm text-gray-500">{workers.length === 0 ? "Cuando finalices una contratación, la persona aparecerá aquí." : "Prueba con otro nombre o elimina el filtro de habilidad."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr><th className="p-4">Nombre</th><th className="p-4">Habilidades</th><th className="p-4">Estado</th><th className="p-4">Contacto</th><th className="p-4 text-right">Acción</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredWorkers.map((worker) => {
                  const status = statusLabel(worker.status);
                  return (
                    <tr key={worker.id}>
                      <td className="p-4 font-semibold text-gray-900">{worker.name}</td>
                      <td className="p-4"><div className="flex flex-wrap gap-1">{worker.skills.map((skill) => <span key={skill} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">{skill}</span>)}</div></td>
                      <td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${status.style}`}>{status.label}</span></td>
                      <td className="p-4 text-sm text-gray-600">{worker.phone || <span className="inline-flex items-center gap-1"><Lock size={14} /> Contacto protegido</span>}</td>
                      <td className="p-4 text-right">{worker.phone ? <a href={`https://wa.me/${worker.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hola ${worker.name}, te escribo desde MundoConnect.`)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50"><MessageCircle size={16} /> Abrir WhatsApp</a> : <span className="text-xs text-gray-500">Disponible después del acuerdo mutuo</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default Workers;
