import React, { useEffect, useMemo, useState } from "react";
import { Check, Copy, Link, MessageCircle, Send, Users, Wand2 } from "lucide-react";
import { Company, JobOffer, Worker } from "../types";
import { generateBroadcastMessage } from "../services/geminiService";

interface BroadcastsProps {
  company: Company | null;
  jobs: JobOffer[];
  workers?: Worker[];
}

const Broadcasts: React.FC<BroadcastsProps> = ({ company, jobs, workers = [] }) => {
  const activeJobs = useMemo(() => jobs.filter((job) => job.isActive || job.jobStatus === "active"), [jobs]);
  const [selectedJobId, setSelectedJobId] = useState(activeJobs[0]?.id || "");
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const selectedJob = activeJobs.find((job) => job.id === selectedJobId);
  const contacts = workers.filter((worker) => Boolean(worker.phone));
  const sector = selectedJob?.sector === "security" ? "security" : "agriculture";
  const jobUrl = selectedJob ? `${window.location.origin}/trabajos/${selectedJob.id}?sector=${sector}` : "";

  useEffect(() => {
    if (!activeJobs.some((job) => job.id === selectedJobId)) setSelectedJobId(activeJobs[0]?.id || "");
  }, [activeJobs, selectedJobId]);

  useEffect(() => {
    if (!selectedJob) return setMessage("");
    const transport = selectedJob.sector === "agriculture"
      ? selectedJob.transportMode === "employer_transport" ? "Transporte proporcionado por la empresa." : selectedJob.transportMode === "transport_allowance" ? "Incluye asignación de movilización." : selectedJob.transportMode === "worker_own" ? "Traslado por cuenta del trabajador." : "Transporte por confirmar."
      : "";
    setMessage(`Hola. ${company?.name || "Una empresa"} publicó la oferta ${selectedJob.title} en ${selectedJob.location}. ${transport} Revisa los detalles y postula aquí: ${jobUrl}`);
  }, [company?.name, jobUrl, selectedJob]);

  const copy = async (value: string, success: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setNotice(success);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const improveMessage = async () => {
    if (!selectedJob) return;
    setGenerating(true);
    setNotice(null);
    try {
      const generated = await generateBroadcastMessage(`Oferta ${selectedJob.title}, sector ${sector}, lugar ${selectedJob.location}, empresa ${company?.name || ""}. Incluye este enlace sin modificarlo: ${jobUrl}`, "whatsapp");
      setMessage(generated);
    } catch {
      setNotice("No se pudo generar el texto. Puedes editar el mensaje manualmente.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div><h2 className="text-2xl font-extrabold text-gray-900">Difundir oferta</h2><p className="mt-1 text-sm text-gray-500">Prepara un mensaje y compártelo manualmente. MundoConnect no envía campañas automáticas.</p></div>
      {notice && <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{notice}</div>}

      <section className="space-y-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <label className="block text-sm font-bold text-gray-800">1. Elige una oferta publicada<select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3"><option value="">Selecciona una oferta</option>{activeJobs.map((job) => <option key={job.id} value={job.id}>{job.title} · {job.location}</option>)}</select></label>
        {activeJobs.length === 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">No tienes ofertas publicadas para difundir.</p>}

        <div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><label htmlFor="broadcast-message" className="text-sm font-bold text-gray-800">2. Revisa el mensaje</label><button type="button" onClick={() => void improveMessage()} disabled={!selectedJob || generating} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"><Wand2 size={16} /> {generating ? "Redactando..." : "Mejorar redacción"}</button></div><textarea id="broadcast-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={7} className="w-full rounded-xl border border-gray-200 p-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-emerald-500" /></div>

        <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => void copy(message, "Mensaje copiado.")} disabled={!message} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-bold text-white disabled:opacity-50">{copied ? <Check size={17} /> : <Copy size={17} />} Copiar mensaje</button><button type="button" onClick={() => void copy(jobUrl, "Enlace de la oferta copiado.")} disabled={!jobUrl} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-300 px-4 text-sm font-bold text-emerald-800 disabled:opacity-50"><Link size={17} /> Copiar enlace</button></div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><Users size={20} /></div><div><h3 className="font-extrabold text-gray-900">3. Contactos autorizados</h3><p className="text-sm text-gray-500">Abre WhatsApp individualmente. Revisa el mensaje antes de enviarlo.</p></div></div>{contacts.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">No hay contactos habilitados. Los datos aparecen después del interés mutuo y la contratación.</div> : <div className="mt-5 grid gap-3">{contacts.map((worker) => <div key={worker.id} className="flex flex-col justify-between gap-3 rounded-xl border border-gray-100 p-4 sm:flex-row sm:items-center"><div><div className="font-bold text-gray-900">{worker.name}</div><div className="text-sm text-gray-500">{worker.phone}</div></div><a href={`https://wa.me/${worker.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700"><MessageCircle size={17} /> Abrir WhatsApp</a></div>)}</div>}<div className="mt-4 flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-600"><Send className="mt-0.5 shrink-0" size={14} /> La plataforma abre WhatsApp; el envío sigue siendo manual y queda bajo responsabilidad de la empresa.</div></section>
    </div>
  );
};

export default Broadcasts;
