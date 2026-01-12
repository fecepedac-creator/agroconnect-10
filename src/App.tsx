import React, { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
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
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [globalWorkers, setGlobalWorkers] = useState<Worker[]>(
    (ENHANCED_DEMO_GLOBAL as any) || ENHANCED_DEMO_WORKERS || MOCK_GLOBAL_WORKERS
  );

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

  const handleRegisterLead = async (leadData: Omit<Lead, "id" | "status" | "createdAt" | "updatedAt">) => {
    try {
      const payload = {
        ...leadData,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, "company_leads"), payload);
      // eslint-disable-next-line no-console
      console.log(`🚨 [SISTEMA] Nuevo Lead: ${leadData.companyName} (${ref.id})`);
      return { ok: true };
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("register lead error:", e);
      return { ok: false, message: "No se pudo registrar la solicitud. Intenta nuevamente." };
    }
  };

  const handleLogout = () => {
    setUserRole(null);
    setCurrentCompany(null);
    setCurrentView(AppView.DASHBOARD);
    setIsSidebarOpen(false);
  };

  const loadCompanies = async () => {
    setCompaniesLoading(true);
    setCompaniesError(null);
    try {
      const baseRef = collection(db, "companies");
      const orderedQuery = query(
        baseRef,
        where("status", "==", "active"),
        where("visibility", "==", "public"),
        orderBy("name", "asc"),
        limit(200)
      );

      try {
        const snap = await getDocs(orderedQuery);
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Company[];
        setCompanies(list);
        return;
      } catch (e: any) {
        const msg = String(e?.message || "");
        const code = String(e?.code || "");
        if (code !== "failed-precondition" && !msg.toLowerCase().includes("index")) {
          throw e;
        }
        // fallback sin orderBy si falta índice
        const fallbackQuery = query(
          baseRef,
          where("status", "==", "active"),
          where("visibility", "==", "public"),
          limit(200)
        );
        const snap = await getDocs(fallbackQuery);
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Company[];
        list.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "es"));
        setCompanies(list);
      }
    } catch (e: any) {
      setCompanies([]);
      setCompaniesError("No se pudieron cargar las empresas. Intenta nuevamente.");
      // eslint-disable-next-line no-console
      console.error("loadCompanies error:", e);
    } finally {
      setCompaniesLoading(false);
    }
  };

  useEffect(() => {
    void loadCompanies();
  }, []);

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
        <LoginScreen
          companies={companies}
          companiesLoading={companiesLoading}
          companiesError={companiesError}
          onRetryCompanies={loadCompanies}
          onSelectRole={handleRoleSelect}
          onRegisterLead={handleRegisterLead}
        />
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
              <NavItem view={AppView.ADMIN} icon={LayoutDashboard} label="Panel SuperAdmin" />
              <NavItem view={AppView.DASHBOARD} icon={LayoutDashboard} label="Dashboard" />
              <NavItem view={AppView.GLOBAL_SEARCH} icon={Globe} label="Global Search" />
              <NavItem view={AppView.WORKERS} icon={Users} label="Trabajadores" />
              <NavItem view={AppView.JOBS} icon={Briefcase} label="Ofertas" />
              <NavItem view={AppView.PUBLISH_OFFER} icon={PlusCircle} label="Publicar oferta" />
              <NavItem view={AppView.BROADCASTS} icon={Megaphone} label="Difusiones" />
              <NavItem view={AppView.SETTINGS_COMPANY} icon={Settings} label="Ajustes" />
              <NavItem view={AppView.AI_REVIEW} icon={Bot} label="AI Review" />
              <NavItem view={AppView.WORKER_AUTH} icon={Users} label="Worker Auth" />
            </>
          )}

          {userRole === UserRole.WORKER && (
            <>
              <NavItem view={AppView.WORKER_PORTAL} icon={LayoutDashboard} label="Portal" />
              <NavItem view={AppView.WORKER_AUTH} icon={Users} label="Auth" />
            </>
          )}
        </nav>
      </aside>

      <main className="flex-1 min-h-screen">
        {/* Topbar */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <Menu size={22} />
            </button>
            <div className="text-sm text-gray-500">{currentCompany?.name}</div>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm font-bold text-gray-500 hover:text-gray-700 flex items-center gap-2"
          >
            <LogOut size={16} />
            Salir
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {currentView === AppView.DASHBOARD && (
            <Dashboard
              currentCompany={currentCompany}
              jobs={jobs}
              workers={workers}
              onRadarClick={handleRadarClick}
            />
          )}
          {currentView === AppView.WORKERS && <Workers workers={workers} setWorkers={setWorkers} />}
          {currentView === AppView.JOBS && <Jobs jobs={jobs} setJobs={setJobs} />}
          {currentView === AppView.PUBLISH_OFFER && (
            <PublishOffer
              currentCompany={currentCompany}
              jobs={jobs}
              setJobs={setJobs}
              workers={workers}
            />
          )}
          {currentView === AppView.ADMIN && (
              <AdminPanel
                companies={companies}
                setCompanies={setCompanies}
                adminConfig={adminConfig}
                setAdminConfig={setAdminConfig}
                activeTab={adminTab}
              setActiveTab={setAdminTab}
              isDemoMode={isDemoMode}
              onToggleDemo={setIsDemoMode}
              onBack={() => setCurrentView(AppView.DASHBOARD)}
            />
          )}
          {currentView === AppView.GLOBAL_SEARCH && <GlobalSearch globalWorkers={globalWorkers} />}
          {currentView === AppView.SETTINGS_COMPANY && (
            <CompanySettings company={currentCompany} onUpdateCompany={handleUpdateCompany} />
          )}
          {currentView === AppView.BROADCASTS && <Broadcasts />}
          {currentView === AppView.AI_REVIEW && <AIReview />}
          {currentView === AppView.WORKER_PORTAL && (
            <WorkerPortal currentCompany={currentCompany} jobs={jobs} workers={workers} />
          )}
          {currentView === AppView.WORKER_AUTH && <WorkerAuthScreen />}
        </div>
      </main>
    </div>
  );
};

export default App;
