import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

import {
  LayoutDashboard,
  Users,
  Briefcase,
  Settings,
  Menu,
  X,
  Megaphone,
  Sprout,
  Wifi,
  Inbox,
  Sliders,
  Globe,
  Bot,
  LogOut,
  PlusCircle,
} from "lucide-react";

import Dashboard from "./components/Dashboard";
import CompanyDashboard from "./components/CompanyDashboard";
import PublishOffer from "./components/PublishOffer";

import Workers from "./components/Workers";
import Jobs from "./components/Jobs";
import AdminPanel from "./components/AdminPanel";
import AIReview from "./components/AIReview";
import WorkerPortal from "./components/WorkerPortal";
import LoginScreen from "./components/LoginScreen";
import GlobalSearch from "./components/GlobalSearch";
import CompanySettings from "./components/CompanySettings";
import Broadcasts from "./components/Broadcasts";

import { Worker, JobOffer, AppView, UserRole, Company, Lead, AdminConfig } from "./types";
import {
  INITIAL_WORKERS,
  INITIAL_JOBS,
  INITIAL_COMPANIES,
  MOCK_GLOBAL_WORKERS,
  ENHANCED_DEMO_WORKERS,
  ENHANCED_DEMO_GLOBAL,
} from "./constants";

type AdminTab = "OVERVIEW" | "COMPANIES" | "REQUESTS" | "SETTINGS";

