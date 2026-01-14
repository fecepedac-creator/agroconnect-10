
import React, { useState, useEffect, useMemo } from 'react';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { Company, JobOffer, Worker } from '../types';
import { generateBroadcastMessage } from '../services/geminiService';
import { calculateDistance } from '../services/geolocationService';
import { auth, db } from "../firebase";
import { 
  Megaphone, 
  Sparkles, 
  Loader2, 
  MapPin, 
  MessageCircle, 
  Building2, 
  Users, 
  Bus, 
  Utensils, 
  ShieldCheck, 
  Send, 
  Wand2, 
  Target, 
  Play, 
  SkipForward, 
  Check, 
  Zap, 
  UsersRound, 
  X, 
  ChevronRight, 
  Users2,
  Camera,
  Download,
  Share2,
  Search,
  Facebook,
  Instagram,
  Copy,
  CheckCircle2,
  Rocket,
  Palette,
  MonitorPlay
} from 'lucide-react';

interface BroadcastsProps {
  company: Company | null;
  jobs: JobOffer[];
  workers?: Worker[];
}

type AdTheme = 'OPORTUNIDADES' | 'CONEXION' | 'DIGITAL' | 'TRABAJO' | 'AI_CUSTOM';

type BroadcastRecord = {
  id: string;
  jobId?: string;
  message: string;
  createdAt?: any;
  totalTargets?: number;
  status?: string;
  createdBy?: { uid?: string; email?: string | null };
};

const THEMES = {
  OPORTUNIDADES: {
    bg: 'https://images.unsplash.com/photo-1542332213-31f87348057f?q=80&w=1000&auto=format&fit=crop',
    overlay: 'bg-emerald-900/45'
  },
  CONEXION: {
    bg: 'https://images.unsplash.com/photo-1516253593875-bd7ba052fbc5?q=80&w=1000&auto=format&fit=crop',
    overlay: 'bg-blue-900/50'
  },
  DIGITAL: {
    bg: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?q=80&w=1000&auto=format&fit=crop',
    overlay: 'bg-gray-900/60'
  },
  TRABAJO: {
    bg: 'https://images.unsplash.com/photo-1592388755653-83215c1e9389?q=80&w=1000&auto=format&fit=crop',
    overlay: 'bg-emerald-800/50'
  }
};

