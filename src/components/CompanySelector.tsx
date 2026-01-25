import React from 'react';
import { Company } from '../types';

interface CompanySelectorProps {
  companies: Company[];
  currentCompany: Company | null;
  onSelectCompany: (company: Company | null) => void;
  label: string;
  placeholder?: string;
  children?: React.ReactNode;
}

const CompanySelector: React.FC<CompanySelectorProps> = ({
  companies,
  currentCompany,
  onSelectCompany,
  label,
  placeholder = "Selecciona una empresa para continuar.",
  children
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-100">
        <label className="block text-sm font-bold text-gray-700 mb-2">
          {label}
        </label>
        <select
          value={currentCompany?.id || ""}
          onChange={(e) => {
            const selected = companies.find(c => c.id === e.target.value);
            onSelectCompany(selected || null);
          }}
          className="w-full md:w-auto px-4 py-2 border border-gray-200 rounded-xl"
        >
          <option value="">-- Seleccionar empresa --</option>
          {companies.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      {currentCompany ? (
        children
      ) : (
        <div className="text-sm text-gray-500 bg-gray-50 p-6 rounded-xl border border-gray-100">
          {placeholder}
        </div>
      )}
    </div>
  );
};

export default CompanySelector;