const App: React.FC = () => {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);

  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Demo Mode State (usado por AdminPanel)
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Data State
  const [workers, setWorkers] = useState<Worker[]>(INITIAL_WORKERS);
  const [jobs, setJobs] = useState<JobOffer[]>(INITIAL_JOBS);
  const [companies, setCompanies] = useState<Company[]>(INITIAL_COMPANIES);
  const [globalWorkers, setGlobalWorkers] = useState<Worker[]>(
    (ENHANCED_DEMO_GLOBAL as any) || ENHANCED_DEMO_WORKERS || MOCK_GLOBAL_WORKERS
  );

  const [leads, setLeads] = useState<Lead[]>([]);
  const [adminConfig, setAdminConfig] = useState<AdminConfig>({
    whatsappNumber: "+56900000000",
    notificationEmail: "soporte@agroconnect.cl",
    supportTeam: "AgroConnect",
  });

  const [adminTab, setAdminTab] = useState<AdminTab>("OVERVIEW");

  const handleRadarClick = () => setCurrentView(AppView.GLOBAL_SEARCH);

  const handleRoleSelect = (role: UserRole, companyData?: Company) => {
    setUserRole(role);

    if (role === UserRole.COMPANY && companyData) {
      const latestCompanyData = companies.find((c) => c.id === companyData.id) || companyData;
      setCurrentCompany(latestCompanyData);
      setCurrentView(AppView.DASHBOARD);
      return;
    }

    if (role === UserRole.ADMIN) {
      setCurrentCompany(null);
      setAdminTab("OVERVIEW");
      setCurrentView(AppView.ADMIN);
      return;
    }

    if (role === UserRole.WORKER) {
      window.location.assign("/trabajos");
      return;
    }
  };

  const handleUpdateCompany = (updated: Company) => {
    setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setCurrentCompany(updated);
  };

  const handleRegisterLead = (leadData: Omit<Lead, "id" | "timestamp" | "status">) => {
    const newLead: Lead = {
      ...leadData,
      id: `lead-${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: "PENDING",
    };
    setLeads((prev) => [newLead, ...prev]);

    try {
      // eslint-disable-next-line no-console
      console.log(`🚨 [SISTEMA] Nuevo Lead: ${newLead.companyName} (${newLead.contactName})`);
    } catch {}
  };

  const handleLogout = () => {
    setUserRole(null);
    setCurrentCompany(null);
    setCurrentView(AppView.DASHBOARD);
    setIsSidebarOpen(false);
  };

  const isWorkerPortalRoute = /^\/(trabajos|worker|auth)(\/|$)/.test(window.location.pathname);
  if (isWorkerPortalRoute) {
    return <WorkerPortal onExit={handleLogout} />;
  }

  useEffect(() => {
    const loadAdminConfig = async () => {
      try {
        const snap = await getDoc(doc(db, "admin", "config"));
        if (snap.exists()) setAdminConfig(snap.data() as any);
      } catch {
        // silent
      }
    };
    loadAdminConfig();
  }, []);

  const handleAdminConfigSave = async (config: AdminConfig) => {
    setAdminConfig(config);
    await setDoc(doc(db, "admin", "config"), { ...config, updatedAt: serverTimestamp() }, { merge: true });
  };

  const NavItem = ({ view, icon: Icon, label }: { view: AppView; icon: any; label: string }) => {
    const active = currentView === view;
    return (
      <button
        onClick={() => {
          setCurrentView(view);
          setIsSidebarOpen(false);
        }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition ${
          active ? "bg-emerald-50 text-emerald-700" : "text-gray-700 hover:bg-gray-100"
        }`}
      >
        <Icon size={18} className={active ? "text-emerald-600" : "text-gray-500"} />
        {label}
      </button>
    );
  };

  // ✅ Evita overlay: si no hay rol seleccionado, SOLO se muestra LoginScreen (landing).
  if (userRole === null) {
    return (
      <div className="min-h-screen bg-gray-50 font-sans">
        <LoginScreen companies={companies} onSelectRole={handleRoleSelect} onRegisterLead={handleRegisterLead} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-white border-r border-gray-100 transform transition-transform duration-200 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
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

              <div className="pt-2 pb-1 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Gestión</div>
              <NavItem view={AppView.WORKERS} icon={Users} label="Mis Trabajadores" />
              <NavItem view={AppView.JOBS} icon={Briefcase} label="Mis Ofertas" />
              <NavItem view={AppView.PUBLISH_OFFER} icon={PlusCircle} label="Publicar oferta" />
              <NavItem view={AppView.BROADCASTS} icon={Megaphone} label="Difusiones" />

              <div className="pt-4 pb-1 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Reclutamiento</div>
              <NavItem view={AppView.GLOBAL_SEARCH} icon={Globe} label="Buscar Talento" />

              <div className="pt-4 pb-1 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                Configuración
              </div>
              <NavItem view={AppView.SETTINGS_COMPANY} icon={Settings} label="Ajustes" />
            </>
          )}

          {userRole === UserRole.ADMIN && (
            <>
              <NavItem view={AppView.ADMIN} icon={Sliders} label="SuperAdmin" />
              <NavItem view={AppView.AI_REVIEW} icon={Bot} label="Revisión IA" />
            </>
          )}

          {userRole === UserRole.WORKER && <NavItem view={AppView.WORKER_PORTAL} icon={Inbox} label="Portal Trabajador" />}
        </nav>

        <div className="p-4 border-t border-gray-100 mt-auto">
          <button
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            <LogOut size={16} />
            Salir
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden rounded-xl border border-gray-200 bg-white p-2 hover:bg-gray-50"
              onClick={() => setIsSidebarOpen((v) => !v)}
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="text-sm text-gray-500">
              {userRole === UserRole.COMPANY && currentCompany ? currentCompany.name : userRole}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {/* DASHBOARD */}
          {currentView === AppView.DASHBOARD &&
            (userRole === UserRole.COMPANY && currentCompany ? (
              <CompanyDashboard company={currentCompany} jobs={jobs} onNavigate={(view) => setCurrentView(view)} />
            ) : (
              <Dashboard workers={workers} jobs={jobs} globalWorkers={globalWorkers} onRadarClick={handleRadarClick} />
            ))}

          {/* COMPANY */}
          {currentView === AppView.WORKERS && <Workers workers={workers} setWorkers={setWorkers} />}
          {currentView === AppView.JOBS && <Jobs jobs={jobs} setJobs={setJobs} currentCompany={currentCompany} />}
          {currentView === AppView.PUBLISH_OFFER && currentCompany && (
            <PublishOffer company={currentCompany} onNavigate={(view) => setCurrentView(view)} />
          )}
          {currentView === AppView.GLOBAL_SEARCH && <GlobalSearch globalWorkers={globalWorkers} onInviteWorker={() => {}} />}
          {currentView === AppView.BROADCASTS && (
            <Broadcasts company={currentCompany} jobs={jobs} workers={[...workers, ...globalWorkers]} />
          )}
          {currentView === AppView.SETTINGS_COMPANY && currentCompany && (
            <CompanySettings company={currentCompany} jobs={jobs} onUpdateCompany={handleUpdateCompany} />
          )}

          {/* ADMIN */}
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

          {/* WORKER */}
          {currentView === AppView.WORKER_PORTAL && <WorkerPortal onExit={handleLogout} />}
        </div>
      </main>
    </div>
  );
};

export default App;
