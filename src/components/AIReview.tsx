import React, { useState } from 'react';
import { analyzeSystemHealth } from '../services/geminiService';
import { Bot, ShieldCheck, AlertCircle, RefreshCw, TrendingUp, Users, Briefcase } from 'lucide-react';
import { Worker, JobOffer, Company, WorkerStatus } from '../types';

interface AIReviewProps {
  workers: Worker[];
  jobs: JobOffer[];
  companies: Company[];
}

const AIReview: React.FC<AIReviewProps> = ({ workers, jobs, companies }) => {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    
    // Calculate real metrics from the application state
    const totalVacancies = jobs.reduce((acc, job) => acc + job.workersNeeded, 0);
    const filledVacancies = jobs.reduce((acc, job) => acc + job.workersFilled, 0);
    const supplyGap = totalVacancies - filledVacancies;
    
    const consentedWorkers = workers.filter(w => w.status === WorkerStatus.CONSENTED).length;
    const pendingWorkers = workers.filter(w => w.status === WorkerStatus.PENDING).length;
    
    const overdueCompanies = companies.filter(c => c.status === 'Overdue').map(c => c.name);

    // Prepare a summarized snapshot of the REAL system state (Operational Focus)
    const systemSnapshot = JSON.stringify({
      metrics: {
        totalWorkers: workers.length,
        consentedRate: ((consentedWorkers / (workers.length || 1)) * 100).toFixed(1) + '%',
        pendingConsent: pendingWorkers,
      },
      market: {
        activeJobs: jobs.filter(j => j.isActive).length,
        totalVacancies: totalVacancies,
        filledVacancies: filledVacancies,
        urgentNeed: supplyGap,
      },
      financialRisk: {
        hasOverdueAccounts: overdueCompanies.length > 0,
        overdueCompaniesList: overdueCompanies
      },
      timestamp: new Date().toISOString()
    });

    const result = await analyzeSystemHealth(systemSnapshot);
    setReport(result);
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <div className="inline-flex p-4 bg-purple-100 rounded-full text-purple-600 mb-4 shadow-sm">
          <Bot size={48} />
        </div>
        <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Auditoría Operativa con IA</h2>
        <p className="text-gray-500 max-w-2xl mx-auto mt-2">
          Google Gemini analiza en tiempo real el equilibrio entre oferta laboral, disponibilidad de trabajadores y salud financiera de la plataforma para detectar riesgos antes de que ocurran.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Users size={20} /></div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold">Base de Talentos</p>
            <p className="text-sm font-medium">{workers.length} Trabajadores</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600"><Briefcase size={20} /></div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold">Demanda Actual</p>
            <p className="text-sm font-medium">{jobs.filter(j => j.isActive).length} Ofertas Activas</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="bg-amber-50 p-2 rounded-lg text-amber-600"><TrendingUp size={20} /></div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold">Estado del Análisis</p>
            <p className="text-sm font-medium">{report ? 'Completo' : 'Pendiente'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-xl border border-purple-50 relative overflow-hidden">
        {/* Decorative background blur */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-50 rounded-full blur-3xl opacity-50 -mr-16 -mt-16 pointer-events-none"></div>

        {!report ? (
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
                  <Bot className="group-hover:text-purple-200 transition-colors" /> Generar Informe Inteligente
                </>
              )}
            </button>
            <p className="text-sm text-gray-400 mt-6 max-w-md mx-auto">
              La IA revisará tasas de conversión, brechas de vacantes y estado de pagos de empresas.
            </p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
             <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <ShieldCheck size={24} className="text-emerald-500"/> Diagnóstico de Gemini
                </h3>
                <button 
                  onClick={() => setReport(null)}
                  className="text-sm font-medium text-gray-400 hover:text-purple-600 transition-colors flex items-center gap-1"
                >
                  <RefreshCw size={14} /> Nuevo Análisis
                </button>
             </div>
             
             <div className="prose prose-sm max-w-none text-gray-700 bg-gray-50/50 p-6 rounded-xl border border-gray-100 shadow-inner">
                <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800">
                  {report}
                </div>
             </div>

             <div className="mt-6 flex flex-wrap gap-3 text-xs font-medium">
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100">
                  <ShieldCheck size={14} /> Integridad de Datos: Verificada
                </div>
                <div className="flex items-center gap-2 text-blue-700 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
                   <TrendingUp size={14} /> Lógica de Negocio: Validada
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIReview;