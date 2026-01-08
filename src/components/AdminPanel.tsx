
import React, { useState, useEffect } from 'react';
import { Company, Lead, AdminConfig } from '../types';
import { 
  Building2, 
  CreditCard, 
  MoreVertical, 
  Plus, 
  TrendingUp, 
  Users, 
  User,
  Activity, 
  AlertCircle, 
  DollarSign, 
  Server,
  Search,
  Download,
  X,
  FileText,
  Upload,
  Save,
  ShieldAlert,
  CheckCircle,
  Phone,
  Mail,
  MapPin,
  ImageIcon,
  Inbox,
  Settings,
  Check,
  MessageSquare,
  Zap
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CompanyDetails extends Company {
  rut: string;
  address: string;
  hrContact: string;
  phone: string;
  logoUrl?: string;
  bankInfo: string;
  paymentStatusHistory: string[];
  usageStats: {
    jobsPosted: number;
    jobsLimit: number;
    workersContacted: number;
    workersLimit: number;
  };
  adminNotes: string;
  documents:Array<{name: string, type: string, date: string}>;
}

interface AdminPanelProps {
  companies?: Company[];
  setCompanies?: React.Dispatch<React.SetStateAction<Company[]>>;
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  adminConfig: AdminConfig;
  setAdminConfig: React.Dispatch<React.SetStateAction<AdminConfig>>;
  activeTab: 'OVERVIEW' | 'COMPANIES' | 'REQUESTS' | 'SETTINGS';
  setActiveTab: (tab: 'OVERVIEW' | 'COMPANIES' | 'REQUESTS' | 'SETTINGS') => void;
  isDemoMode?: boolean;
  onToggleDemo?: (enabled: boolean) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  companies = [], 
  setCompanies, 
  leads, 
  setLeads, 
  adminConfig, 
  setAdminConfig,
  activeTab,
  setActiveTab,
  isDemoMode = false,
  onToggleDemo
}) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(null);
  const [tempConfig, setTempConfig] = useState<AdminConfig>(adminConfig);

  useEffect(() => {
    setTempConfig(adminConfig);
  }, [activeTab, adminConfig]);

  const data = [
    { name: 'Ene', empresas: 2, ingresos: 2400 },
    { name: 'Feb', empresas: 3, ingresos: 3600 },
    { name: 'Mar', empresas: 3, ingresos: 3600 },
    { name: 'Abr', empresas: 5, ingresos: 6000 },
    { name: 'May', empresas: 8, ingresos: 9600 },
    { name: 'Jun', empresas: 12, ingresos: 14400 },
  ];

  useEffect(() => {
    if (selectedCompanyId) {
      const baseCompany = companies.find(c => c.id === selectedCompanyId);
      if (baseCompany) {
        setCompanyDetails(prev => {
           if (prev && prev.id === baseCompany.id) {
             return { ...prev, ...baseCompany };
           }
           return {
            ...baseCompany,
            rut: '76.123.456-7',
            address: 'Camino Longitudinal Sur Km 125, Maule',
            hrContact: 'Marcela Silva',
            phone: '+56 9 8765 4321',
            bankInfo: 'Banco Santander - Cta Cte 12345678',
            paymentStatusHistory: ['Paid', 'Paid', 'Paid', 'Pending'],
            usageStats: {
              jobsPosted: baseCompany.subscriptionPlan === 'Enterprise' ? 12 : 3,
              jobsLimit: baseCompany.subscriptionPlan === 'Enterprise' ? 50 : 5,
              workersContacted: 145,
              workersLimit: baseCompany.subscriptionPlan === 'Enterprise' ? 1000 : 200,
            },
            adminNotes: 'Cliente solicita ampliación de cupo para temporada de cerezas en Noviembre.',
            documents: [
              { name: 'Contrato_Prestacion_Servicios.pdf', type: 'PDF', date: '2023-01-15' },
              { name: 'Factura_Octubre_2023.pdf', type: 'PDF', date: '2023-10-30' },
            ]
          };
        });
      }
    } else {
      setCompanyDetails(null);
    }
  }, [selectedCompanyId, companies]);

  const handleCloseDetails = () => setSelectedCompanyId(null);
  const handleLogoUpload = () => alert("Simulación: Se abriría el explorador de archivos para subir el logo.");

  const toggleCompanyStatus = () => {
    if (!companyDetails || !setCompanies) return;
    const newStatus = companyDetails.status === 'Active' ? 'Overdue' : 'Active';
    setCompanies(prev => prev.map(c => c.id === companyDetails.id ? { ...c, status: newStatus } : c));
  };

  const handleApproveLead = (lead: Lead) => {
    if(!setCompanies) return;
    if(confirm(`¿Estás seguro de crear la cuenta para ${lead.companyName}?`)) {
      const newCompany: Company = {
        id: `c-${Date.now()}`,
        name: lead.companyName,
        subscriptionPlan: 'Basic',
        status: 'Active',
        contactEmail: lead.email,
        logoUrl: undefined
      };
      setCompanies(prev => [newCompany, ...prev]);
      setLeads(prev => prev.filter(l => l.id !== lead.id));
      alert(`✅ Cuenta creada para ${lead.companyName}.\n\nContraseña temporal generada: empresa123\n\nSe ha enviado un correo automático a ${lead.email} con las credenciales.`);
    }
  };

  const handleSaveConfig = () => {
    setAdminConfig(tempConfig);
    alert("Configuración guardada correctamente.");
  };

  const renderOverview = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Ingresos Mensuales</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">$14.4M</h3>
            </div>
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-emerald-600 font-medium">
            <TrendingUp size={14} className="mr-1" /> +12% vs mes anterior
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Empresas Activas</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{companies.length}</h3>
            </div>
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Building2 size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-blue-600 font-medium">
            <Plus size={14} className="mr-1" /> 2 nuevas esta semana
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Trabajadores Total</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{isDemoMode ? '1,240' : '5'}</h3>
            </div>
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <Users size={20} />
            </div>
          </div>
           <div className="mt-4 text-xs text-gray-400">En todas las regiones</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Salud del Sistema</p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">99.9%</h3>
            </div>
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Activity size={20} />
            </div>
          </div>
           <div className="mt-4 text-xs text-gray-400">Todos los servicios operativos</div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-6">Crecimiento de la Plataforma</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9CA3AF'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9CA3AF'}} />
                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Area type="monotone" dataKey="ingresos" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorIngresos)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Server size={18} className="text-gray-400"/> Logs del Sistema
          </h3>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            <div className="flex gap-3 items-start p-3 bg-red-50 rounded-lg border border-red-100">
              <AlertCircle size={16} className="text-red-500 mt-1 shrink-0" />
              <div>
                <p className="text-xs font-bold text-red-700">Alta Latencia Detectada</p>
                <p className="text-xs text-red-600 mt-1">Region us-east-1 reporta tiempos &gt; 500ms.</p>                <span className="text-[10px] text-red-400 block mt-2">Hace 12 min</span>
              </div>
            </div>
            <div className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg border border-gray-100">
              <Activity size={16} className="text-blue-500 mt-1 shrink-0" />
              <div>
                <p className="text-xs font-bold text-gray-700">Backup Completado</p>
                <p className="text-xs text-gray-500 mt-1">Copia de seguridad de BDD exitosa.</p>
                <span className="text-[10px] text-gray-400 block mt-2">Hace 2 horas</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRequests = () => (
    <div className="space-y-6 animate-fade-in">
       <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800">Solicitudes de Incorporación</h3>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600">
             Pendientes: <span className="font-bold text-red-600">{leads.length}</span>
          </div>
       </div>
       {leads.length === 0 ? (
         <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <Inbox size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-gray-500 font-bold">No hay solicitudes nuevas</h3>
            <p className="text-gray-400 text-sm">Tu bandeja está al día.</p>
         </div>
       ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {leads.map(lead => (
             <div key={lead.id} className="bg-white rounded-xl shadow-md border-l-4 border-blue-500 overflow-hidden hover:shadow-lg transition-shadow">
               <div className="p-5">
                 <div className="flex justify-between items-start mb-3">
                   <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold uppercase">Nueva Solicitud</div>
                   <span className="text-xs text-gray-400">{new Date(lead.timestamp).toLocaleDateString()}</span>
                 </div>
                 <h4 className="font-bold text-lg text-gray-900 mb-1">{lead.companyName}</h4>
                 <div className="flex items-center gap-2 text-sm text-gray-500 mb-3"><User size={14} /> {lead.contactName}</div>
                 <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600 mb-4 italic border border-gray-100">"{lead.message || 'Sin mensaje adicional'}"</div>
                 <div className="space-y-2 mb-4">
                   <div className="flex items-center gap-2 text-xs text-gray-500"><Phone size={14} className="text-gray-400"/> {lead.phone}</div>
                   <div className="flex items-center gap-2 text-xs text-gray-500"><Mail size={14} className="text-gray-400"/> {lead.email}</div>
                 </div>
                 <button onClick={() => handleApproveLead(lead)} className="w-full bg-emerald-600 text-white py-2 rounded-lg font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-sm"><CheckCircle size={16} /> Aprobar / Crear Cuenta</button>
               </div>
             </div>
           ))}
         </div>
       )}
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-8">
       <section>
          <div className="mb-6">
             <h3 className="text-xl font-bold text-gray-800">Entorno y Datos</h3>
             <p className="text-gray-500 text-sm">Configura el comportamiento de la aplicación para demostraciones.</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="p-6">
                <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${isDemoMode ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-200'}`}>
                   <div className={`p-3 rounded-full ${isDemoMode ? 'bg-amber-100 text-amber-600' : 'bg-gray-200 text-gray-500'}`}>
                      <Zap size={24} />
                   </div>
                   <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                         <h4 className="font-bold text-gray-800">Modo Demo / Datos de Prueba</h4>
                         <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={isDemoMode}
                              onChange={(e) => onToggleDemo?.(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                         </label>
                      </div>
                      <p className="text-sm text-gray-600">
                        Al activar este modo, la plataforma se precargará con 30 trabajadores de prueba (10 en tu empresa, 10 en otras y 10 libres) para probar flujos de búsqueda y mensajería masiva con volumen real.
                      </p>
                      {isDemoMode && (
                        <div className="mt-2 text-xs font-bold text-amber-700 bg-amber-100/50 inline-block px-2 py-1 rounded">
                           ⚡ Datos extendidos activos (30 perfiles)
                        </div>
                      )}
                   </div>
                </div>
             </div>
          </div>
       </section>

       <section>
          <div className="mb-6">
             <h3 className="text-xl font-bold text-gray-800">Configuración de Alertas</h3>
             <p className="text-gray-500 text-sm">Define a dónde se envían las notificaciones de nuevos clientes.</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="p-6 space-y-6">
                <div className="flex items-start gap-4 p-4 bg-green-50 rounded-xl border border-green-100">
                   <div className="bg-green-100 p-3 rounded-full text-green-600"><Phone size={24} /></div>
                   <div className="flex-1">
                      <h4 className="font-bold text-gray-800 mb-1">WhatsApp Maestro</h4>
                      <p className="text-sm text-gray-600 mb-3">Número principal para alertas instantáneas de nuevos leads.</p>
                      <input type="text" className="w-full max-w-md border border-green-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-green-500 outline-none" value={tempConfig.whatsappNumber} onChange={e => setTempConfig({...tempConfig, whatsappNumber: e.target.value})} />
                   </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                   <div className="bg-blue-100 p-3 rounded-full text-blue-600"><Mail size={24} /></div>
                   <div className="flex-1">
                      <h4 className="font-bold text-gray-800 mb-1">Email de Notificaciones</h4>
                      <p className="text-sm text-gray-600 mb-3">Dirección de correo para respaldo y registro formal.</p>
                      <input type="email" className="w-full max-w-md border border-blue-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={tempConfig.notificationEmail} onChange={e => setTempConfig({...tempConfig, notificationEmail: e.target.value})} />
                   </div>
                </div>
             </div>
             <div className="bg-gray-50 p-6 border-t border-gray-100 flex justify-end">
                <button onClick={handleSaveConfig} className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition-colors flex items-center gap-2 shadow-lg"><Save size={18} /> Guardar Cambios</button>
             </div>
          </div>
       </section>
    </div>
  );

  const renderCompanyDetailsPanel = () => {
    if (!companyDetails) return null;
    const usageJobPercent = (companyDetails.usageStats.jobsPosted / companyDetails.usageStats.jobsLimit) * 100;
    const usageWorkerPercent = (companyDetails.usageStats.workersContacted / companyDetails.usageStats.workersLimit) * 100;
    return (
      <div className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-white shadow-2xl z-50 overflow-y-auto animate-in slide-in-from-right duration-300 border-l border-gray-200">
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 border-b border-gray-100 px-6 py-4 flex justify-between items-center">
          <div><span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ficha de Cliente</span><h2 className="text-xl font-bold text-gray-800">{companyDetails.name}</h2></div>
          <button onClick={handleCloseDetails} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><X size={24} /></button>
        </div>
        <div className="p-8 space-y-8">
          <section className="flex flex-col md:flex-row gap-6 items-start">
            <div className="relative group shrink-0">
               <div className="w-24 h-24 rounded-full bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center overflow-hidden">
                 {companyDetails.logoUrl ? (<img src={companyDetails.logoUrl} alt="Logo" className="w-full h-full object-cover" />) : (<Building2 size={40} className="text-emerald-300" />)}
               </div>
               <button onClick={handleLogoUpload} className="absolute bottom-0 right-0 bg-gray-900 text-white p-1.5 rounded-full hover:bg-emerald-600 transition-colors shadow-md" title="Subir Logo"><Upload size={14} /></button>
            </div>
            <div className="flex-1 w-full space-y-3">
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Razón Social</label><input type="text" value={companyDetails.name} className="w-full border border-gray-200 rounded p-2 text-sm bg-gray-50" readOnly /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">RUT</label><input type="text" value={companyDetails.rut} className="w-full border border-gray-200 rounded p-2 text-sm bg-gray-50" readOnly /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Plan</label><span className={`inline-block w-full p-2 text-sm font-semibold rounded border ${companyDetails.subscriptionPlan === 'Enterprise' ? 'bg-purple-50 text-purple-700 border-purple-200' : companyDetails.subscriptionPlan === 'Pro' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{companyDetails.subscriptionPlan}</span></div>
              </div>
            </div>
          </section>
          <section className="bg-gray-50 p-5 rounded-xl border border-gray-100">
             <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Users size={18} className="text-gray-400" /> Contacto Principal</h3>
             <div className="space-y-3">
               <div className="flex items-center gap-3 text-sm text-gray-600"><User size={16} className="text-gray-400" /><span className="font-medium">{companyDetails.hrContact}</span></div>
               <div className="flex items-center gap-3 text-sm text-gray-600"><Mail size={16} className="text-gray-400" /><a href={`mailto:${companyDetails.contactEmail}`} className="hover:text-emerald-600">{companyDetails.contactEmail}</a></div>
               <div className="flex items-center gap-3 text-sm text-gray-600"><Phone size={16} className="text-gray-400" /><span>{companyDetails.phone}</span></div>
             </div>
          </section>
          <section className="bg-red-50 border border-red-100 p-4 rounded-xl flex justify-between items-center">
                <div><h4 className="font-bold text-red-800 text-sm flex items-center gap-2"><ShieldAlert size={16} /> Zona de Peligro</h4><p className="text-xs text-red-600 mt-1">Suspender acceso a la plataforma.</p></div>
                <div className="flex items-center"><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={companyDetails.status === 'Active'} onChange={toggleCompanyStatus} /><div className="w-11 h-6 bg-red-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div><span className="ml-3 text-xs font-medium text-gray-700">{companyDetails.status === 'Active' ? 'Activo' : 'Suspendido'}</span></label></div>
          </section>
        </div>
      </div>
    );
  };

  const renderCompanies = () => (
    <div className="space-y-6 animate-fade-in relative">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} /><input type="text" placeholder="Buscar empresa..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"><Download size={16} /> Exportar</button>
          <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm transition-colors shadow-sm"><Plus size={16} /> Nueva Empresa</button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
            <tr><th className="p-4">Empresa</th><th className="p-4">Plan Actual</th><th className="p-4">Estado Pago</th><th className="p-4 text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {companies.map(company => (
              <tr key={company.id} className="hover:bg-gray-50 transition-colors group">
                <td className="p-4"><div className="flex items-center gap-3"><div className="bg-emerald-100 p-2 rounded-lg text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors"><Building2 size={20} /></div><div><p className="font-bold text-gray-800">{company.name}</p></div></div></td>
                <td className="p-4"><span className={`inline-block px-2 py-1 text-xs font-semibold rounded-md border ${company.subscriptionPlan === 'Enterprise' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{company.subscriptionPlan}</span></td>
                <td className="p-4">{company.status === 'Active' ? (<span className="text-emerald-600 font-medium">Al día</span>) : (<span className="text-red-600 font-medium">Pendiente</span>)}</td>
                <td className="p-4 text-right"><button onClick={() => setSelectedCompanyId(company.id)} className="text-gray-400 hover:text-gray-800 p-2 hover:bg-gray-100 rounded-full transition-colors"><MoreVertical size={18} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedCompanyId && (<div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm transition-opacity" onClick={handleCloseDetails}></div>)}
      {renderCompanyDetailsPanel()}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h2 className="text-3xl font-bold text-gray-900 tracking-tight">Administración Global</h2><p className="text-gray-500 mt-1">Supervisión general de la plataforma AgroConnect.</p></div>
        <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm overflow-x-auto max-w-full">
          <button onClick={() => setActiveTab('OVERVIEW')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'OVERVIEW' ? 'bg-gray-900 text-white shadow' : 'text-gray-600 hover:text-gray-900'}`}>Visión General</button>
          <button onClick={() => setActiveTab('COMPANIES')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'COMPANIES' ? 'bg-gray-900 text-white shadow' : 'text-gray-600 hover:text-gray-900'}`}>Empresas</button>
          <button onClick={() => setActiveTab('REQUESTS')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'REQUESTS' ? 'bg-gray-900 text-white shadow' : 'text-gray-600 hover:text-gray-900'}`}>Solicitudes{leads.length > 0 && (<span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{leads.length}</span>)}</button>
          <button onClick={() => setActiveTab('SETTINGS')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'SETTINGS' ? 'bg-gray-900 text-white shadow' : 'text-gray-600 hover:text-gray-900'}`}>Configuración</button>
        </div>
      </div>
      {activeTab === 'OVERVIEW' && renderOverview()}
      {activeTab === 'COMPANIES' && renderCompanies()}
      {activeTab === 'REQUESTS' && renderRequests()}
      {activeTab === 'SETTINGS' && renderSettings()}
    </div>
  );
};

export default AdminPanel;
