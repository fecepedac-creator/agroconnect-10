
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Worker, WorkerStatus, JobOffer } from '../types';
import { Users, Briefcase, CheckCircle, AlertTriangle, MapPin, Radio, Megaphone } from 'lucide-react';

interface DashboardProps {
  workers: Worker[];
  jobs: JobOffer[];
  globalWorkers: Worker[];
  onRadarClick?: () => void;
}

const COLORS = ['#059669', '#FBBF24', '#EF4444', '#3B82F6'];

const Dashboard: React.FC<DashboardProps> = ({ workers, jobs, globalWorkers, onRadarClick }) => {
  const pending = workers.filter(w => w.status === WorkerStatus.PENDING).length;
  const consented = workers.filter(w => w.status === WorkerStatus.CONSENTED).length;
  const rejected = workers.filter(w => w.status === WorkerStatus.REJECTED).length;
  const active = workers.filter(w => w.status === WorkerStatus.ACTIVE).length;

  const statusData = [
    { name: 'Consentido', value: consented },
    { name: 'Pendiente', value: pending },
    { name: 'Rechazado', value: rejected },
    { name: 'Activo', value: active },
  ];

  const totalWorkersNeeded = jobs.reduce((acc, job) => acc + job.workersNeeded, 0);
  const totalWorkersFilled = jobs.reduce((acc, job) => acc + job.workersFilled, 0);

  return (
    <div className="space-y-6 animate-fade-in w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
         <h2 className="text-2xl font-bold text-gray-800">Centro de Comando</h2>
         <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
           Última actualización: Ahora
         </span>
      </div>
      
      {/* Top Widgets: Alerts & Recruitment */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Global Pool Alert Widget */}
         <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl p-6 shadow-lg relative overflow-hidden">
            <div className="relative z-10">
               <div className="flex items-center gap-2 mb-2">
                 <Radio className="animate-pulse" size={20}/>
                 <h3 className="font-bold text-lg">Radar de Talento</h3>
               </div>
               <p className="text-blue-100 mb-4 text-sm">Se han detectado <span className="font-bold text-white text-lg">{globalWorkers.length}</span> trabajadores disponibles fuera de tu empresa en esta zona.</p>
               <button 
                 onClick={() => onRadarClick?.()}
                 className="bg-white text-blue-700 px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-blue-50 transition-colors"
               >
                 Ver Candidatos
               </button>
            </div>
            {/* Decoration */}
            <div className="absolute -right-6 -bottom-6 opacity-20">
               <Users size={120} />
            </div>
         </div>

         {/* Broadcast Status Widget */}
         <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
            <div>
               <div className="flex items-center gap-2 mb-2 text-purple-700">
                 <Megaphone size={20}/>
                 <h3 className="font-bold text-lg">Estado Difusiones</h3>
               </div>
               <p className="text-gray-500 text-sm">Campaña: "Cosecha Cerezas"</p>
               <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Entregados: 85%</span>
                    <span>Respuestas: 42%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                     <div className="bg-purple-500 h-2 rounded-full" style={{width: '85%'}}></div>
                  </div>
               </div>
            </div>
         </div>

         {/* Quick KPI */}
         <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Vacantes Urgentes</p>
              <h3 className="text-3xl font-bold text-red-600">{totalWorkersNeeded - totalWorkersFilled}</h3>
              <p className="text-xs text-red-400 font-medium flex items-center gap-1 mt-1">
                 <AlertTriangle size={12}/> Requiere atención
              </p>
            </div>
            <div className="bg-red-50 p-4 rounded-full text-red-500">
              <Briefcase size={28} />
            </div>
         </div>
      </div>

      {/* Main Map Visualization (Simulated) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
         <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <MapPin size={18} /> Mapa Operativo
            </h3>
            <div className="flex gap-2 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Activos</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Pendientes</span>
            </div>
         </div>
         <div className="bg-slate-100 relative w-full group" style={{ height: '30vh' }}>
            {/* This simulates a map interface */}
            <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
            
            {/* Mock Markers */}
            <div className="absolute top-1/4 left-1/4 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:scale-110 transition-transform">
               <div className="bg-emerald-500 text-white p-1 rounded-full shadow-lg border-2 border-white">
                  <Users size={16} />
               </div>
               <div className="absolute top-full left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded mt-1 opacity-0 group-hover:opacity-100 whitespace-nowrap">
                  Cuadrilla Norte: 12 Activos
               </div>
            </div>

            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:scale-110 transition-transform">
               <div className="bg-red-500 text-white p-1 rounded-full shadow-lg border-2 border-white">
                  <AlertTriangle size={16} />
               </div>
               <div className="absolute top-full left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded mt-1 opacity-0 group-hover:opacity-100 whitespace-nowrap">
                  Faltan 5 personas
               </div>
            </div>

            <div className="absolute bottom-1/3 right-1/4 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:scale-110 transition-transform">
               <div className="bg-blue-500 text-white p-1 rounded-full shadow-lg border-2 border-white">
                  <Briefcase size={16} />
               </div>
               <div className="absolute top-full left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded mt-1 opacity-0 group-hover:opacity-100 whitespace-nowrap">
                  Packing Central
               </div>
            </div>
            
            <div className="absolute bottom-2 right-2 bg-white/80 p-1 text-[10px] text-gray-500 rounded">
               Mapa Simulado
            </div>
         </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-emerald-100 rounded-full text-emerald-600 mr-4">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Trabajadores</p>
            <p className="text-2xl font-bold text-gray-800">{workers.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-blue-100 rounded-full text-blue-600 mr-4">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Consentimiento</p>
            <p className="text-2xl font-bold text-gray-800">
              {workers.length > 0 ? Math.round(((consented + active) / workers.length) * 100) : 0}%
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-amber-100 rounded-full text-amber-600 mr-4">
            <Briefcase size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Ofertas Activas</p>
            <p className="text-2xl font-bold text-gray-800">{jobs.filter(j => j.isActive).length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-indigo-100 rounded-full text-indigo-600 mr-4">
            <Radio size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">En Faena</p>
            <p className="text-2xl font-bold text-gray-800">{active}</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">Estado de Trabajadores</h3>
            <div className="flex flex-col md:flex-row items-center md:gap-6">
                <div className="w-full md:w-1/2 h-64 min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                        <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={'60%'}
                            outerRadius={'80%'}
                            fill="#8884d8"
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="w-full md:w-1/2 flex flex-col justify-center gap-4 mt-4 md:mt-0">
                    {statusData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center text-sm">
                        <span className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                        <span className="text-gray-600 font-medium">{entry.name}</span>
                        <span className="ml-auto font-bold text-gray-800">{entry.value}</span>
                    </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-lg font-semibold mb-4 text-gray-700 shrink-0">Ocupación de Ofertas</h3>
          <div className='flex-1 w-full min-h-[250px]'>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={jobs} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                <XAxis dataKey="title" hide />
                <YAxis axisLine={false} tickLine={false}/>
                <Tooltip wrapperClassName="rounded-lg shadow-lg"/>
                <Bar dataKey="workersFilled" stackId="a" fill="#059669" name="Cubiertos" radius={[10, 10, 0, 0]}/>
                <Bar dataKey="workersNeeded" stackId="a" fill="#E5E7EB" name="Total Necesario" radius={[10, 10, 0, 0]}/>
                </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
