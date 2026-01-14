
import React, { useState, useEffect } from 'react';
import { JobOffer, Company } from '../types';
import { generateJobDescription } from '../services/geminiService';
import { getCurrentPosition } from '../services/geolocationService';
import { applicantStore, Applicant } from '../services/applicantStore';
import { db } from '../firebase';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
// Added ThumbsUp to imports
import { 
  Plus, 
  Wand2, 
  MapPin, 
  AlertOctagon, 
  Users as UsersIcon, 
  X, 
  Briefcase, 
  Bus, 
  Utensils, 
  Coins, 
  ShieldCheck, 
  Loader2, 
  Trash2, 
  Navigation, 
  Globe,
  Sparkles,
  CheckCircle,
  ThumbsUp
} from 'lucide-react';

interface JobsProps {
  jobs: JobOffer[];
  setJobs: React.Dispatch<React.SetStateAction<JobOffer[]>>;
  currentCompany: Company | null;
}

const CATEGORIES = ['Cosecha', 'Packing', 'Poda', 'Maquinaria', 'Otros'];
const PAYMENT_TYPES = ['Al Día', 'Semanal', 'Quincenal', 'Por Kilo'];

const Jobs: React.FC<JobsProps> = ({ jobs, setJobs, currentCompany }) => {
  const [showForm, setShowForm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [activeTab, setActiveTab] = useState<'future' | 'active' | 'closed'>('active');
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const [newJob, setNewJob] = useState<Partial<JobOffer> & { lat?: number; lng?: number }>({
    title: '',
    description: '',
    workersNeeded: 10,
    startDate: new Date().toISOString().split('T')[0],
    location: '',
    category: 'Cosecha',
    paymentType: 'Al Día',
    benefits: { transport: false, lunch: false },
    transportInfo: '',
    otherBenefits: '',
    lat: -34.985, 
    lng: -71.239
  });

  const isSuspended = currentCompany?.status === 'Overdue';

  // --- Firestore sync: companies/{companyId}/jobs ---
  useEffect(() => {
    if (!currentCompany?.id) return;

    const q = query(
      collection(db, 'companies', currentCompany.id, 'jobs'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data: any = d.data();
          return {
            id: d.id,
            title: data.title ?? '',
            description: data.description ?? '',
            workersNeeded: data.workersNeeded ?? 1,
            workersFilled: data.workersFilled ?? 0,
            startDate: data.startDate ?? '',
            location: data.location ?? '',
            coordinates: data.coordinates ?? data.coordinates ?? { lat: -33.4489, lng: -70.6693 },
            isActive: data.isActive ?? false,
            jobStatus: data.jobStatus ?? (data.isActive ? 'active' : 'future'),
            qrCodeUrl: data.qrCodeUrl ?? '',
            category: data.category ?? 'Otros',
            paymentType: data.paymentType ?? 'Al Día',
            benefits: data.benefits ?? { transport: false, lunch: false },
            transportInfo: data.transportInfo ?? '',
            otherBenefits: data.otherBenefits ?? '',
          } as JobOffer;
        });
        setJobs(list);
      },
      (err) => {
        console.error(err);
        // Si hay rules insuficientes, lo verás aquí
      }
    );

    return () => unsub();
  }, [currentCompany?.id, setJobs]);

  const handleGenerateAI = async () => {
    // Validamos que al menos tengamos título y ubicación básica para dar contexto a la IA
    if (!newJob.title || !newJob.location) {
      setNotice({ type: 'error', message: "Ingresa el título y la ubicación para generar la oferta con IA." });
      return;
    }

    setIsGenerating(true);
    
    // Construimos un contexto rico para que la IA genere una mejor descripción
    const context = `
      Puesto: ${newJob.title}
      Categoría: ${newJob.category}
      Ubicación: ${newJob.location}
      Pago: ${newJob.paymentType}
      Beneficios: ${newJob.benefits?.lunch ? 'Incluye almuerzo/colación' : 'Sin colación'}, ${newJob.benefits?.transport ? 'Transporte incluido: ' + newJob.transportInfo : 'Sin bus'}
      Implementos de seguridad: ${newJob.otherBenefits || 'No especificado'}
      Cupos: ${newJob.workersNeeded}
    `;

    try {
      const result = await generateJobDescription(context);
      setNewJob(prev => ({ ...prev, description: result }));
      if (result.toLowerCase().includes("no se pudo")) {
        setNotice({ type: 'error', message: result });
      }
    } catch (error) {
      console.error(error);
      setNotice({ type: 'error', message: "Hubo un problema generando la descripción con IA." });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGetLocation = async () => {
    setIsGettingLocation(true);
    try {
      const coords = await getCurrentPosition();
      setNewJob(prev => ({
        ...prev,
        lat: coords.lat,
        lng: coords.lng,
        location: prev.location || 'Ubicación GPS capturada'
      }));
    } catch (error) {
      setNotice({ type: 'error', message: "No se pudo obtener la ubicación GPS automática." });
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const lat = -33.0 - (y / rect.height) * 5;
    const lng = -70.0 - (x / rect.width) * 3;
    setNewJob(prev => ({ ...prev, lat, lng }));
  };

  const handleCreateJob = async () => {
    if (!newJob.title || !newJob.description) {
      setNotice({ type: 'error', message: "Completa el título y la descripción antes de publicar." });
      return;
    }
    
    const finalCoords =
      newJob.lat && newJob.lng
        ? { lat: newJob.lat, lng: newJob.lng }
        : { lat: -33.4489, lng: -70.6693 };

    if (!currentCompany?.id) {
      setNotice({ type: 'error', message: "No hay empresa activa. Vuelve a iniciar sesión como empresa." });
      return;
    }

    try {
      const payload = {
        title: newJob.title || '',
        description: newJob.description || '',
        workersNeeded: newJob.workersNeeded || 1,
        workersFilled: 0,
        startDate: newJob.startDate || '',
        location: newJob.location || '',
        coordinates: finalCoords,
        isActive: false,
        jobStatus: 'future',
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=AgroConnect-${Date.now()}`,
        category: newJob.category as any,
        paymentType: newJob.paymentType as any,
        benefits: newJob.benefits,
        transportInfo: newJob.transportInfo,
        otherBenefits: newJob.otherBenefits,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'companies', currentCompany.id, 'jobs'), payload);

      setShowForm(false);
      setActiveTab('future');
      setNotice({ type: 'success', message: "Oferta creada correctamente." });
      setNewJob({
        title: '',
        description: '',
        workersNeeded: 10,
        startDate: new Date().toISOString().split('T')[0],
        location: '',
        category: 'Cosecha',
        paymentType: 'Al Día',
        benefits: { transport: false, lunch: false },
        transportInfo: '',
        otherBenefits: '',
        lat: -34.985,
        lng: -71.239,
      });
    } catch (error: any) {
      console.error(error);
      setNotice({ type: 'error', message: `No se pudo publicar la oferta: ${error?.message || error}` });
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('¿Eliminar?')) return;
    if (!currentCompany?.id) {
      setNotice({ type: 'error', message: 'No hay empresa activa.' });
      return;
    }
    try {
      await deleteDoc(doc(db, 'companies', currentCompany.id, 'jobs', jobId));
      setNotice({ type: 'success', message: 'Oferta eliminada.' });
    } catch (e: any) {
      console.error(e);
      setNotice({ type: 'error', message: `No se pudo eliminar: ${e?.message || e}` });
    }
  };


  const filteredJobs = jobs.filter(j => (j.jobStatus || 'active') === activeTab);

  return (
    <div className="space-y-6">
      {isSuspended && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-4 animate-in slide-in-from-top">
           <div className="bg-red-100 p-2 rounded-full text-red-600"><AlertOctagon size={24} /></div>
           <div><h3 className="font-bold text-red-800">Cuenta Suspendida</h3><p className="text-sm text-red-600">Regularice su deuda para publicar nuevas ofertas.</p></div>
        </div>
      )}

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : notice.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {notice.message}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Gestión de Ofertas</h2>
        <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
          {(['future', 'active', 'closed'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>{tab === 'future' ? 'Futuras' : tab === 'active' ? 'Activas' : 'Cerradas'}</button>
          ))}
        </div>
        <button onClick={() => setShowForm(!showForm)} disabled={isSuspended} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors shadow-sm ${isSuspended ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>{showForm ? <X size={18} /> : <Plus size={18} />}{showForm ? 'Cancelar' : 'Nueva Oferta'}</button>
      </div>

      {showForm && (
        <div className="bg-white p-8 rounded-3xl shadow-2xl border border-emerald-100 animate-fade-in space-y-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-6">
              <h3 className="font-black text-gray-800 flex items-center gap-2 uppercase tracking-tighter italic"><Briefcase size={22} className="text-emerald-500"/> Configuración de la Oferta</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Título del Puesto</label><input type="text" className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none" value={newJob.title} onChange={e => setNewJob({...newJob, title: e.target.value})} placeholder="Ej: Cosechero de Manzanas" /></div>
                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Categoría</label><select className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm bg-white font-bold" value={newJob.category} onChange={e => setNewJob({...newJob, category: e.target.value as any})}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tipo de Pago</label><select className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm bg-white font-bold" value={newJob.paymentType} onChange={e => setNewJob({...newJob, paymentType: e.target.value as any})}>{PAYMENT_TYPES.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Fecha de Inicio</label><input type="date" className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm font-bold" value={newJob.startDate} onChange={e => setNewJob({...newJob, startDate: e.target.value})} /></div>
                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nombre Ubicación</label><input type="text" className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm font-bold" value={newJob.location} onChange={e => setNewJob({...newJob, location: e.target.value})} placeholder="Ej: Fundo El Olivar" /></div>
              </div>

              <div className="bg-gray-50 p-5 rounded-2xl border-2 border-dashed border-gray-200 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><MapPin size={16} className="text-emerald-500"/> Ubicación GPS</span>
                  <div className="flex gap-2">
                    <button onClick={handleGetLocation} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-emerald-50 hover:border-emerald-200 transition-all">
                      {isGettingLocation ? <Loader2 size={12} className="animate-spin"/> : <Navigation size={12}/>} Mi GPS
                    </button>
                    <button onClick={() => setShowMapPicker(true)} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-emerald-700 shadow-sm transition-all">
                      <Globe size={12}/> Ubicar en Mapa
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-inner flex flex-col items-center">
                    <span className="text-[9px] font-black text-gray-400 uppercase mb-1">Latitud</span>
                    <span className="text-xs font-mono font-bold text-emerald-600">{newJob.lat?.toFixed(6) || '—'}</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-inner flex flex-col items-center">
                    <span className="text-[9px] font-black text-gray-400 uppercase mb-1">Longitud</span>
                    <span className="text-xs font-mono font-bold text-emerald-600">{newJob.lng?.toFixed(6) || '—'}</span>
                  </div>
                </div>
              </div>

              <h3 className="font-black text-gray-800 flex items-center gap-2 pt-4 uppercase tracking-tighter italic"><ThumbsUp size={22} className="text-emerald-500"/> Beneficios y Kit</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl border-2 transition-all ${newJob.benefits?.transport ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}>
                  <div className="flex justify-between items-center mb-3">
                    <span className="flex items-center gap-2 font-bold text-sm"><Bus size={20} className={newJob.benefits?.transport ? 'text-blue-600' : 'text-gray-300'}/> Bus de Acercamiento</span>
                    <input type="checkbox" checked={newJob.benefits?.transport} onChange={e => setNewJob({...newJob, benefits: {...newJob.benefits, transport: e.target.checked}})} className="w-5 h-5 accent-blue-600 cursor-pointer" />
                  </div>
                  {newJob.benefits?.transport && <input type="text" className="w-full bg-white border border-blue-100 rounded-lg p-2 text-xs font-bold outline-none" placeholder="Ej: Plaza de Curicó 06:00 AM" value={newJob.transportInfo} onChange={e => setNewJob({...newJob, transportInfo: e.target.value})} />}
                </div>
                <div className={`p-4 rounded-xl border-2 transition-all flex justify-between items-center ${newJob.benefits?.lunch ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'}`}>
                   <span className="flex items-center gap-2 font-bold text-sm"><Utensils size={20} className={newJob.benefits?.lunch ? 'text-orange-600' : 'text-gray-300'}/> Almuerzo Incluido</span>
                   <input type="checkbox" checked={newJob.benefits?.lunch} onChange={e => setNewJob({...newJob, benefits: {...newJob.benefits, lunch: e.target.checked}})} className="w-5 h-5 accent-orange-600 cursor-pointer" />
                </div>
              </div>

              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 space-y-2">
                <label className="block text-[10px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={16}/> Kit de Trabajo (Bloqueador, Guantes, etc.)</label>
                <input type="text" className="w-full bg-white border-2 border-emerald-100 rounded-xl p-3 text-sm font-bold outline-none" placeholder="Ej: Gorro, bloqueador y guantes incluidos." value={newJob.otherBenefits} onChange={e => setNewJob({...newJob, otherBenefits: e.target.value})} />
              </div>
            </div>

            <div className="space-y-6 flex flex-col">
              <div className="bg-gray-900 rounded-3xl p-8 text-white flex-1 flex flex-col shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5"><Sparkles size={120}/></div>
                <div className="flex justify-between items-center mb-6 relative z-10">
                  <h3 className="text-xl font-bold flex items-center gap-2 italic">Redacción Inteligente</h3>
                  <button 
                    onClick={handleGenerateAI} 
                    disabled={isGenerating} 
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isGenerating ? <Loader2 size={16} className="animate-spin"/> : <Wand2 size={16}/>} 
                    {isGenerating ? 'Redactando...' : 'Mejorar con IA'}
                  </button>
                </div>
                
                <textarea 
                  className="flex-1 w-full bg-white/10 border border-white/20 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none text-white placeholder-white/30" 
                  rows={12} 
                  value={newJob.description} 
                  onChange={e => setNewJob({...newJob, description: e.target.value})} 
                  placeholder="Aquí aparecerá la descripción profesional generada por la IA..."
                ></textarea>
                
                <div className="mt-8 pt-8 border-t border-white/10">
                   <div className="flex justify-between items-center mb-4">
                     <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Vacantes: {newJob.workersNeeded}</p>
                     <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-black">{newJob.workersNeeded} PERS.</span>
                   </div>
                   <input type="range" min="1" max="150" className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500" value={newJob.workersNeeded} onChange={e => setNewJob({...newJob, workersNeeded: parseInt(e.target.value)})} />
                </div>
                
                <button onClick={handleCreateJob} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-4 rounded-2xl font-black uppercase tracking-widest mt-8 shadow-xl shadow-emerald-500/20 transition-all transform active:scale-95">Publicar Oferta Laboral</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MAPA */}
      {showMapPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter italic">Seleccionar Ubicación Visual</h3>
              <button onClick={() => setShowMapPicker(false)} className="bg-white p-2 rounded-full shadow-sm text-gray-400 hover:text-red-500 transition-colors"><X size={20}/></button>
            </div>
            <div className="flex-1 relative bg-slate-100 overflow-hidden cursor-crosshair group" onClick={handleMapClick}>
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:20px_20px]"></div>
              {newJob.lat && (
                <div className="absolute transition-all duration-300 pointer-events-none" style={{ top: `${((newJob.lat + 33.0) / -5) * 100}%`, left: `${((newJob.lng! + 70.0) / -3) * 100}%` }}>
                  <div className="relative -top-10 -left-5">
                    <div className="bg-emerald-600 text-white p-2 rounded-full shadow-2xl border-2 border-white animate-bounce"><MapPin size={24} /></div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button onClick={() => setShowMapPicker(false)} className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Confirmar Punto</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredJobs.map(job => (
          <div key={job.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
            <div className="p-6 flex-1">
              <div className="flex justify-between items-start mb-4">
                <div>
                   <span className="text-[10px] font-black uppercase bg-gray-100 text-gray-500 px-2 py-0.5 rounded mr-2 tracking-widest">{job.category}</span>
                   <h3 className="font-bold text-gray-800 text-lg mt-1 tracking-tight leading-tight">{job.title}</h3>
                </div>
                {job.qrCodeUrl && <img src={job.qrCodeUrl} className="w-10 h-10 shadow-sm rounded-lg" alt="QR" />}
              </div>
              <div className="flex gap-2 mb-4">
                 <div className={`p-2 rounded-lg border ${job.benefits?.transport ? 'bg-blue-50 border-blue-100 text-blue-600 shadow-sm' : 'bg-gray-50 border-gray-100 text-gray-300'}`}><Bus size={18}/></div>
                 <div className={`p-2 rounded-lg border ${job.benefits?.lunch ? 'bg-orange-50 border-orange-100 text-orange-600 shadow-sm' : 'bg-gray-50 border-gray-100 text-gray-300'}`}><Utensils size={18}/></div>
                 <div className="p-2 rounded-lg border bg-emerald-50 border-emerald-100 text-emerald-600 flex items-center gap-1 shadow-sm"><Coins size={16}/><span className="text-[10px] font-black uppercase tracking-tighter">{job.paymentType}</span></div>
              </div>
              <p className="text-gray-600 text-sm line-clamp-2 mb-4 leading-relaxed">{job.description}</p>
              <div className="flex justify-between text-xs text-gray-400 font-bold border-t pt-3">
                <span className="flex items-center gap-1"><MapPin size={12} className="text-emerald-500" />{job.location}</span>
                <span className="flex items-center gap-1"><UsersIcon size={12} className="text-blue-500"/> {job.workersFilled}/{job.workersNeeded}</span>
              </div>
            </div>
            <div className="bg-gray-50 p-4 flex gap-2 border-t border-gray-100">
              <button className="flex-1 bg-white border border-gray-200 text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all shadow-sm">Postulantes</button>
              <button onClick={() => handleDeleteJob(job.id)} className="p-2.5 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Jobs;
