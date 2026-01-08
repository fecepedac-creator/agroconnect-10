import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase"; // asegúrate que tu firebase.ts exporta db
import { LayoutDashboard, Users, Briefcase, Settings, Menu, X, Bot, LogOut, Globe, Megaphone, Sprout, Wifi, Inbox, Sliders } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Workers from './components/Workers';
import Jobs from './components/Jobs';
import AdminPanel from './components/AdminPanel';
import AIReview from './components/AIReview';
import WorkerPortal from './components/WorkerPortal';
import WorkerAuthScreen from './components/WorkerAuthScreen';
import LoginScreen from './components/LoginScreen';
import GlobalSearch from './components/GlobalSearch';
import CompanySettings from './components/CompanySettings';
import Broadcasts from './components/Broadcasts';
import { Worker, JobOffer, AppView, UserRole, Company, Lead, AdminConfig } from './types';
import { INITIAL_WORKERS, INITIAL_JOBS, INITIAL_COMPANIES, MOCK_GLOBAL_WORKERS, ENHANCED_DEMO_WORKERS, ENHANCED_DEMO_GLOBAL } from './constants';

const App: React.FC = () => {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Worker auth gate (RUT + clave)
  const [isWorkerAuthenticated, setIsWorkerAuthenticated] = useState(false);

  // Demo Mode State
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Data State
  const [workers, setWorkers] = useState<Worker[]>(INITIAL_WORKERS);
  const [jobs, setJobs] = useState<JobOffer[]>(INITIAL_JOBS);
  const [companies, setCompanies] = useState<Company[]>(INITIAL_COMPANIES);
  const [globalWorkers, setGlobalWorkers] = useState<Worker[]>(MOCK_GLOBAL_WORKERS);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [adminConfig, setAdminConfig] = useState<AdminConfig>({
    whatsappNumber: '+56912345678',
    notificationEmail: 'admin@agroconnect.cl',
    supportTeam: 'soporte@agroconnect.cl'
  });

  const [adminTab, setAdminTab] = useState<'OVERVIEW' | 'COMPANIES' | 'REQUESTS' | 'SETTINGS'>('OVERVIEW');
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);

  // Sync data when demo mode changes
  useEffect(() => {
    if (isDemoMode) {
      setWorkers(ENHANCED_DEMO_WORKERS);
      setGlobalWorkers(ENHANCED_DEMO_GLOBAL);
    } else {
      setWorkers(INITIAL_WORKERS);
      setGlobalWorkers(MOCK_GLOBAL_WORKERS);
    }
  }, [isDemoMode]);

  const handleRoleSelect = (role: UserRole, companyData?: Company) => {
    setUserRole(role);

    if (role === UserRole.COMPANY && companyData) {
      const latestCompanyData = companies.find(c => c.id === companyData.id) || companyData;
      setCurrentCompany(latestCompanyData);
      setCurrentView(AppView.DASHBOARD);

    } else if (role === UserRole.ADMIN) {
      setCurrentView(AppView.ADMIN);
      setAdminTab('OVERVIEW');
      setCurrentCompany(null);

    } else if (role === UserRole.WORKER) {
      // IMPORTANTE: trabajador NO entra directo al portal
      setIsWorkerAuthenticated(false);
      setCurrentView(AppView.WORKER_PORTAL);
      setCurrentCompany(null);
    }
  };

  const handleUpdateCompany = (updated: Company) => {
    setCompanies(prev => prev.map(c => c.id === updated.id ? updated : c));
    setCurrentCompany(updated);
  };

  const handleRegisterLead = (leadData: Omit<Lead, 'id' | 'timestamp' | 'status'>) => {
    const newLead: Lead = {
      ...leadData,
      id: `lead-${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: 'PENDING'
    };
    setLeads(prev => [newLead, ...prev]);
    console.log(`🚨 [SISTEMA] Alerta WhatsApp enviada a ${adminConfig.whatsappNumber}: "Nuevo Lead: ${newLead.companyName}"`);
  };

  const handleLogout = () => {
    setUserRole(null);
    setCurrentCompany(null);
    setIsWorkerAuthenticated(false);
    setCurrentView(AppView.DASHBOARD);
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const handleRadarClick = () => setCurrentView(AppView.GLOBAL_SEARCH);

  // Render login screen if no role is selected
  if (!userRole) {
    return <LoginScreen companies={companies} onSelectRole={handleRoleSelect} onRegisterLead={handleRegisterLead} />;
  }

  // Worker flow: auth screen first, then portal
  if (userRole === UserRole.WORKER) {
    if (!isWorkerAuthenticated) {
      return (
        <WorkerAuthScreen
          onSuccess={() => setIsWorkerAuthenticated(true)}
          onBack={handleLogout}
        />
      );
    }
    return <WorkerPortal jobs={jobs} onLogout={handleLogout} />;
  }

  const NavItem = ({
    view,
    icon: Icon,
    label,
    badge,
    onClick
  }: {
    view?: AppView,
    icon: any,
    label: string,
    badge?: number,
    onClick?: () => void
  }) => (
    <button
      onClick={() => {
        if (onClick) onClick();
        else if (view) setCurrentView(view);
        setIsSidebarOpen(false);
      }}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
        (view && currentView === view) || (view === AppView.ADMIN && currentView === AppView.ADMIN && !onClick)
          ? 'bg-emerald-50 text-emerald-700 font-semibold shadow-sm'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon size={20} />
        <span>{label}</span>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </button>
  );

  // ---- (desde aquí, tu App.tsx sigue igual: sidebar + vistas)
  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:transform-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-gray-100 flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Sprout size={24} className="text-emerald-600" />
            <Wifi size={20} className="text-blue-500" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-gray-900 leading-none">
              Agro<span className="text-emerald-600">Connect</span>
            </h1>
          </div>
        </div>

        <nav className="p-4 space-y-2 mt-4">
          {userRole === UserRole.COMPANY && (
            <>
              <NavItem view={AppView.DASHBOARD} icon={LayoutDashboard} label="Resumen" />
              <div className="pt-2 pb-1 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Gestión Interna</div>
              <NavItem view={AppView.WORKERS} icon={Users} label="Mis Trabajadores" />
              <NavItem view={AppView.JOBS} icon={Briefcase} label="Mis Ofertas" />
              <NavItem view={AppView.BROADCASTS} icon={Megaphone} label="Difusiones" />
              <div className="pt-4 pb-1 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Reclutamiento</div>
              <NavItem view={AppView.GLOBAL_SEARCH} icon={Globe} label="Buscar Talento" />
              <div className="pt-4 pb-1 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Cuenta</div>
              <NavItem view={AppView.SETTINGS_COMPANY} icon={Settings} label="Configuración" />
            </>
          )}

          {userRole === UserRole.ADMIN && (
            <>
              <NavItem icon={LayoutDashboard} label="Dashboard Global" onClick={() => { setCurrentView(AppView.ADMIN); setAdminTab('OVERVIEW'); }} />
              <NavItem icon={Briefcase} label="Gestión Empresas" onClick={() => { setCurrentView(AppView.ADMIN); setAdminTab('COMPANIES'); }} />
              <div className="pt-2 pb-1 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Operaciones</div>
              <NavItem icon={Inbox} label="Solicitudes" badge={leads.length} onClick={() => { setCurrentView(AppView.ADMIN); setAdminTab('REQUESTS'); }} />
              <NavItem icon={Settings} label="Configuración" onClick={() => { setCurrentView(AppView.ADMIN); setAdminTab('SETTINGS'); }} />
              <div className="pt-4 pb-1 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Inteligencia</div>
              <NavItem view={AppView.AI_REVIEW} icon={Bot} label="Auditoría IA" />
            </>
          )}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-gray-100 bg-gray-50">
          <button onClick={handleLogout} className="flex items-center gap-2 text-gray-600 hover:text-red-600 transition-colors w-full p-2 rounded-lg hover:bg-red-50">
            <LogOut size={18} /><span className="text-sm font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={toggleSidebar} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="text-sm text-gray-500">
              {userRole === UserRole.COMPANY && currentCompany ? currentCompany.name : userRole}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {currentView === AppView.DASHBOARD && <Dashboard workers={workers} jobs={jobs} globalWorkers={globalWorkers} onRadarClick={handleRadarClick} />}
          {currentView === AppView.WORKERS && <Workers workers={workers} setWorkers={setWorkers} />}
          {currentView === AppView.JOBS && <Jobs jobs={jobs} setJobs={setJobs} currentCompany={currentCompany} />}
          {currentView === AppView.GLOBAL_SEARCH && <GlobalSearch globalWorkers={globalWorkers} onInviteWorker={() => {}} />}
          {currentView === AppView.BROADCASTS && <Broadcasts company={currentCompany} jobs={jobs} workers={[...workers, ...globalWorkers]} />}
          {currentView === AppView.SETTINGS_COMPANY && currentCompany && (
            <CompanySettings company={currentCompany} jobs={jobs} onUpdateCompany={handleUpdateCompany} />
          )}
          {currentView === AppView.ADMIN && (
            <AdminPanel
              companies={companies}
              setCompanies={setCompanies}
              leads={leads}
              setLeads={setLeads}
              adminConfig={adminConfig}
              setAdminConfig={setAdminConfig}
              activeTab={adminTab}
              setActiveTab={setAdminTab}
              isDemoMode={isDemoMode}
              onToggleDemo={setIsDemoMode}
            />
          )}
          {currentView === AppView.AI_REVIEW && <AIReview workers={workers} jobs={jobs} companies={companies} />}
        </div>
      </main>
    </div>
  );
};

export default App;
