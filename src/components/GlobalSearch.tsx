
import React, { useState, useEffect } from 'react';
import { Worker, WorkerStatus } from '../types';
import { calculateDistance, getCurrentPosition } from '../services/geolocationService';
import { Search, MapPin, UserPlus, Filter, Sliders, Map as MapIcon, CheckCircle2 } from 'lucide-react';

interface GlobalSearchProps {
  onInviteWorker: (worker: Worker) => void;
  globalWorkers: Worker[];
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ onInviteWorker, globalWorkers }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [radius, setRadius] = useState<number>(50); // Default 50km
  const [selectedSkill, setSelectedSkill] = useState<string>('all');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isLoadingLoc, setIsLoadingLoc] = useState(false);
  const [results, setResults] = useState<Worker[]>(globalWorkers);
  const [notice, setNotice] = useState<string | null>(null);

  // Initialize with location
  useEffect(() => {
    handleGetLocation();
  }, []);

  const handleGetLocation = async () => {
    setIsLoadingLoc(true);
    try {
      const pos = await getCurrentPosition();
      setUserLocation(pos);
    } catch (e) {
      console.warn("Could not get location for search");
    } finally {
      setIsLoadingLoc(false);
    }
  };

  // Filter Logic
  useEffect(() => {
    let filtered = [...globalWorkers];

    // 1. Text Filter
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(w => 
        w.name.toLowerCase().includes(lowerTerm) || 
        w.skills.some(s => s.toLowerCase().includes(lowerTerm))
      );
    }

    // 2. Skill Filter
    if (selectedSkill !== 'all') {
      filtered = filtered.filter(w => w.skills.includes(selectedSkill));
    }

    // 3. Radius Filter
    if (userLocation) {
      filtered = filtered.map(w => {
        if (!w.coordinates) return { ...w, distance: 9999 };
        const dist = calculateDistance(userLocation, w.coordinates);
        return { ...w, distance: dist };
      }).filter(w => (w.distance || 0) <= radius);
      
      // Sort by distance
      filtered.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }

    setResults(filtered);

  }, [searchTerm, radius, selectedSkill, userLocation, globalWorkers]);

  const handleInvite = (worker: Worker) => {
    setNotice(`Invitación enviada a ${worker.name}. Se notificó para que postule a tus ofertas.`);
    onInviteWorker(worker); 
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
         <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
           <MapIcon className="text-blue-600"/> Buscador Global de Talento
         </h2>
         <p className="text-gray-500 text-sm">Encuentra trabajadores disponibles fuera de tu organización.</p>
      </div>

      {notice && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 text-blue-700 px-4 py-3 text-sm">
          {notice}
        </div>
      )}

      {/* Filters Panel */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
         <div className="flex flex-col md:flex-row gap-4">
            {/* Search Text */}
            <div className="flex-1 relative">
               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
               <input 
                 type="text" 
                 placeholder="Buscar por nombre, rubro..." 
                 className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
               />
            </div>
            
            {/* Skill Select */}
            <div className="w-full md:w-48">
              <select 
                className="w-full h-full border border-gray-200 rounded-lg px-3 bg-white"
                value={selectedSkill}
                onChange={e => setSelectedSkill(e.target.value)}
              >
                <option value="all">Todos los rubros</option>
                <option value="Cosecha">Cosecha</option>
                <option value="Packing">Packing</option>
                <option value="Poda">Poda</option>
                <option value="Maquinaria">Maquinaria</option>
              </select>
            </div>
         </div>

         {/* Radius Slider */}
         <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex justify-between items-center mb-2">
               <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                 <Sliders size={16} /> Radio de Búsqueda
               </label>
               <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                 {radius} km a la redonda
               </span>
            </div>
            <input 
              type="range" 
              min="5" 
              max="200" 
              step="5"
              value={radius}
              onChange={e => setRadius(Number(e.target.value))}
              className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
               <span>5 km</span>
               <span>100 km</span>
               <span>200 km</span>
            </div>
            {!userLocation && !isLoadingLoc && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <MapPin size={12}/> Ubicación no detectada. Resultados mostrados sin filtro de distancia.
              </p>
            )}
         </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {results.map(worker => (
           <div key={worker.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
              <div className="p-5 flex-1">
                 <div className="flex justify-between items-start mb-2">
                    <div>
                       <h3 className="font-bold text-gray-800 text-lg">{worker.name}</h3>
                       <p className="text-xs text-gray-500 flex items-center gap-1">
                         <MapPin size={12} /> {worker.region} 
                         {worker.distance && <span className="text-blue-600 font-bold"> • a {worker.distance.toFixed(1)} km</span>}
                       </p>
                    </div>
                    <div className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold uppercase">
                       Disponible
                    </div>
                 </div>
                 
                 <div className="flex flex-wrap gap-1 mt-3">
                    {worker.skills.map(s => (
                      <span key={s} className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs border border-gray-200">
                        {s}
                      </span>
                    ))}
                 </div>
              </div>
              <div className="bg-gray-50 p-4 border-t border-gray-100">
                 <button 
                   onClick={() => handleInvite(worker)}
                   className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-bold hover:bg-black transition-colors flex items-center justify-center gap-2"
                 >
                   <UserPlus size={16} /> Invitar a Postular
                 </button>
              </div>
           </div>
         ))}
      </div>
      
      {results.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>No se encontraron trabajadores con estos filtros.</p>
        </div>
      )}

    </div>
  );
};

export default GlobalSearch;
