
import React, { useState } from 'react';
import { Worker, WorkerStatus } from '../types';
import { generateBroadcastMessage } from '../services/geminiService';
import { Upload, FileSpreadsheet, Send, Search, MessageCircle, X, Wand2, CheckSquare, Square } from 'lucide-react';

interface WorkersProps {
  workers: Worker[];
  setWorkers: React.Dispatch<React.SetStateAction<Worker[]>>;
}

const Workers: React.FC<WorkersProps> = ({ workers, setWorkers }) => {
  const [isImporting, setIsImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<string>('all');
  
  // Bulk Actions State
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isGeneratingMsg, setIsGeneratingMsg] = useState(false);
  const [msgContext, setMsgContext] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleImportMock = () => {
    setNotice({ 
      type: 'info', 
      message: 'Importación desde Google Sheets próximamente. Por ahora, los trabajadores se registran desde el portal público.' 
    });
  };

  const toggleSelectWorker = (id: string) => {
    setSelectedWorkerIds(prev => 
      prev.includes(id) ? prev.filter(wId => wId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedWorkerIds.length === filteredWorkers.length) {
      setSelectedWorkerIds([]);
    } else {
      setSelectedWorkerIds(filteredWorkers.map(w => w.id));
    }
  };

  const handleGenerateMessage = async () => {
    if (!msgContext) {
      setNotice({ type: 'error', message: 'Describe el motivo del mensaje primero.' });
      return;
    }
    setIsGeneratingMsg(true);
    try {
      const text = await generateBroadcastMessage(msgContext);
      setBroadcastMessage(text);
      if (text.toLowerCase().includes("no se pudo")) {
        setNotice({ type: 'error', message: text });
      }
    } finally {
      setIsGeneratingMsg(false);
    }
  };

  const handleSendBroadcast = () => {
    if (!broadcastMessage) {
      setNotice({ type: 'error', message: 'Escribe un mensaje.' });
      return;
    }
    
    setNotice({
      type: 'success',
      message: `Mensaje enviado a ${selectedWorkerIds.length} trabajadores. (Simulación WhatsApp)`,
    });
    
    // Reset
    setSelectedWorkerIds([]);
    setIsBroadcastModalOpen(false);
    setBroadcastMessage('');
    setMsgContext('');
  };

  const getStatusBadge = (status: WorkerStatus) => {
    switch (status) {
      case WorkerStatus.ACTIVE: 
        return <span className="flex items-center gap-1 bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-semibold"><span className="w-2 h-2 rounded-full bg-red-500"></span> Ocupado (Faena)</span>;
      case WorkerStatus.CONSENTED: 
        return <span className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold"><span className="w-2 h-2 rounded-full bg-green-500"></span> Disponible</span>;
      case WorkerStatus.REJECTED: 
        return <span className="flex items-center gap-1 bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-semibold"><span className="w-2 h-2 rounded-full bg-gray-500"></span> Rechazado</span>;
      default: 
        return <span className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-semibold"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Pendiente</span>;
    }
  };

  const filteredWorkers = workers.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(searchTerm.toLowerCase()) || w.skills.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesSkill = selectedSkill === 'all' || w.skills.includes(selectedSkill);
    return matchesSearch && matchesSkill;
  });

  const skillsList = Array.from(new Set(workers.flatMap(w => w.skills)));

  return (
    <div className="space-y-6 relative pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Mis Trabajadores</h2>
          <p className="text-gray-500 text-sm">Gestiona tu dotación actual y comunícate con ellos.</p>
        </div>
        <button 
          onClick={handleImportMock}
          disabled={isImporting}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm disabled:opacity-50"
        >
          {isImporting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          ) : (
            <FileSpreadsheet size={18} />
          )}
          Importar (Google Sheets)
        </button>
      </div>

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

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        {/* Filters Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center mb-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nombre..." 
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-48">
             <select 
              className="w-full border border-gray-200 rounded-lg p-2 text-sm"
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
            >
              <option value="all">Todas las áreas</option>
              {skillsList.map(skill => (
                <option key={skill} value={skill}>{skill}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="p-4 w-10">
                   <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-600">
                      {selectedWorkerIds.length === filteredWorkers.length && filteredWorkers.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                   </button>
                </th>
                <th className="p-4">Nombre</th>
                <th className="p-4">Contacto</th>
                <th className="p-4">Habilidades</th>
                <th className="p-4">Estado / Disponibilidad</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredWorkers.map(worker => (
                <tr key={worker.id} className={`hover:bg-gray-50 transition-colors ${selectedWorkerIds.includes(worker.id) ? 'bg-emerald-50/50' : ''}`}>
                  <td className="p-4">
                     <button onClick={() => toggleSelectWorker(worker.id)} className={`transition-colors ${selectedWorkerIds.includes(worker.id) ? 'text-emerald-600' : 'text-gray-300'}`}>
                        {selectedWorkerIds.includes(worker.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                     </button>
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-gray-800">{worker.name}</div>
                    <div className="text-xs text-gray-400">{worker.rut}</div>
                  </td>
                  <td className="p-4 text-gray-600 text-sm font-mono">{worker.phone}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {worker.skills.map(skill => (
                        <span key={skill} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">{skill}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4">{getStatusBadge(worker.status)}</td>
                  <td className="p-4 text-right">
                    <a 
                      href={`https://wa.me/${worker.phone.replace('+','')}?text=Hola ${worker.name}, te escribo desde AgroConnect.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 px-3 py-1.5 rounded-full transition-colors text-xs font-bold border border-emerald-200"
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredWorkers.length === 0 && (
            <div className="text-center p-8 text-gray-400">No se encontraron trabajadores.</div>
          )}
        </div>
      </div>

      {/* Floating Action Bar for Bulk Selection */}
      {selectedWorkerIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 z-40 animate-in slide-in-from-bottom-4">
           <span className="font-bold text-sm">{selectedWorkerIds.length} seleccionados</span>
           <div className="h-4 w-px bg-gray-700"></div>
           <button 
             onClick={() => setIsBroadcastModalOpen(true)}
             className="flex items-center gap-2 hover:text-emerald-400 font-medium text-sm transition-colors"
           >
             <Send size={16} /> Crear Difusión
           </button>
           <button 
             onClick={() => setSelectedWorkerIds([])}
             className="p-1 hover:bg-gray-800 rounded-full"
           >
             <X size={16} />
           </button>
        </div>
      )}

      {/* Broadcast Modal */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800">Nueva Difusión Masiva</h3>
                <button onClick={() => setIsBroadcastModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
             </div>
             <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600">
                  Estás a punto de contactar a <span className="font-bold text-gray-900">{selectedWorkerIds.length} trabajadores</span>.
                </p>
                
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                   <label className="block text-xs font-bold text-purple-700 uppercase mb-2 flex items-center gap-2">
                     <Wand2 size={14}/> Asistente de Redacción IA
                   </label>
                   <div className="flex gap-2">
                     <input 
                       type="text" 
                       placeholder="Ej: Necesito podadores para el lunes en Curicó..." 
                       className="flex-1 text-sm border border-purple-200 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none"
                       value={msgContext}
                       onChange={(e) => setMsgContext(e.target.value)}
                     />
                     <button 
                       onClick={handleGenerateMessage}
                       disabled={isGeneratingMsg}
                       className="bg-purple-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors"
                     >
                       {isGeneratingMsg ? '...' : 'Redactar'}
                     </button>
                   </div>
                </div>

                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Mensaje Final (WhatsApp)</label>
                   <textarea 
                     className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none h-32"
                     value={broadcastMessage}
                     onChange={(e) => setBroadcastMessage(e.target.value)}
                     placeholder="Escribe tu mensaje aquí..."
                   ></textarea>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                   <div className="w-4 h-4 rounded-full border-2 border-emerald-500 flex items-center justify-center">
                     <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                   </div>
                   Se incluirán botones interactivos "SI/NO" automáticamente.
                </div>

                <button 
                  onClick={handleSendBroadcast}
                  className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg transition-transform active:scale-95"
                >
                  Enviar Difusión
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Workers;
