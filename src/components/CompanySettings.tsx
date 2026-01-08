
import React, { useState } from 'react';
import { Company, JobOffer } from '../types';
import { 
  Building2, 
  User, 
  Camera, 
  Save, 
  Mail,
  Phone
} from 'lucide-react';

interface CompanySettingsProps {
  company: Company;
  jobs: JobOffer[];
  onUpdateCompany: (updated: Company) => void;
}

const CompanySettings: React.FC<CompanySettingsProps> = ({ company, onUpdateCompany }) => {
  const [formData, setFormData] = useState<Company>({ ...company });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      onUpdateCompany(formData);
      setIsSaving(false);
      alert("Configuración de empresa guardada exitosamente.");
    }, 800);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Configuración de Cuenta</h2>
        <p className="text-gray-500">Administra la información oficial de tu empresa y responsables.</p>
      </div>

      <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-8">
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Building2 size={20} className="text-emerald-600" /> Identidad Corporativa
          </h3>
          <div className="flex flex-col md:flex-row gap-8 items-start border-b border-gray-50 pb-8">
            <div className="relative group shrink-0">
              <div className="w-32 h-32 rounded-3xl bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center overflow-hidden shadow-inner">
                {formData.logoUrl ? (
                  <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Building2 size={48} className="text-emerald-300" />
                )}
              </div>
              <button className="absolute -bottom-2 -right-2 bg-gray-900 text-white p-2 rounded-xl hover:bg-emerald-600 transition-all shadow-lg border-2 border-white">
                <Camera size={16} />
              </button>
            </div>
            <div className="flex-1 space-y-4 w-full">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Fantasía (Para Anuncios)</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">WhatsApp Oficial de Reclutamiento</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="+56 9 XXXX XXXX"
                  value={formData.officialPhone || ''}
                  onChange={e => setFormData({...formData, officialPhone: e.target.value})}
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 pt-4">
            <User size={20} className="text-emerald-600" /> Contraparte de RRHH
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre del Responsable</label>
              <input 
                type="text" 
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                value={formData.hrName || ''}
                onChange={e => setFormData({...formData, hrName: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Mail size={12}/> Email Notificaciones</label>
              <input 
                type="email" 
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                value={formData.hrEmail || ''}
                onChange={e => setFormData({...formData, hrEmail: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Phone size={12}/> Celular Directo</label>
              <input 
                type="text" 
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                value={formData.hrPhone || ''}
                onChange={e => setFormData({...formData, hrPhone: e.target.value})}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-6">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? "Guardando..." : <><Save size={18}/> Guardar Cambios</>}
          </button>
        </div>
      </section>
    </div>
  );
};

export default CompanySettings;