const Broadcasts: React.FC<BroadcastsProps> = ({ company, jobs, workers = [] }) => {
  const [activeSubTab, setActiveSubTab] = useState<'ADS' | 'HISTORY'>('ADS');
  const [selectedJobId, setSelectedJobId] = useState<string>(jobs[0]?.id || '');
  const [selectedTheme, setSelectedTheme] = useState<AdTheme>('OPORTUNIDADES');
  const [customAiBg, setCustomAiBg] = useState<string | null>(null);
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [broadcastText, setBroadcastText] = useState('');
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [broadcastNotice, setBroadcastNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(
    null
  );
  const [broadcastHistory, setBroadcastHistory] = useState<BroadcastRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchRadius, setSearchRadius] = useState(30);
  const [isTextCopied, setIsTextCopied] = useState(false);
  
  // Modals & Selection
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [workerSearchTerm, setWorkerSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'MY_TEAM' | 'RADAR'>('ALL');

  // Dispatcher Queue
  const [isDispatching, setIsDispatching] = useState(false);
  const [currentDispatchIndex, setCurrentDispatchIndex] = useState(0);

  const selectedJob = useMemo(() => jobs.find(j => j.id === selectedJobId), [jobs, selectedJobId]);
  const jobUrl = selectedJob ? `https://agroconnect.cl/oferta/${selectedJob.id}` : '';

  const detectedWorkers = useMemo(() => {
    if (!selectedJob) return [];
    return workers.map(w => {
      if (!w.coordinates) return { ...w, distance: 999 };
      const dist = calculateDistance(selectedJob.coordinates, w.coordinates);
      return { ...w, distance: dist };
    }).filter(w => w.distance <= searchRadius);
  }, [selectedJob, workers, searchRadius]);

  const myTeamInRadius = useMemo(() => detectedWorkers.filter(w => !w.id.startsWith('dg') && !w.id.startsWith('g')), [detectedWorkers]);
  const radarInRadius = useMemo(() => detectedWorkers.filter(w => w.id.startsWith('dg') || w.id.startsWith('g')), [detectedWorkers]);

  useEffect(() => {
    setSelectedWorkerIds(detectedWorkers.map(w => w.id));
  }, [detectedWorkers.length, selectedJobId]);

  useEffect(() => {
    if (!company?.id) return;
    setHistoryLoading(true);
    const q = query(
      collection(db, "companies", company.id, "broadcasts"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as BroadcastRecord[];
        setBroadcastHistory(list);
        setHistoryLoading(false);
      },
      (err) => {
        console.error("broadcasts history error:", err);
        setHistoryLoading(false);
      }
    );
    return () => unsub();
  }, [company?.id]);

  const generateAiBackground = async () => {
    if (!selectedJob) return;
    setBroadcastNotice({
      type: "info",
      message: "Generación de arte con IA está en preparación. Usa los estilos disponibles mientras tanto.",
    });
    setIsGeneratingImg(false);
  };

  const handleGenerateCaption = async () => {
    if (!selectedJob) return;
    setIsGeneratingText(true);
    setBroadcastNotice(null);
    const context = `Oferta laboral agrícola: ${selectedJob.title} en ${selectedJob.location}. Pago ${selectedJob.paymentType}. Beneficios incluidos. Invitación a postular mediante AgroConnect.`;
    try {
      const text = await generateBroadcastMessage(context, "whatsapp");
      setBroadcastText(text);
      if (text.toLowerCase().includes("no se pudo")) {
        setBroadcastNotice({ type: "error", message: text });
      }
    } catch (e: any) {
      setBroadcastNotice({ type: "error", message: "No se pudo generar el mensaje con IA." });
    } finally {
      setIsGeneratingText(false);
    }
  };

  const copyTextToClipboard = () => {
    navigator.clipboard.writeText(broadcastText);
    setIsTextCopied(true);
    setTimeout(() => setIsTextCopied(false), 2000);
  };

  const downloadAsset = () => {
    const link = document.createElement('a');
    link.href = customAiBg || THEMES[selectedTheme as keyof typeof THEMES]?.bg;
    link.download = `Anuncio_AgroConnect_${selectedJob?.title.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const prepareAndOpenRRSS = (type: 'ADS' | 'POST') => {
    // 1. Descargamos la imagen (para que el usuario la tenga a mano para subir)
    downloadAsset();
    // 2. Copiamos el texto al portapapeles
    copyTextToClipboard();
    // 3. Abrimos el destino
    if (type === 'ADS') {
      window.open('https://www.facebook.com/adsmanager/manage/campaigns', '_blank');
    } else {
      window.open('https://business.facebook.com/latest/composer', '_blank');
    }
  };

  const startCampaign = async () => {
    if (selectedWorkerIds.length === 0) {
      setIsSelectionModalOpen(true);
      return;
    }
    if (!broadcastText) {
      setBroadcastNotice({ type: "error", message: "Por favor redacta el mensaje antes de enviar." });
      return;
    }
    if (company?.id) {
      try {
        await addDoc(
          collection(db, "companies", company.id, "broadcasts"),
          {
            jobId: selectedJob?.id || null,
            message: broadcastText,
            totalTargets: selectedWorkerIds.length,
            status: "queued",
            createdAt: serverTimestamp(),
            createdBy: { uid: auth.currentUser?.uid, email: auth.currentUser?.email || null },
          }
        );
      } catch (e) {
        console.error("broadcasts save error:", e);
        setBroadcastNotice({ type: "error", message: "No se pudo registrar la difusión en Firestore." });
      }
    }
    setCurrentDispatchIndex(0);
    setIsDispatching(true);
    setIsSelectionModalOpen(false);
  };

  const openWhatsAppAndNext = () => {
    const workerId = selectedWorkerIds[currentDispatchIndex];
    const worker = workers.find(w => w.id === workerId);
    if (worker) {
      const cleanPhone = worker.phone.replace(/[^0-9]/g, '');
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(broadcastText)}`;
      window.open(waUrl, '_blank');
      
      if (currentDispatchIndex === selectedWorkerIds.length - 1) {
        setTimeout(() => {
          setIsDispatching(false);
          setBroadcastNotice({
            type: "success",
            message: `Difusión WhatsApp completada para ${selectedWorkerIds.length} contactos.`,
          });
        }, 800);
      } else {
        setCurrentDispatchIndex(prev => prev + 1);
      }
    }
  };

  const selectAllType = (type: 'TEAM' | 'RADAR' | 'ALL') => {
    if (type === 'TEAM') {
      setSelectedWorkerIds(prev => Array.from(new Set([...prev, ...myTeamInRadius.map(w => w.id)])));
    } else if (type === 'RADAR') {
      setSelectedWorkerIds(prev => Array.from(new Set([...prev, ...radarInRadius.map(w => w.id)])));
    } else {
      setSelectedWorkerIds(detectedWorkers.map(w => w.id));
    }
  };

  if (!jobs.length || !company) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p className="font-black uppercase tracking-widest text-[10px]">Cargando Creative Studio...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tighter italic uppercase flex items-center gap-3">
             Ad <span className="text-emerald-500 font-normal not-italic">Studio</span>
          </h2>
          <p className="text-gray-500 font-medium mt-1 tracking-tight">Marketing de Alto Impacto & Difusión Inteligente.</p>
        </div>
        <div className="flex bg-white p-1.5 rounded-2xl border border-gray-100 shadow-xl">
          <button onClick={() => setActiveSubTab('ADS')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'ADS' ? 'bg-gray-900 text-white shadow-2xl scale-105' : 'text-gray-400'}`}>Generador Pro</button>
          <button onClick={() => setActiveSubTab('HISTORY')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'HISTORY' ? 'bg-gray-900 text-white shadow-2xl scale-105' : 'text-gray-400'}`}>Reportes</button>
        </div>
      </div>

      {broadcastNotice && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            broadcastNotice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : broadcastNotice.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {broadcastNotice.message}
        </div>
      )}

      {activeSubTab === 'ADS' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div className="space-y-8">
            {/* 1. SELECCIÓN DE CUADRILLA */}
            <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-2xl space-y-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><Target size={120}/></div>
              <div className="flex justify-between items-center relative z-10">
                 <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-3 italic"><Target size={22} className="text-emerald-500"/> 1. Target & Audiencia</h3>
                 <button onClick={() => setIsSelectionModalOpen(true)} className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-600 transition-all shadow-xl active:scale-95">
                    <Users size={16}/> Gestionar ({selectedWorkerIds.length})
                 </button>
              </div>
              
              <div className="bg-gray-50 p-6 rounded-[2.5rem] border border-gray-100 relative shadow-inner">
                <div className="flex justify-between items-center mb-5 relative z-10">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Radio Operativo</span>
                    <span className="text-2xl font-black text-emerald-600 italic tracking-tighter">{searchRadius} KM</span>
                  </div>
                  <div className="flex gap-2 text-white">
                    <div className="bg-blue-600 px-4 py-2 rounded-2xl flex flex-col items-center shadow-lg"><span className="text-xs font-black">{myTeamInRadius.length}</span><span className="text-[8px] font-black uppercase">Equipo</span></div>
                    <div className="bg-purple-600 px-4 py-2 rounded-2xl flex flex-col items-center shadow-lg"><span className="text-xs font-black">{radarInRadius.length}</span><span className="text-[8px] font-black uppercase">Radar</span></div>
                  </div>
                </div>
                <input type="range" min="5" max="150" step="5" value={searchRadius} onChange={e => setSearchRadius(parseInt(e.target.value))} className="w-full h-2.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-emerald-500" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => selectAllType('TEAM')} className="bg-blue-50 hover:bg-blue-100 text-blue-700 py-4 rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all border border-blue-100 flex items-center justify-center gap-3">
                   <Users2 size={16}/> Cargar Mi Equipo
                </button>
                <button onClick={() => selectAllType('RADAR')} className="bg-purple-50 hover:bg-purple-100 text-purple-700 py-4 rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all border border-purple-100 flex items-center justify-center gap-3">
                   <Zap size={16}/> Cargar Radar Global
                </button>
              </div>
            </div>

            {/* 2. CREATIVE LAB (IA) */}
            <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-2xl space-y-7 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:rotate-12 transition-transform"><Palette size={120}/></div>
               <div className="flex justify-between items-center relative z-10">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-3 italic"><Camera size={22} className="text-emerald-500"/> 2. Creative Lab IA</h3>
                  <button
                    onClick={generateAiBackground}
                    disabled
                    className="flex items-center gap-3 bg-purple-600/60 text-white px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase shadow-2xl transition-all disabled:opacity-60 group cursor-not-allowed"
                  >
                     <Sparkles size={16} /> Generar Arte IA
                     <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold">En preparación</span>
                  </button>
               </div>
               
               <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-3">Oferta Activa</label>
                      <select className="w-full border-3 border-gray-50 rounded-[1.5rem] p-4 text-sm font-black bg-gray-50/50 outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all italic" value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}>
                        {jobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}
                      </select>
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-3">Estilos de Marca</label>
                       <div className="flex gap-2">
                          {(Object.keys(THEMES) as Array<keyof typeof THEMES>).map(themeKey => (
                            <button key={themeKey} onClick={() => setSelectedTheme(themeKey as AdTheme)} className={`w-10 h-10 rounded-xl overflow-hidden border-2 transition-all ${selectedTheme === themeKey ? 'border-emerald-500 scale-110 shadow-lg' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                              <img src={THEMES[themeKey].bg} className="w-full h-full object-cover" alt={themeKey} />
                            </button>
                          ))}
                          {customAiBg && (
                             <button onClick={() => setSelectedTheme('AI_CUSTOM')} className={`w-10 h-10 rounded-xl overflow-hidden border-2 transition-all ${selectedTheme === 'AI_CUSTOM' ? 'border-purple-500 scale-110 shadow-lg' : 'border-transparent opacity-40'}`}>
                               <img src={customAiBg} className="w-full h-full object-cover" alt="AI" />
                             </button>
                          )}
                       </div>
                    </div>
                  </div>
               </div>
            </div>

            {/* 3. MULTI-DISPATCHER (WHATSAPP + META) */}
            <div className="bg-gray-950 p-10 rounded-[4rem] shadow-2xl text-white space-y-7 relative overflow-hidden group">
               <div className="absolute -right-20 -bottom-20 opacity-5 group-hover:rotate-6 transition-transform"><MessageCircle size={400}/></div>
               <div className="flex justify-between items-center relative z-10">
                 <h3 className="text-sm font-black uppercase italic tracking-widest flex items-center gap-4"><MessageCircle size={26} className="text-emerald-400"/> 3. Omnicanal Ads</h3>
                 <div className="flex gap-2">
                   {broadcastText && (
                      <button onClick={copyTextToClipboard} className={`flex items-center gap-2 text-[10px] font-black uppercase px-4 py-2 rounded-xl transition-all ${isTextCopied ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                        {isTextCopied ? <CheckCircle2 size={14}/> : <Copy size={14}/>} {isTextCopied ? 'Copiado' : 'Copiar Texto'}
                      </button>
                   )}
                   <button onClick={handleGenerateCaption} disabled={isGeneratingText} className="text-[10px] font-black uppercase bg-emerald-500 hover:bg-white hover:text-emerald-600 px-6 py-3 rounded-2xl transition-all shadow-2xl active:scale-95 disabled:opacity-50">
                     {isGeneratingText ? <Loader2 size={16} className="animate-spin"/> : <Wand2 size={16}/>} IA Redactar
                   </button>
                 </div>
               </div>
               <textarea className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] p-7 text-sm font-medium h-40 text-white placeholder-white/20 outline-none focus:ring-4 focus:ring-emerald-500/30 transition-all italic" value={broadcastText} onChange={e => setBroadcastText(e.target.value)} placeholder="Ej: Hola! Tenemos nuevos cupos para cosecha..."></textarea>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button onClick={startCampaign} className="bg-emerald-500 hover:bg-emerald-400 text-white py-7 rounded-[2rem] font-black uppercase text-sm tracking-widest flex items-center justify-center gap-4 shadow-xl active:scale-95 transition-all">
                    <Zap size={22}/> WhatsApp Masivo
                  </button>
                  <div className="flex gap-2">
                     <button onClick={() => prepareAndOpenRRSS('POST')} className="flex-1 bg-white/10 hover:bg-white text-white hover:text-gray-900 rounded-[2rem] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all group">
                        <Instagram size={18} className="group-hover:scale-110 transition-transform"/> Post RRSS
                     </button>
                     <button onClick={() => prepareAndOpenRRSS('ADS')} className="flex-1 bg-blue-600 hover:bg-white text-white hover:text-blue-600 rounded-[2rem] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all group">
                        <MonitorPlay size={18} className="group-hover:rotate-6 transition-transform"/> Meta Ads
                     </button>
                  </div>
               </div>
               <div className="text-center">
                  <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest animate-pulse flex items-center justify-center gap-2 italic">
                    <Rocket size={10}/> Sistema listo para preparar activos y abrir RRSS automáticamente
                  </p>
               </div>
            </div>
          </div>

          {/* PREVIEW STORY (ESTILO RED SOCIAL) */}
          <div className="sticky top-12 space-y-10">
             {selectedJob && (
               <div className="bg-white rounded-[5.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.3)] overflow-hidden border-[18px] border-gray-950 relative mx-auto aspect-[9/16] max-w-[340px] group transition-all duration-700 hover:shadow-emerald-500/30">
                  {/* Background Layer */}
                  <div className="absolute inset-0 bg-cover bg-center transition-transform duration-[2000ms] group-hover:scale-110" style={{ backgroundImage: `url('${selectedTheme === 'AI_CUSTOM' ? customAiBg : THEMES[selectedTheme as keyof typeof THEMES]?.bg}')` }} />
                  <div className={`absolute inset-0 transition-opacity duration-[1500ms] ${THEMES[selectedTheme as keyof typeof THEMES]?.overlay || 'bg-black/60'}`} />
                  
                  {/* Ad Elements */}
                  <div className="absolute inset-0 flex flex-col p-12 text-white text-center">
                     <div className="mt-8 mb-10 space-y-5">
                        <div className="w-18 h-18 bg-white/95 backdrop-blur-xl rounded-3xl p-3.5 mx-auto shadow-2xl flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-500 border-2 border-emerald-500/20">
                          {company.logoUrl ? <img src={company.logoUrl} alt="Logo" className="w-full h-full object-contain" /> : <Building2 size={36} className="text-emerald-600" />}
                        </div>
                        <h2 className="text-[12px] font-black uppercase tracking-[0.4em] drop-shadow-2xl opacity-90">{company.name}</h2>
                     </div>

                     <div className="flex-1 flex flex-col justify-center items-center space-y-12">
                        <div className="space-y-6">
                           <div className="inline-block bg-white text-emerald-900 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl transform -rotate-3 group-hover:rotate-0 transition-all">Vacante Urgente</div>
                           <h3 className="font-black uppercase tracking-tighter leading-[0.7] text-[3.2rem] italic drop-shadow-[0_15px_15px_rgba(0,0,0,0.6)] text-white">
                             {selectedJob.title.split(' ').map((word, i) => (
                               <span key={i} className="block">{word}</span>
                             ))}
                           </h3>
                        </div>

                        <div className="bg-white/10 backdrop-blur-3xl border border-white/20 p-8 rounded-[3.5rem] w-full text-left space-y-4 shadow-2xl transform transition-transform group-hover:translate-y-[-5px]">
                           <div className="flex items-center gap-4">
                              <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg"><Check size={18} strokeWidth={4}/></div>
                              <p className="text-[11px] font-black uppercase tracking-[0.1em]">{selectedJob.paymentType}</p>
                           </div>
                           <div className="flex items-center gap-4">
                              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shadow-lg"><Bus size={18} strokeWidth={3}/></div>
                              <p className="text-[11px] font-black uppercase tracking-[0.1em]">{selectedJob.benefits?.transport ? 'Bus Acercamiento' : 'Transporte Propio'}</p>
                           </div>
                        </div>

                        <div className="bg-emerald-500 text-white px-14 py-6 rounded-[2rem] font-black text-sm uppercase tracking-[0.3em] shadow-[0_20px_40px_rgba(16,185,129,0.5)] transform transition-all group-hover:scale-110 active:scale-95 cursor-pointer ring-4 ring-white/10">
                          POSTULAR AQUÍ
                        </div>
                     </div>

                     <div className="mt-auto pt-10 border-t border-white/10 flex items-center justify-between">
                        <div className="text-left">
                           <p className="text-[10px] font-black italic tracking-[0.2em] opacity-50 uppercase">AgroConnect</p>
                           <p className="text-[10px] font-black uppercase tracking-[0.1em] italic text-emerald-400 mt-1">Temporada {new Date().getFullYear()}</p>
                        </div>
                        <div className="bg-white p-2.5 rounded-[1.5rem] shadow-2xl transform group-hover:rotate-6 transition-transform">
                           <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(jobUrl)}`} alt="QR" className="w-12 h-12" />
                        </div>
                     </div>
                  </div>

                  {/* IA Loading */}
                  {isGeneratingImg && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-3xl z-20 flex flex-col items-center justify-center text-white p-12">
                       <div className="relative mb-10">
                          <Loader2 size={80} className="animate-spin text-emerald-400 relative z-10"/>
                          <Sparkles size={32} className="absolute -top-4 -right-4 text-white animate-pulse" />
                       </div>
                       <span className="text-sm font-black uppercase tracking-[0.4em] text-center italic leading-loose">
                          Diseñando Campaña<br/>con Inteligencia Artificial...
                       </span>
                    </div>
                  )}
               </div>
             )}
             
             {/* ACTIONS PANEL */}
             <div className="flex flex-col gap-6 w-full max-w-[340px] mx-auto">
                <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-4">
                   <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600"><MonitorPlay size={20}/></div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Asset Management</h4>
                   </div>
                   <div className="space-y-2">
                      <div className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl">
                         <span className="text-[10px] font-black text-gray-400 uppercase">Arte Digital</span>
                         <button onClick={downloadAsset} className="text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-2">
                           <Download size={16}/> <span className="text-[9px] font-black uppercase">Descargar</span>
                         </button>
                      </div>
                      <div className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl">
                         <span className="text-[10px] font-black text-gray-400 uppercase">Copy Publicitario</span>
                         <button onClick={copyTextToClipboard} className="text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-2">
                           {isTextCopied ? <CheckCircle2 size={16}/> : <Copy size={16}/>} <span className="text-[9px] font-black uppercase">{isTextCopied ? 'Copiado' : 'Copiar'}</span>
                         </button>
                      </div>
                   </div>
                   <button onClick={() => prepareAndOpenRRSS('POST')} className="w-full bg-gray-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl active:scale-95 transform">
                      <Rocket size={16}/> Preparar & Publicar en Meta
                   </button>
                </div>
             </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[3rem] border border-gray-100 shadow-2xl overflow-hidden p-10">
          <div className="flex items-center gap-3 mb-6">
            <Megaphone size={28} className="text-emerald-500" />
            <div>
              <div className="text-lg font-black uppercase tracking-[0.2em] text-gray-800">Historial de Difusiones</div>
              <div className="text-xs text-gray-500">Registros en Firestore</div>
            </div>
          </div>

          {historyLoading ? (
            <div className="text-sm text-gray-400">Cargando historial...</div>
          ) : broadcastHistory.length === 0 ? (
            <div className="text-sm text-gray-400">Sin registros aún.</div>
          ) : (
            <div className="space-y-4">
              {broadcastHistory.map((item) => (
                <div key={item.id} className="border border-gray-100 rounded-2xl p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-semibold text-gray-800">
                      {item.status ? item.status.toString().toUpperCase() : "SIN ESTADO"}
                    </div>
                    <div className="text-xs text-gray-400">
                      {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString("es-CL") : "—"}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">{item.message}</div>
                  <div className="text-xs text-gray-400">
                    {item.totalTargets ? `${item.totalTargets} destinatarios` : "Destinatarios no definidos"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DISPATCHER ENGINE OVERLAY */}
      {isDispatching && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-950/98 backdrop-blur-[50px] animate-in zoom-in duration-500">
           <div className="bg-white rounded-[5rem] w-full max-w-xl p-16 text-center shadow-[0_50px_100px_rgba(0,0,0,0.5)] relative overflow-hidden border border-white/10">
              <div className="absolute top-0 left-0 w-full h-4 bg-gray-100">
                 <div className="h-full bg-emerald-500 transition-all duration-700 shadow-[0_0_30px_rgba(16,185,129,0.7)]" style={{ width: `${((currentDispatchIndex + 1) / selectedWorkerIds.length) * 100}%` }}></div>
              </div>

              <div className="mb-12 pt-10">
                 <div className="w-28 h-28 bg-emerald-100 rounded-[3rem] flex items-center justify-center text-emerald-600 mx-auto mb-8 animate-pulse shadow-inner ring-8 ring-emerald-50">
                    <MessageCircle size={56} />
                 </div>
                 <h3 className="text-3xl font-black text-gray-900 uppercase italic tracking-tighter">AgroConnect Dispatcher</h3>
                 <p className="text-sm text-gray-400 font-bold uppercase mt-2 tracking-widest italic">Difundiendo {currentDispatchIndex + 1} de {selectedWorkerIds.length}</p>
              </div>

              <div className="bg-gray-50 rounded-[3.5rem] border border-gray-100 mb-12 max-h-72 overflow-y-auto custom-scrollbar p-6">
                 {selectedWorkerIds.slice(currentDispatchIndex, currentDispatchIndex + 15).map((wid, idx) => {
                    const w = workers.find(worker => worker.id === wid);
                    const isFirst = idx === 0;
                    return (
                       <div key={wid} className={`p-6 flex items-center gap-6 border-b border-gray-100 last:border-0 rounded-[2rem] transition-all duration-500 ${isFirst ? 'bg-white shadow-2xl border-emerald-500 scale-[1.05] z-10' : 'opacity-20 grayscale'}`}>
                          <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center text-white text-base font-black shrink-0 shadow-xl ${isFirst ? 'bg-emerald-600' : 'bg-gray-400'}`}>
                             {w?.name.charAt(0)}
                          </div>
                          <div className="text-left flex-1">
                             <p className={`text-lg font-black uppercase tracking-tight ${isFirst ? 'text-gray-900' : 'text-gray-400'}`}>{w?.name}</p>
                             <p className="text-xs font-mono font-bold text-gray-400 tracking-wider mt-1">{w?.phone}</p>
                          </div>
                          {isFirst && <div className="bg-emerald-500 text-white text-[10px] font-black px-5 py-2.5 rounded-full uppercase animate-bounce shadow-xl">Ahora</div>}
                       </div>
                    );
                 })}
              </div>

              <div className="flex flex-col gap-6">
                 <button onClick={openWhatsAppAndNext} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-8 rounded-[2.5rem] font-black uppercase text-base tracking-[0.2em] shadow-2xl flex items-center justify-center gap-6 transition-all active:scale-95 transform">
                    <Play size={28} className="fill-current"/> Abrir WhatsApp Chat
                 </button>
                 <div className="grid grid-cols-2 gap-6">
                    <button onClick={() => setCurrentDispatchIndex(prev => Math.min(prev + 1, selectedWorkerIds.length - 1))} className="py-5 text-gray-400 font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 hover:bg-gray-100 rounded-[2rem] transition-colors">
                       <SkipForward size={20}/> Saltar
                    </button>
                    <button onClick={() => setIsDispatching(false)} className="py-5 text-red-400 font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 hover:bg-red-50 rounded-[2rem] transition-colors">
                       <X size={20}/> Cancelar
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* WORKER SELECTION MODAL */}
      {isSelectionModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-[30px] animate-in fade-in duration-500">
           <div className="bg-white rounded-[4rem] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-[0_50px_100px_rgba(0,0,0,0.5)] overflow-hidden border border-white/20">
              <div className="p-12 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                 <div>
                    <h3 className="font-black text-gray-900 uppercase tracking-tighter italic text-4xl flex items-center gap-5">
                       <UsersRound size={44} className="text-emerald-600"/> Gestor de Cola
                    </h3>
                    <p className="text-[11px] text-gray-400 font-black uppercase mt-2 tracking-[0.3em] italic">Base de Datos Dinámica: {detectedWorkers.length} talentos detectados</p>
                 </div>
                 <button onClick={() => setIsSelectionModalOpen(false)} className="bg-white p-4 rounded-full shadow-2xl text-gray-400 hover:text-red-500 transition-all transform hover:rotate-90"><X size={32}/></button>
              </div>

              <div className="bg-white border-b border-gray-100 p-8 flex flex-col md:flex-row gap-6 items-center">
                 <div className="relative flex-1 w-full">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300" size={24}/>
                    <input type="text" placeholder="Filtrar por nombre o rut..." className="w-full pl-16 pr-8 py-5 border-3 border-gray-50 rounded-[2rem] text-sm font-black bg-gray-50/50 focus:border-emerald-500 outline-none transition-all italic" value={workerSearchTerm} onChange={e => setWorkerSearchTerm(e.target.value)} />
                 </div>
                 <div className="flex bg-gray-100 p-2 rounded-[1.5rem] shrink-0 shadow-inner">
                    <button onClick={() => setFilterType('ALL')} className={`px-7 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'ALL' ? 'bg-white text-emerald-600 shadow-xl' : 'text-gray-400'}`}>Todos</button>
                    <button onClick={() => setFilterType('MY_TEAM')} className={`px-7 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'MY_TEAM' ? 'bg-white text-blue-600 shadow-xl' : 'text-gray-400'}`}>Equipo</button>
                    <button onClick={() => setFilterType('RADAR')} className={`px-7 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'RADAR' ? 'bg-white text-purple-600 shadow-xl' : 'text-gray-400'}`}>Radar</button>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-4 bg-gray-50/30 custom-scrollbar">
                 <div className="grid grid-cols-2 gap-6 mb-6 sticky top-0 z-10">
                    <button onClick={() => selectAllType('TEAM')} className="bg-blue-600 text-white py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"><Users2 size={16}/> Sumar Todo Mi Equipo</button>
                    <button onClick={() => selectAllType('RADAR')} className="bg-purple-600 text-white py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"><Zap size={16}/> Sumar Todo el Radar</button>
                 </div>

                 {detectedWorkers
                  .filter(w => {
                    const matchesSearch = w.name.toLowerCase().includes(workerSearchTerm.toLowerCase()) || w.rut.includes(workerSearchTerm);
                    const isRadar = w.id.startsWith('dg') || w.id.startsWith('g');
                    if (filterType === 'MY_TEAM') return matchesSearch && !isRadar;
                    if (filterType === 'RADAR') return matchesSearch && isRadar;
                    return matchesSearch;
                  })
                  .map(worker => {
                    const isSelected = selectedWorkerIds.includes(worker.id);
                    const isRadar = worker.id.startsWith('dg') || worker.id.startsWith('g');
                    return (
                      <div key={worker.id} onClick={() => setSelectedWorkerIds(prev => isSelected ? prev.filter(id => id !== worker.id) : [...prev, worker.id])} className={`flex items-center gap-6 p-6 rounded-[2.5rem] border-3 transition-all cursor-pointer hover:border-emerald-200 group ${isSelected ? 'bg-white border-emerald-500 shadow-2xl' : 'bg-white/40 border-transparent opacity-60'}`}>
                         <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center text-white text-xl font-black shrink-0 shadow-2xl transition-transform group-hover:rotate-6 ${isRadar ? 'bg-purple-500' : 'bg-blue-500'}`}>
                            {worker.name.charAt(0)}
                         </div>
                         <div className="flex-1">
                            <h4 className="font-black text-gray-900 uppercase tracking-tighter text-base italic">{worker.name}</h4>
                            <div className="flex items-center gap-3 mt-1">
                               <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm ${isRadar ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>{isRadar ? 'Radar' : 'Equipo'}</span>
                               <p className="text-[11px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-2 italic"><MapPin size={14} className="text-emerald-500"/> {worker.distance.toFixed(1)} km</p>
                            </div>
                         </div>
                         <div className={`w-10 h-10 rounded-full border-3 flex items-center justify-center transition-all duration-500 ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white shadow-2xl scale-110' : 'border-gray-100 text-transparent'}`}>
                            <Check size={24} strokeWidth={4}/>
                         </div>
                      </div>
                    );
                  })
                 }
              </div>

              <div className="p-12 bg-white border-t border-gray-100 flex flex-col md:flex-row gap-10 items-center">
                 <div className="flex-1 text-center md:text-left">
                    <p className="text-5xl font-black text-gray-900 tracking-tighter italic">{selectedWorkerIds.length}</p>
                    <p className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.3em] mt-2 italic leading-none">Candidatos en cola de envío</p>
                 </div>
                 <div className="flex gap-4 w-full md:w-auto">
                    <button onClick={() => setSelectedWorkerIds([])} className="px-10 py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-widest text-gray-400 border-3 border-gray-50 hover:bg-gray-50 transition-colors">Limpiar</button>
                    <button onClick={startCampaign} className="flex-1 md:flex-none px-16 py-6 bg-gray-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.3em] shadow-2xl flex items-center justify-center gap-4 transform active:scale-95 transition-all">
                       Confirmar <ChevronRight size={22}/>
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Broadcasts;
