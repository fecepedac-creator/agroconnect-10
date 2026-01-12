import React, { useEffect, useState } from "react";
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Bot, ShieldCheck, AlertCircle, RefreshCw, TrendingUp, Users, Briefcase } from "lucide-react";
import { db, functions } from "../firebase";

type AuditResult = {
  healthScore: number;
  summary: string;
  risks: string[];
  recommendations: string[];
  dataQualityNotes: string[];
};

type AuditRecord = {
  id: string;
  createdAt?: any;
  inputs?: any;
  output?: AuditResult;
};

const AIReview: React.FC = () => {
  const [result, setResult] = useState<AuditResult | null>(null);
  const [latestInputs, setLatestInputs] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AuditRecord[]>([]);

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
      const fn = httpsCallable(functions, "runOperationalAudit");
      const res = await fn({});
      const payload = res.data as { metrics?: any; analysis?: AuditResult };

      if (!payload?.analysis) {
        throw new Error("Respuesta inválida del análisis.");
      }

      setResult(payload.analysis);
      setLatestInputs(payload.metrics || null);

      await addDoc(collection(db, "audits"), {
        createdAt: serverTimestamp(),
        inputs: payload.metrics || null,
        output: payload.analysis,
      });
    } catch (e: any) {
      console.error("runOperationalAudit error:", e);
      const message = String(e?.message || "");
      if (message.toLowerCase().includes("no configurada") || message.toLowerCase().includes("gemini")) {
        setError("IA no configurada aún. Configura GEMINI_API_KEY en Cloud Functions.");
      } else {
        setError("No se pudo ejecutar el análisis. Revisa la consola para más detalles.");
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
          Análisis en tiempo real de métricas operativas desde Firestore para detectar riesgos y oportunidades.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Users size={20} /></div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold">Empresas activas</p>
            <p className="text-sm font-medium">{latestInputs?.totalCompaniesActive ?? "—"}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600"><Briefcase size={20} /></div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold">Ofertas activas</p>
            <p className="text-sm font-medium">{latestInputs?.totalJobsActive ?? "—"}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="bg-amber-50 p-2 rounded-lg text-amber-600"><TrendingUp size={20} /></div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold">Estado del análisis</p>
            <p className="text-sm font-medium">{result ? "Completo" : "Pendiente"}</p>
          </div>
        </div>
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
              La IA revisará métricas agregadas (empresas, ofertas, postulaciones y leads).
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
                <div className="text-sm font-semibold text-gray-700">Score de salud</div>
                <div className="text-2xl font-black text-gray-900 mt-1">{result.healthScore}</div>
                <p className="text-sm text-gray-600 mt-2">{result.summary}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                  <div className="text-sm font-semibold text-gray-700 mb-2">Riesgos</div>
                  <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                    {(result.risks || []).map((risk, idx) => (
                      <li key={`risk-${idx}`}>{risk}</li>
                    ))}
                    {(!result.risks || result.risks.length === 0) && <li>Sin riesgos críticos reportados.</li>}
                  </ul>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                  <div className="text-sm font-semibold text-gray-700 mb-2">Recomendaciones</div>
                  <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                    {(result.recommendations || []).map((rec, idx) => (
                      <li key={`rec-${idx}`}>{rec}</li>
                    ))}
                    {(!result.recommendations || result.recommendations.length === 0) && <li>Sin recomendaciones adicionales.</li>}
                  </ul>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <div className="text-sm font-semibold text-gray-700 mb-2">Notas de calidad de datos</div>
                <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                  {(result.dataQualityNotes || []).map((note, idx) => (
                    <li key={`dq-${idx}`}>{note}</li>
                  ))}
                  {(!result.dataQualityNotes || result.dataQualityNotes.length === 0) && <li>Sin observaciones.</li>}
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
                  <div className="font-semibold text-gray-800">Score: {item.output?.healthScore ?? "—"}</div>
                  <div className="text-xs text-gray-500">{item.output?.summary || "Sin resumen"}</div>
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
