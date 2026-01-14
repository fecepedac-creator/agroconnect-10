import React, { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Bot, ShieldCheck, AlertCircle, RefreshCw } from "lucide-react";
import { db, functions } from "../firebase";

type AuditResult = {
  summary: string;
  checklist: string[];
  risks: string[];
  nextSteps: string[];
};

type AuditRecord = {
  id: string;
  createdAt?: any;
  inputs?: any;
  output?: AuditResult;
  meta?: any;
};

const AIReview: React.FC = () => {
  const [result, setResult] = useState<AuditResult | null>(null);
  const [latestInputs, setLatestInputs] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AuditRecord[]>([]);
  const [subject, setSubject] = useState("");
  const [context, setContext] = useState("");

  useEffect(() => {
    const q = query(collection(db, "audits"), orderBy("createdAt", "desc"), limit(5));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as AuditRecord[];
        setHistory(list);
        if (!result && list.length > 0) {
          setResult(list[0].output || null);
          setLatestInputs(list[0].inputs || null);
        }
      },
      (err) => {
        console.error("audits snapshot error:", err);
      }
    );
    return () => unsub();
  }, [result]);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!subject.trim()) {
        setError("Describe la entidad, empresa o actividad a revisar.");
        return;
      }
      const fn = httpsCallable(functions, "aiReview");
      const res = await fn({ subject: subject.trim(), context: context.trim() || undefined });
      const payload = res.data as { output?: AuditResult; auditId?: string };

      if (!payload?.output) {
        throw new Error("Respuesta inválida del análisis.");
      }

      setResult(payload.output);
      setLatestInputs({ subject: subject.trim(), context: context.trim() || null });
      if (payload.auditId) {
        // eslint-disable-next-line no-console
        console.info(`[Auditoría IA] Audit guardado: ${payload.auditId}`);
      }
    } catch (e: any) {
      console.error("runOperationalAudit error:", e);
      const message = String(e?.message || "");
      const code = String(e?.code || "");
      if (code.includes("failed-precondition") || message.toLowerCase().includes("no configurada")) {
        setError("IA no configurada aún. Configura GEMINI_API_KEY en Cloud Functions.");
      } else if (code.includes("permission-denied")) {
        setError("No tienes permisos para ejecutar la auditoría.");
      } else {
        setError(`No se pudo ejecutar el análisis. ${message || "Revisa la consola para más detalles."}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <div className="inline-flex p-4 bg-purple-100 rounded-full text-purple-600 mb-4 shadow-sm">
          <Bot size={48} />
        </div>
        <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Auditoría Operativa con IA</h2>
        <p className="text-gray-500 max-w-2xl mx-auto mt-2">
          Revisión rápida de una entidad, empresa o actividad con checklist y próximos pasos.
        </p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-xl border border-purple-50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-50 rounded-full blur-3xl opacity-50 -mr-16 -mt-16 pointer-events-none"></div>

        {error && (
          <div className="mb-6 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {!result ? (
          <div className="text-center py-12 relative z-10">
            <div className="max-w-xl mx-auto text-left space-y-4 mb-8">
              <div>
                <label className="text-xs font-semibold text-gray-600">Entidad / Empresa / Actividad</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full mt-2 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Ej: Frutícola Los Andes, campaña de cosecha 2024"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Contexto adicional (opcional)</label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="w-full mt-2 rounded-xl border border-gray-200 px-3 py-2 text-sm h-24"
                  placeholder="Ej: Problemas con asistencia, retrasos en pagos, alta rotación."
                />
              </div>
            </div>
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="group relative bg-gray-900 text-white px-8 py-4 rounded-full hover:bg-purple-700 transition-all font-bold shadow-lg hover:shadow-2xl disabled:opacity-70 flex items-center gap-3 mx-auto"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" /> Procesando Datos...
                </>
              ) : (
                <>
                  <Bot className="group-hover:text-purple-200 transition-colors" /> Nuevo Análisis
                </>
              )}
            </button>
            <p className="text-sm text-gray-400 mt-6 max-w-md mx-auto">
              La IA devolverá un checklist de control y recomendaciones inmediatas.
            </p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
            <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <ShieldCheck size={24} className="text-emerald-500" /> Diagnóstico de IA
              </h3>
              <button
                onClick={() => setResult(null)}
                className="text-sm font-medium text-gray-400 hover:text-purple-600 transition-colors flex items-center gap-1"
              >
                <RefreshCw size={14} /> Nuevo análisis
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50/60 p-4 rounded-xl border border-gray-100">
                <div className="text-sm font-semibold text-gray-700">Resumen</div>
                <div className="text-sm text-gray-600 mt-2">{result.summary}</div>
                {latestInputs?.subject && (
                  <div className="text-xs text-gray-400 mt-3">Sujeto: {latestInputs.subject}</div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                  <div className="text-sm font-semibold text-gray-700 mb-2">Checklist</div>
                  <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                    {(result.checklist || []).map((item, idx) => (
                      <li key={`check-${idx}`}>{item}</li>
                    ))}
                    {(!result.checklist || result.checklist.length === 0) && <li>No hay ítems registrados.</li>}
                  </ul>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                  <div className="text-sm font-semibold text-gray-700 mb-2">Riesgos detectados</div>
                  <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                    {(result.risks || []).map((risk, idx) => (
                      <li key={`risk-${idx}`}>{risk}</li>
                    ))}
                    {(!result.risks || result.risks.length === 0) && <li>Sin riesgos críticos reportados.</li>}
                  </ul>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <div className="text-sm font-semibold text-gray-700 mb-2">Próximos pasos</div>
                <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                  {(result.nextSteps || []).map((note, idx) => (
                    <li key={`next-${idx}`}>{note}</li>
                  ))}
                  {(!result.nextSteps || result.nextSteps.length === 0) && <li>Sin acciones sugeridas.</li>}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="text-sm font-semibold text-gray-700 mb-3">Últimos análisis</div>
          <div className="space-y-3 text-sm text-gray-600">
            {history.map((item) => (
              <div key={item.id} className="flex items-center justify-between border border-gray-100 rounded-xl p-3">
                <div>
                  <div className="font-semibold text-gray-800">Resumen: {item.output?.summary ?? "—"}</div>
                  <div className="text-xs text-gray-500">
                    {item.inputs?.subject || item.meta?.type || "Sin detalle"}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setResult(item.output || null);
                    setLatestInputs(item.inputs || null);
                  }}
                  className="text-xs font-bold text-purple-600 hover:text-purple-800"
                >
                  Ver
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIReview;
