
import React, { useState, useEffect } from 'react';
import { JobOffer, Coordinates, WorkerTab } from '../types';
import { getCurrentPosition, calculateDistance } from '../services/geolocationService';
import { LEGAL_CONTENT } from '../legalContent';
import { applicantStore, Applicant } from '../services/applicantStore';
import { 
  MapPin, 
  User, 
  CheckCircle2, 
  LogOut, 
  Briefcase, 
  KeyRound, 
  Bus, 
  Utensils, 
  Coins, 
  Info,
  X,
  FileText,
  ShieldCheck,
  Navigation,
  Calendar,
  Phone,
  Lock
} from 'lucide-react';
import * as rut from 'rut.js';

interface WorkerPortalProps {
  jobs: JobOffer[];
  onLogout: () => void;
}

interface JobWithDistance extends JobOffer {
  distance?: number;
}

const CATEGORIES = [
  { id: 'all', label: 'Todos', emoji: '' },
  { id: 'Cosecha', label: 'Cosecha', emoji: '🍒' },
  { id: 'Packing', label: 'Packing', emoji: '🏭' },
  { id: 'Maquinaria', label: 'Maquinaria', emoji: '🚜' },
  { id: 'Poda', label: 'Poda', emoji: '✂️' },
];

const SESSION_KEY = 'agroconnect_worker_session';

