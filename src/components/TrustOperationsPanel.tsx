import {useEffect, useMemo, useState} from "react";
import {collection, limit, onSnapshot, query, where} from "firebase/firestore";
import {httpsCallable} from "firebase/functions";
import {AlertTriangle, CheckCircle2, ShieldAlert, Trash2} from "lucide-react";
import {db, functions} from "../firebase";

type SafetyReport = {
  id: string;
  category?: string;
  details?: string;
  companyId?: string;
  jobId?: string;
  reporterEmail?: string;
  createdAt?: any;
};

type DeletionRequest = {
  id: string;
  uid?: string;
  email?: string;
  requestedAt?: any;
};

const formatDate = (value: any) => {
  const date = value?.toDate?.() ?? null;
  return date ? date.toLocaleString("es-CL") : "Fecha pendiente";
};

export default function TrustOperationsPanel() {
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [deletions, setDeletions] = useState<DeletionRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{kind: "success" | "error"; text: string} | null>(null);

  useEffect(() => {
    const reportsQuery = query(
      collection(db, "safety_reports"),
      where("status", "==", "open"),
      limit(50)
    );
    const deletionsQuery = query(
      collection(db, "data_deletion_requests"),
      where("status", "==", "pending"),
      limit(50)
    );
    const unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
      setReports(snapshot.docs.map((document) => ({id: document.id, ...document.data()})));
    });
    const unsubscribeDeletions = onSnapshot(deletionsQuery, (snapshot) => {
      setDeletions(snapshot.docs.map((document) => ({id: document.id, ...document.data()})));
    });
    return () => {
      unsubscribeReports();
      unsubscribeDeletions();
    };
  }, []);

  const pendingTotal = useMemo(() => reports.length + deletions.length, [reports.length, deletions.length]);

  const reviewReport = async (
    reportId: string,
    decision: "resolve" | "dismiss" | "suspend_job" | "suspend_company"
  ) => {
    const resolutionNote = (notes[`report:${reportId}`] || "").trim();
    if (resolutionNote.length < 5) {
      setNotice({kind: "error", text: "Agrega una nota de resoluciÃ³n de al menos 5 caracteres."});
      return;
    }
    if (decision.startsWith("suspend_") && !window.confirm("Esta acciÃ³n suspenderÃ¡ acceso o visibilidad inmediatamente. Â¿Continuar?")) return;
    setBusy(`report:${reportId}`);
    setNotice(null);
    try {
      await httpsCallable(functions, "reviewSafetyReport")({reportId, decision, resolutionNote});
      setNotice({kind: "success", text: "Denuncia procesada y registrada en auditorÃ­a."});
    } catch (error: any) {
      setNotice({kind: "error", text: error?.message || "No se pudo procesar la denuncia."});
    } finally {
      setBusy(null);
    }
  };

  const reviewDeletion = async (uid: string, decision: "complete" | "reject") => {
    const resolutionNote = (notes[`deletion:${uid}`] || "").trim();
    if (resolutionNote.length < 5) {
      setNotice({kind: "error", text: "Agrega una nota de resoluciÃ³n de al menos 5 caracteres."});
      return;
    }
    if (decision === "complete" && !window.confirm("La cuenta, perfil y datos operativos se eliminarÃ¡n o anonimizarÃ¡n de forma irreversible. Â¿Continuar?")) return;
    setBusy(`deletion:${uid}`);
    setNotice(null);
    try {
      await httpsCallable(functions, "reviewDataDeletionRequest")({uid, decision, resolutionNote});
      setNotice({kind: "success", text: decision === "complete" ? "EliminaciÃ³n completada." : "Solicitud rechazada con trazabilidad."});
    } catch (error: any) {
      setNotice({kind: "error", text: error?.message || "No se pudo procesar la solicitud."});
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-300"><ShieldAlert size={18} /><span className="text-xs font-black uppercase tracking-[0.18em]">Confianza y privacidad</span></div>
            <h2 className="mt-2 text-2xl font-black">Cola operativa SuperAdmin</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">Toda resoluciÃ³n pasa por Functions, exige privilegios vigentes y deja evidencia de auditorÃ­a.</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-5 py-4 text-center"><div className="text-3xl font-black">{pendingTotal}</div><div className="text-xs font-bold text-slate-300">pendientes</div></div>
        </div>
      </div>

      {notice && <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${notice.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{notice.text}</div>}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><AlertTriangle className="text-amber-600" size={20} />Denuncias abiertas</h3><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">{reports.length}</span></div>
        <div className="mt-4 space-y-4">
          {reports.map((report) => {
            const key = `report:${report.id}`;
            return <article key={report.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-black text-slate-900">{report.category || "Sin categorÃ­a"}</div><div className="text-xs text-slate-500">{formatDate(report.createdAt)} | Empresa {report.companyId} | Oferta {report.jobId}</div></div><span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">requiere revisiÃ³n</span></div>
              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{report.details}</p>
              <textarea value={notes[key] || ""} onChange={(event) => setNotes((current) => ({...current, [key]: event.target.value}))} placeholder="InvestigaciÃ³n realizada y motivo de la decisiÃ³n" className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200" />
              <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy === key} onClick={() => reviewReport(report.id, "resolve")} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Resolver</button><button disabled={busy === key} onClick={() => reviewReport(report.id, "dismiss")} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-50">Descartar</button><button disabled={busy === key} onClick={() => reviewReport(report.id, "suspend_job")} className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Suspender oferta</button><button disabled={busy === key} onClick={() => reviewReport(report.id, "suspend_company")} className="rounded-xl bg-red-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Suspender empresa</button></div>
            </article>;
          })}
          {reports.length === 0 && <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><CheckCircle2 size={18} />No hay denuncias abiertas.</div>}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><Trash2 className="text-red-600" size={20} />EliminaciÃ³n de datos</h3><span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-800">{deletions.length}</span></div>
        <div className="mt-4 space-y-4">
          {deletions.map((request) => {
            const uid = request.uid || request.id;
            const key = `deletion:${uid}`;
            return <article key={request.id} className="rounded-2xl border border-slate-200 p-4"><div className="font-black text-slate-900">{request.email || "Cuenta sin correo"}</div><div className="text-xs text-slate-500">{formatDate(request.requestedAt)} | UID {uid}</div><textarea value={notes[key] || ""} onChange={(event) => setNotes((current) => ({...current, [key]: event.target.value}))} placeholder="VerificaciÃ³n de identidad y motivo de la resoluciÃ³n" className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200" /><div className="mt-3 flex flex-wrap gap-2"><button disabled={busy === key} onClick={() => reviewDeletion(uid, "complete")} className="rounded-xl bg-red-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Eliminar y anonimizar</button><button disabled={busy === key} onClick={() => reviewDeletion(uid, "reject")} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-50">Rechazar solicitud</button></div></article>;
          })}
          {deletions.length === 0 && <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><CheckCircle2 size={18} />No hay eliminaciones pendientes.</div>}
        </div>
      </section>
    </div>
  );
}