const WorkerPortal: React.FC<WorkerPortalProps> = ({ jobs, onLogout }) => {
  const [activeTab, setActiveTab] = useState<WorkerTab>(WorkerTab.PROFILE);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<{name: string, rut: string} | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [isAvailable, setIsAvailable] = useState(true);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [sortedJobs, setSortedJobs] = useState<JobWithDistance[]>(jobs);
  const [applications, setApplications] = useState<(Applicant & { jobId: string, jobTitle: string })[]>([]);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const [loginRut, setLoginRut] = useState('');
  const [password, setPassword] = useState('');

  const [regData, setRegData] = useState({
    name: '', rut: '', phone: '', password: '', confirmPassword: ''
  });
  const [isRutValid, setIsRutValid] = useState(false);
  
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showFullTerms, setShowFullTerms] = useState(false);
  
  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9kK.-]/g, '');
    const formattedRut = rut.format(rawValue);
    const isValid = rut.validate(formattedRut);
    setRegData({ ...regData, rut: formattedRut });
    setIsRutValid(isValid);
  };

  useEffect(() => {
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      try {
        const user = JSON.parse(savedSession);
        setCurrentUser(user);
        setIsLoggedIn(true);
        setActiveTab(WorkerTab.JOBS);
      } catch (e) { console.error("Failed to parse session", e); }
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      const apps = applicantStore.getAllWorkerApplications(currentUser.rut);
      setApplications(apps.map(app => ({
        ...app,
        jobTitle: jobs.find(j => j.id === app.jobId)?.title || 'Oferta Desconocida'
      })));
    }
  }, [currentUser, jobs]);
  
  useEffect(() => {
    if (isLoggedIn) {
        setActiveTab(WorkerTab.JOBS);
    }
  }, [isLoggedIn]);

  const handleApply = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn) { setActiveTab(WorkerTab.PROFILE); return; }
    if (confirm("¿Confirmas tu postulación a esta oferta?")) {
      applicantStore.addApplicant(jobId, {
        workerId: currentUser!.rut,
        workerName: currentUser!.name,
        skills: [],
        appliedAt: new Date().toISOString()
      });
      const apps = applicantStore.getAllWorkerApplications(currentUser!.rut);
      setApplications(apps.map(app => ({...app, jobTitle: jobs.find(j => j.id === app.jobId)?.title || 'Oferta' })));
      alert("✅ ¡Postulación enviada con éxito!");
    }
  };

  useEffect(() => {
    let filtered = selectedCategory === 'all' ? jobs : jobs.filter(j => j.category === selectedCategory);
    if (userLocation) {
      const withDist = filtered.map(job => ({ ...job, distance: calculateDistance(userLocation, job.coordinates) }));
      withDist.sort((a, b) => (a.distance || 999) - (b.distance || 999));
      setSortedJobs(withDist);
    } else {
      setSortedJobs(filtered);
    }
  }, [userLocation, jobs, selectedCategory]);

  const renderJobsTab = () => (
    <div className="pb-24">
      <div className="bg-emerald-600 p-6 rounded-b-3xl shadow-lg mb-6 text-white text-center">
        <h2 className="text-xl font-bold">Hola, {currentUser?.name.split(' ')[0] || 'Trabajador'} 👋</h2>
        <p className="text-emerald-100 text-sm mb-4">Encuentra faenas agrícolas cercanas</p>
        <button onClick={async () => setUserLocation(await getCurrentPosition())} className="bg-white/20 px-4 py-2 rounded-full text-xs font-bold hover:bg-white/30 transition-colors flex items-center gap-2 mx-auto shadow-md">
          {userLocation ? <><CheckCircle2 size={14}/> GPS Activo</> : <><MapPin size={14}/> Activar Cercanía GPS</>}
        </button>
      </div>

      <div className="px-4 mb-6 overflow-x-auto no-scrollbar flex gap-2">
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-all ${selectedCategory === cat.id ? 'bg-emerald-600 text-white' : 'bg-white text-gray-500 border-gray-100'}`}>
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-4">
        {sortedJobs.map(job => {
          const isApplied = applications.some(app => app.jobId === job.id);
          const isExpanded = expandedJobId === job.id;
          return (
            <div key={job.id} onClick={() => setExpandedJobId(isExpanded ? null : job.id)} className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all ${isExpanded ? 'ring-2 ring-emerald-500 shadow-md scale-[1.02]' : ''}`}>
              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{job.category}</span>
                    <h3 className="font-bold text-gray-800 text-lg mt-1 leading-tight">{job.title}</h3>
                  </div>
                  {job.distance !== undefined && <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">a {job.distance.toFixed(1)} km</span>}
                </div>
                
                <div className="flex gap-3 mb-4">
                   <div className="bg-emerald-50 text-emerald-700 p-2 rounded-xl flex flex-col items-center justify-center w-14 h-14 border border-emerald-100"><Coins size={18}/><span className="text-[8px] font-black mt-1 uppercase text-center">{job.paymentType}</span></div>
                   <div className={`p-2 rounded-xl flex flex-col items-center justify-center w-14 h-14 border ${job.benefits?.transport ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-gray-50 text-gray-300 border-gray-100'}`}><Bus size={18}/><span className="text-[8px] font-black mt-1 uppercase">Bus</span></div>
                   <div className={`p-2 rounded-xl flex flex-col items-center justify-center w-14 h-14 border ${job.benefits?.lunch ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-gray-50 text-gray-300 border-gray-100'}`}><Utensils size={18}/><span className="text-[8px] font-black mt-1 uppercase">Almuerzo</span></div>
                </div>

                {isExpanded && (
                  <div className="border-t pt-4 mb-4 animate-in slide-in-from-top-2">
                    <p className="text-gray-600 text-sm mb-4 leading-relaxed">{job.description}</p>
                    
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 italic">Detalles y Logística de Faena</h4>
                    <div className="space-y-3">
                      {job.benefits?.transport && (
                        <div className="flex gap-3 items-start p-3 bg-blue-50 rounded-xl border border-blue-100">
                           <Navigation size={18} className="text-blue-600 shrink-0" />
                           <div>
                             <p className="text-xs font-bold text-blue-800 uppercase tracking-tighter">Traslado</p>
                             <p className="text-xs text-blue-600 mt-0.5">{job.transportInfo || 'Se informará al confirmar.'}</p>
                           </div>
                        </div>
                      )}
                      {job.otherBenefits && (
                        <div className="flex gap-3 items-start p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                           <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                           <div>
                             <p className="text-xs font-bold text-emerald-800 uppercase tracking-tighter">Kit de Seguridad / Extras</p>
                             <p className="text-xs text-emerald-600 mt-0.5">{job.otherBenefits}</p>
                           </div>
                        </div>
                      )}
                      <div className="flex gap-3 items-start p-3 bg-gray-50 rounded-xl border border-gray-100">
                         <MapPin size={18} className="text-gray-400 shrink-0" />
                         <div>
                           <p className="text-xs font-bold text-gray-700 uppercase tracking-tighter">Ubicación Faena</p>
                           <p className="text-xs text-gray-500 mt-0.5">{job.location}</p>
                         </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase"><Calendar size={14} className="text-emerald-500"/> {job.startDate}</div>
                  {isApplied ? (
                    <button disabled className="bg-emerald-100 text-emerald-700 px-6 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1"><CheckCircle2 size={14}/> Ya Postulado</button>
                  ) : (
                    <button onClick={(e) => handleApply(job.id, e)} className="bg-gray-900 text-white px-6 py-2 rounded-xl text-xs font-black uppercase hover:bg-black transition-all shadow-md active:scale-95">Postular Ahora</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderProfileTab = () => {
    if (!isLoggedIn) {
      if (isRegistering) {
        
        const handleRegister = () => {
          if (!regData.name || !regData.rut || !regData.phone || !regData.password) {
            alert("¡Ups! Parece que faltan campos por completar.");
            return;
          }
           if (!isRutValid) {
            alert("El RUT ingresado no es válido.");
            return;
          }
          if (regData.phone.length !== 8) {
            alert("¡Atención! El número de teléfono debe tener 8 dígitos.");
            return;
          }
          if (regData.password !== regData.confirmPassword) {
            alert("¡Atención! Las contraseñas que ingresaste no coinciden.");
            return;
          }
          if (!acceptedTerms) {
            alert("Para continuar, es necesario que aceptes los términos y condiciones.");
            return;
          }

          const newUser = { name: regData.name, rut: regData.rut, phone: `+569${regData.phone}`, password: regData.password };

          localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));

          alert(`¡Bienvenido a AgroConnect, ${newUser.name.split(' ')[0]}! Tu perfil ha sido creado.`);

          setCurrentUser(newUser);
          setIsLoggedIn(true);
          setIsRegistering(false);
        };

        return (
          <div className="px-6 py-10 space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Crea tu Cuenta</h2>
              <p className="text-gray-500 text-sm">Regístrate para postular a ofertas.</p>
            </div>
            <div className="space-y-3">
              <div className="relative"><User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input type="text" required className="w-full p-4 pl-12 border border-gray-200 rounded-2xl text-sm font-bold" placeholder="Nombre Completo" value={regData.name} onInput={(e) => e.currentTarget.value = e.currentTarget.value.toUpperCase()} onChange={e => setRegData({...regData, name: e.target.value})} /></div>
              <div className="relative">
                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  required 
                  className={`w-full p-4 pl-12 pr-12 border rounded-2xl text-sm font-bold ${isRutValid ? 'border-emerald-500' : 'border-gray-200'}`}
                  placeholder="RUT (EJ: 12.345.678-9)" 
                  value={regData.rut} 
                  onChange={handleRutChange} 
                />
                {isRutValid && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />}
              </div>
              <div className="relative flex items-center"><Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><span className="p-4 pl-12 border border-r-0 border-gray-200 rounded-l-2xl text-sm font-bold bg-gray-100 text-gray-500">+569</span><input type="tel" required maxLength={8} className="w-full p-4 border border-gray-200 rounded-r-2xl text-sm font-bold" placeholder="8 dígitos" value={regData.phone} onChange={e => setRegData({...regData, phone: e.target.value.replace(/[^0-9]/g, '')})} /></div>
              <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input type="password" required className="w-full p-4 pl-12 border border-gray-200 rounded-2xl text-sm" placeholder="Contraseña" value={regData.password} onChange={e => setRegData({...regData, password: e.target.value})} /></div>
              <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input type="password" required className="w-full p-4 pl-12 border border-gray-200 rounded-2xl text-sm" placeholder="Confirmar Contraseña" value={regData.confirmPassword} onChange={e => setRegData({...regData, confirmPassword: e.target.value})} /></div>

               <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                  <h4 className="font-bold text-blue-800 text-[10px] uppercase flex items-center gap-2 tracking-widest"><Info size={14}/> Resumen Legal Trabajador</h4>
                  <ul className="mt-2 space-y-1">
                    {LEGAL_CONTENT.legal.summaries.worker_standard.bullets.map((b,i) => <li key={i} className="text-[10px] text-blue-700 leading-tight font-medium italic">• {b}</li>)}
                  </ul>
               </div>

               <div className="flex items-start gap-3 pt-2">
                  <input id="terms" type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="mt-1 w-5 h-5 accent-emerald-600 shrink-0" />
                  <label htmlFor="terms" className="text-[11px] text-gray-500 font-bold leading-tight">Acepto los <button onClick={() => setShowFullTerms(true)} className="text-emerald-700 font-black underline">términos y condiciones</button> de AgroConnect Chile.</label>
               </div>

               <button onClick={handleRegister} disabled={!acceptedTerms || !isRutValid} className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg transform transition-all active:scale-95 ${acceptedTerms && isRutValid ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>Crear Perfil</button>
               <button onClick={() => setIsRegistering(false)} className="w-full text-xs font-bold text-gray-500 pt-2">¿Ya tienes cuenta? Ingresa aquí</button>
            </div>
          </div>
        );
      }
      return (
        <div className="px-6 py-20 flex flex-col items-center">
          <div className="bg-emerald-100 p-5 rounded-full mb-6 text-emerald-600 shadow-inner"><KeyRound size={48}/></div>
          <h2 className="text-2xl font-black text-gray-800 mb-8 uppercase tracking-tighter">Ingreso Trabajador</h2>
          <div className="w-full space-y-4">
            <input type="text" value={loginRut} onChange={e => setLoginRut(rut.format(e.target.value))} className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="RUT (12.345.678-9)" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Contraseña" />
            <button onClick={() => {
                const savedSession = localStorage.getItem(SESSION_KEY);
                if (savedSession) {
                    try {
                      const user = JSON.parse(savedSession);
                      if(user.rut === loginRut && user.password === password) {
                        setIsLoggedIn(true); 
                        setCurrentUser(user);
                      } else {
                        alert("Credenciales incorrectas. Revisa tu RUT y contraseña.");
                      }
                    } catch (e) {
                      alert("Error al procesar datos locales. Intenta registrarte de nuevo.");
                    }
                } else {
                   alert("No hay usuarios registrados con ese RUT. Por favor, crea un perfil.");
                }
            }} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black uppercase shadow-xl transform transition-all active:scale-95">Iniciar Sesión</button>
            <button onClick={() => setIsRegistering(true)} className="w-full border-2 border-emerald-600 text-emerald-700 py-3 rounded-2xl text-xs font-black uppercase tracking-widest mt-4">Crear Perfil Nuevo</button>
          </div>
        </div>
      );
    }

    return (
      <div className="px-4 py-8 space-y-6">
        <div className="bg-gray-900 text-white p-8 rounded-3xl flex flex-col items-center shadow-2xl relative overflow-hidden">
           <div className="absolute -right-6 -bottom-6 opacity-10"><User size={120}/></div>
           <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-white text-3xl font-black mb-4 border-4 border-white/20 shadow-lg">{currentUser?.name.charAt(0)}</div>
           <h2 className="text-xl font-black uppercase italic tracking-tighter">{currentUser?.name}</h2>
           <p className="text-gray-400 text-xs font-mono font-bold tracking-widest">{currentUser?.rut}</p>
           <button onClick={() => setIsAvailable(!isAvailable)} className={`mt-6 px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md ${isAvailable ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>{isAvailable ? 'Disponible para Faenas' : 'No disponible temporalmente'}</button>
        </div>

        <h3 className="font-black text-[11px] uppercase text-gray-400 tracking-[0.2em] px-2 flex justify-between items-center">Mis Postulaciones <span>{applications.length}</span></h3>
        <div className="space-y-3">
          {applications.length > 0 ? applications.map(app => (
            <div key={app.jobId} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center hover:border-emerald-200 transition-colors">
              <div>
                <p className="font-black text-gray-800 text-sm leading-tight uppercase tracking-tighter">{app.jobTitle}</p>
                <p className="text-[10px] text-gray-400 uppercase font-bold mt-1 italic">{new Date(app.appliedAt).toLocaleDateString()}</p>
              </div>
              <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200 shadow-sm">{app.attendanceStatus}</span>
            </div>
          )) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400 text-sm italic font-medium">No has postulado a ninguna oferta todavía.</div>
          )}
        </div>

        <button onClick={() => {
            localStorage.removeItem(SESSION_KEY);
            setIsLoggedIn(false);
            setCurrentUser(null);
            onLogout();
        }} className="w-full py-4 text-red-500 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 border-2 border-red-50 rounded-2xl hover:bg-red-50 transition-colors mt-8"><LogOut size={18}/> Cerrar Sesión</button>
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen relative flex flex-col shadow-2xl overflow-hidden font-sans">
      <div className="bg-white px-4 py-4 border-b border-gray-100 flex justify-between items-center shrink-0 sticky top-0 z-40">
        <h1 className="font-black italic text-emerald-800 tracking-tighter text-xl">AgroConnect <span className="text-emerald-500 font-normal not-italic">Chile</span></h1>
        {isLoggedIn && <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 border-2 border-emerald-200 shadow-sm"><User size={18}/></div>}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === WorkerTab.JOBS ? renderJobsTab() : renderProfileTab()}
      </div>

      {isLoggedIn && (
        <div className="bg-white border-t px-6 py-3 flex justify-around items-center shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-3xl sticky bottom-0 z-40">
            <button onClick={() => setActiveTab(WorkerTab.JOBS)} className={`flex flex-col items-center gap-1 transition-all p-2 rounded-xl ${activeTab === WorkerTab.JOBS ? 'text-emerald-600 bg-emerald-50 scale-110' : 'text-gray-300'}`}><Briefcase size={22} className={activeTab === WorkerTab.JOBS ? 'fill-emerald-600/10' : ''}/><span className="text-[9px] font-black uppercase tracking-widest">Ofertas</span></button>
            <button onClick={() => setActiveTab(WorkerTab.PROFILE)} className={`flex flex-col items-center gap-1 transition-all p-2 rounded-xl ${activeTab === WorkerTab.PROFILE ? 'text-emerald-600 bg-emerald-50 scale-110' : 'text-gray-300'}`}><User size={22} className={activeTab === WorkerTab.PROFILE ? 'fill-emerald-600/10' : ''}/><span className="text-[9px] font-black uppercase tracking-widest">Mi Perfil</span></button>
        </div>
      )}

      {showFullTerms && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm max-h-[80vh] flex flex-col shadow-2xl overflow-hidden border border-white/20">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
               <div>
                 <h3 className="font-black text-gray-800 uppercase tracking-tighter italic text-sm">Términos Detallados</h3>
                 <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">Versión Legal AgroConnect 1.0</p>
               </div>
               <button onClick={() => setShowFullTerms(false)} className="bg-white p-2 rounded-full shadow-sm text-gray-400 hover:text-gray-600 transition-colors"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-5 text-xs text-gray-600 leading-relaxed font-medium">
               {LEGAL_CONTENT.legal.documents.full_terms_and_privacy.sections.map(s => <div key={s.id} className="border-l-2 border-emerald-500 pl-4"><p className="font-black text-gray-800 uppercase text-[10px] mb-1 tracking-widest">{s.title}</p><p className="italic">{s.body}</p></div>)}
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-center rounded-b-[2.5rem]">
              <button onClick={() => setShowFullTerms(false)} className="bg-emerald-600 text-white px-10 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-transform">Entendido</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerPortal;
