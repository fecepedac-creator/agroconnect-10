import React, { Suspense, lazy, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db, syncSuperadminClaims } from "./firebase";

import {
  LayoutDashboard,
  Users,
  Briefcase,
  Settings,
  Menu,
  Megaphone,
  Sprout,
  Wifi,
  Globe,
  Bot,
  LogOut,
  PlusCircle,
} from "lucide-react";


import LoginScreen from "./components/LoginScreen";

import { Worker, JobOffer, AppView, UserRole, Company, Lead, AdminConfig, WorkerStatus } from "./types";
import {
  INITIAL_WORKERS,
  INITIAL_JOBS,
  MOCK_GLOBAL_WORKERS,
  ENHANCED_DEMO_WORKERS,
  ENHANCED_DEMO_GLOBAL,
  DEMO_COMPANIES,
} from "./constants";
import { getCompanies } from "./services/companies";
type AdminTab = "OVERVIEW" | "COMPANIES" | "REQUESTS" | "SETTINGS";

const Dashboard = lazy(() => import("./components/Dashboard"));
const PublishOffer = lazy(() => import("./components/PublishOffer"));
const CompanySelector = lazy(() => import("./components/CompanySelector"));
const Workers = lazy(() => import("./components/Workers"));
const Jobs = lazy(() => import("./components/Jobs"));
const AdminPanel = lazy(() => import("./components/AdminPanel"));
const AIReview = lazy(() => import("./components/AIReview"));
const WorkerPortal = lazy(() => import("./components/WorkerPortal"));
const GlobalSearch = lazy(() => import("./components/GlobalSearch"));
const CompanySettings = lazy(() => import("./components/CompanySettings"));
const Broadcasts = lazy(() => import("./components/Broadcasts"));
const WorkerAuthScreen = lazy(() => import("./components/WorkerAuthScreen"));

const App: React.FC = () => {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [path, setPath] = useState(window.location.pathname);
  const [authReady, setAuthReady] = useState(false);
  const [roleReady, setRoleReady] = useState(false);
  const [authUserEmail, setAuthUserEmail] = useState<string | null>(null);
  const [isAdminClaim, setIsAdminClaim] = useState(false);

  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Data State
  const [workers, setWorkers] = useState<Worker[]>(INITIAL_WORKERS);
  const [jobs, setJobs] = useState<JobOffer[]>(INITIAL_JOBS);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [globalWorkers, setGlobalWorkers] = useState<Worker[]>(
    (ENHANCED_DEMO_GLOBAL as any) || ENHANCED_DEMO_WORKERS || MOCK_GLOBAL_WORKERS
  );
  // Public workers from Firestore (for Global Search)
  const [publicWorkers, setPublicWorkers] = useState<Worker[]>([]);
  const [publicWorkersLoading, setPublicWorkersLoading] = useState(true);
  
  const [companyStats, setCompanyStats] = useState<Record<string, any> | null>(null);
  const [globalStats, setGlobalStats] = useState<{
    companiesTotal?: number;
    companiesActive?: number;
    companiesOverdue?: number;
    jobsTotal?: number;
    jobsActive?: number;
    jobsFuture?: number;
    jobsClosed?: number;
    applicationsTotal?: number;
    hiresTotal?: number;
    workersTotal?: number;
  } | null>(null);

  const [adminConfig, setAdminConfig] = useState<AdminConfig>({
    whatsappNumber: "+56900000000",
    notificationEmail: "soporte@agroconnect.cl",
    supportTeam: "AgroConnect",
    demoMode: false,
  });

  const [adminTab, setAdminTab] = useState<AdminTab>("OVERVIEW");

  const handleRadarClick = () => setCurrentView(AppView.GLOBAL_SEARCH);
  const isDemoMode = Boolean(adminConfig.demoMode);
  const handleRoleSelect = (role: UserRole, companyData?: Company) => {
    if (role === UserRole.COMPANY && companyData) {
      setUserRole(role);
      const latestCompanyData = companies.find((c) => c.id === companyData.id) || companyData;
      setCurrentCompany(latestCompanyData);
      setCurrentView(AppView.DASHBOARD);
      return;
    }

    if (role === UserRole.ADMIN) {
      setUserRole(role);
      setCurrentCompany(null);
      setAdminTab("OVERVIEW");
      setCurrentView(AppView.ADMIN);
      return;
    }

    if (role === UserRole.WORKER) {
      window.location.assign("/trabajos");
      return;
    }

    setUserRole(role);
  };

  const handleUpdateCompany = (updated: Company) => {
    setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setCurrentCompany(updated);
  };

  const handleInviteWorker = async (worker: Worker) => {
    // Add to local state (existing behavior)
    setWorkers((prev) => {
      if (prev.some((item) => item.id === worker.id)) return prev;
      return [
        ...prev,
        {
          ...worker,
          status: worker.status ?? WorkerStatus.PENDING,
        },
      ];
    });
    
    // Create invitation record in Firestore
    if (currentCompany?.id) {
      try {
        await addDoc(collection(db, "companies", currentCompany.id, "worker_invitations"), {
          workerId: worker.id,
          workerName: worker.name,
          workerPhone: worker.phone,
          workerRegion: worker.region,
          workerSkills: worker.skills,
          status: "pending",
          createdAt: serverTimestamp(),
          createdBy: {
            uid: auth.currentUser?.uid || null,
            email: auth.currentUser?.email || null,
          },
        });
        console.log(`[AgroConnect] Invitación creada para ${worker.name}`);
      } catch (e) {
        console.error("Error creating invitation:", e);
      }
    }
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

  const handleLogout = async () => {
    localStorage.removeItem("adminIntent");
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out from Firebase Auth:", error);
    }
    setUserRole(null);
    setCurrentCompany(null);
    setCurrentView(AppView.DASHBOARD);
    setIsSidebarOpen(false);
  };

  const loadCompanies = async () => {
    setCompaniesLoading(true);
    setCompaniesError(null);
    try {
      const list = await getCompanies({
        demoMode: isDemoMode,
        demoCompanies: DEMO_COMPANIES,
      });
      setCompanies(list);
      // eslint-disable-next-line no-console
      console.info(`[Empresas] Cargadas ${list.length} compañías reales.`);
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
  }, [isDemoMode]);

  useEffect(() => {
    const handlePop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const authDebugEnabled = import.meta.env.DEV;
  const logAuthInfo = (...args: any[]) => {
    if (authDebugEnabled) {
      // eslint-disable-next-line no-console
      console.info("[Auth Debug]", ...args);
    }
  };
  const logAuthError = (...args: any[]) => {
    if (authDebugEnabled) {
      // eslint-disable-next-line no-console
      console.info("[Auth Debug][Error]", ...args);
    }
  };

  useEffect(() => {
    const loadAdminConfig = async () => {
      try {
        const snap = await getDoc(doc(db, "admin", "config"));
        if (snap.exists()) {
          setAdminConfig((prev) => ({
            ...prev,
            ...(snap.data() as AdminConfig),
          }));
        }
      } catch {
        // silent
      }
    };
    loadAdminConfig();
  }, []);

  useEffect(() => {
    if (!currentCompany?.id) {
      setCompanyStats(null);
      return;
    }
    const ref = doc(db, "stats_companies", currentCompany.id);
    const unsub = onSnapshot(
      ref,
      (snap) => setCompanyStats((snap.data() as any) || null),
      () => setCompanyStats(null)
    );
    return () => unsub();
  }, [currentCompany?.id]);

  // Subscribe to global stats for SuperAdmin
  useEffect(() => {
    if (userRole !== UserRole.ADMIN) {
      setGlobalStats(null);
      return;
    }
    
    const ref = doc(db, "stats", "global");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setGlobalStats(snap.data() as any);
        } else {
          // Fallback to computed stats if no document exists
          setGlobalStats({
            companiesTotal: 0,
            companiesActive: 0,
          });
        }
      },
      (error) => {
        console.error("Error fetching global stats:", error);
        setGlobalStats({});
      }
    );
    return () => unsub();
  }, [userRole]);

  // Subscribe to public workers pool (for Global Search)
  useEffect(() => {
    setPublicWorkersLoading(true);
    
    // Query workers that are available (consented) and public
    const q = query(
      collection(db, "publicWorkers"),
      where("isAvailable", "==", true),
      orderBy("createdAt", "desc"),
      limit(100)
    );
    
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Worker[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || "",
            rut: data.rut || "",
            phone: data.phone || "",
            region: data.region || "",
            status: data.status || WorkerStatus.CONSENTED,
            skills: data.skills || [],
            coordinates: data.coordinates || null,
          } as Worker;
        });
        setPublicWorkers(list);
        setPublicWorkersLoading(false);
      },
      (error) => {
        console.error("Error fetching public workers:", error);
        // Fallback to demo data if collection doesn't exist yet
        setPublicWorkers(ENHANCED_DEMO_GLOBAL as Worker[]);
        setPublicWorkersLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      const email = user?.email?.trim().toLowerCase() || null;
      setAuthUserEmail(email);
      setAuthReady(true);
      setRoleReady(false);
      setIsAdminClaim(false);
      const isAdminRoute = path.startsWith("/admin");
      logAuthInfo("Auth state changed", { path, email, isAdminRoute });
      if (!user) {
        setRoleReady(true);
        return;
      }

      if (isAdminRoute) {
        try {
          logAuthInfo("Syncing superadmin claims...");
          await syncSuperadminClaims();
          logAuthInfo("syncSuperadminClaims ok");
        } catch (error) {
          logAuthError("syncSuperadminClaims failed", error);
        }
      }

      const token = await user.getIdTokenResult(isAdminRoute);
      const role = String(token?.claims?.role || "").toLowerCase();
      const hasAdminClaim =
        token?.claims?.admin === true ||
        token?.claims?.superadmin === true ||
        role === "admin" ||
        role === "superadmin";
      setIsAdminClaim(hasAdminClaim);
      setRoleReady(true);
      logAuthInfo("Claims evaluated", { claims: token?.claims, hasAdminClaim });

      if (hasAdminClaim && isAdminRoute) {
        setUserRole(UserRole.ADMIN);
        setCurrentCompany(null);
        setAdminTab("OVERVIEW");
        setCurrentView(AppView.ADMIN);
      } else if (!hasAdminClaim && localStorage.getItem("adminIntent")) {
        localStorage.removeItem("adminIntent");
      }
    });
    return () => unsub();
  }, [path]);

  useEffect(() => {
    if (!path.startsWith("/admin") && userRole === UserRole.ADMIN) {
      setUserRole(null);
      setCurrentCompany(null);
      setCurrentView(AppView.DASHBOARD);
    }
  }, [path, userRole]);

  const isAllowlisted = authUserEmail ? isAdminClaim : false;

  if (path.startsWith("/admin") && (!authReady || !roleReady)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-sm text-gray-500">Cargando acceso...</div>
      </div>
    );
  }

  if (path.startsWith("/admin") && authReady && roleReady && authUserEmail == null) {
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

  if (path.startsWith("/admin") && authReady && roleReady && authUserEmail != null && !isAllowlisted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm max-w-md w-full">
          <h2 className="text-xl font-extrabold text-gray-900">No autorizado</h2>
          <p className="text-sm text-gray-500 mt-2">No tienes permisos para acceder al panel administrativo.</p>
          <button
            onClick={() => {
              window.history.pushState({}, "", "/");
              setPath("/");
            }}
            className="mt-6 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  if (path.startsWith("/admin") && authReady && roleReady && isAllowlisted && userRole === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-sm text-gray-500">Cargando panel...</div>
      </div>
    );
  }

  if (path.startsWith("/trabajos") || path.startsWith("/worker") || path.startsWith("/auth")) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center p-6"><div className="text-sm text-gray-500">Cargando portal...</div></div>}>
        <WorkerPortal />
      </Suspense>
    );
  }

  const handleAdminConfigSave = async (config: AdminConfig) => {
    setAdminConfig(config);
    await setDoc(doc(db, "admin", "config"), { ...config, updatedAt: serverTimestamp() }, { merge: true });
  };

  const handleToggleDemoMode = async (nextValue: boolean) => {
    const updated = { ...adminConfig, demoMode: nextValue };
    await handleAdminConfigSave(updated);
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

  if (!authReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-sm text-gray-500">Cargando acceso...</div>
      </div>
    );
  }

  // ✅ Evita overlay: si no hay rol seleccionado, SOLO se muestra LoginScreen (landing).
  if (userRole === null && !path.startsWith("/admin")) {
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
              {/* Worker Auth removed - development tool only */}
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
            onClick={() => void handleLogout()}
            className="text-sm font-bold text-gray-500 hover:text-gray-700 flex items-center gap-2"
          >
            <LogOut size={16} />
            Salir
          </button>
        </div>

        {/* Content */}
        <Suspense fallback={<div className="text-sm text-gray-500">Cargando modulo...</div>}>
        <div className="p-6">
          {currentView === AppView.DASHBOARD && (
            <Dashboard
              jobs={jobs}
              workers={workers}
              globalWorkers={publicWorkers.length > 0 ? publicWorkers : globalWorkers}
              onRadarClick={handleRadarClick}
              demoMode={isDemoMode || publicWorkers.length === 0}
              companyStats={companyStats}
              globalStats={globalStats}
              isAdmin={userRole === UserRole.ADMIN}
            />
          )}
          {currentView === AppView.WORKERS && <Workers workers={workers} setWorkers={setWorkers} />}
          {currentView === AppView.JOBS &&
            (userRole === UserRole.ADMIN ? (
              // SuperAdmin view with company selector
              <CompanySelector
                companies={companies}
                currentCompany={currentCompany}
                onSelectCompany={setCurrentCompany}
                label="Selecciona una empresa para gestionar ofertas:"
                placeholder="Selecciona una empresa para ver y gestionar sus ofertas."
              >
                {currentCompany && (
                  <Jobs jobs={jobs} setJobs={setJobs} currentCompany={currentCompany} />
                )}
              </CompanySelector>
            ) : currentCompany ? (
              <Jobs jobs={jobs} setJobs={setJobs} currentCompany={currentCompany} />
            ) : (
              <div className="text-sm text-gray-500">Selecciona una empresa para ver las ofertas.</div>
            ))}
          {currentView === AppView.PUBLISH_OFFER && (
            userRole === UserRole.ADMIN ? (
              <CompanySelector
                companies={companies}
                currentCompany={currentCompany}
                onSelectCompany={setCurrentCompany}
                label="Selecciona una empresa para publicar oferta:"
                placeholder="Selecciona una empresa para publicar ofertas."
              >
                {currentCompany && (
                  <PublishOffer company={currentCompany} onNavigate={setCurrentView} />
                )}
              </CompanySelector>
            ) : currentCompany ? (
              <PublishOffer company={currentCompany} onNavigate={setCurrentView} />
            ) : (
              <div className="text-sm text-gray-500">Selecciona una empresa para publicar ofertas.</div>
            )
          )}
          {currentView === AppView.ADMIN && (
            <AdminPanel
              companies={companies}
              setCompanies={setCompanies}
              adminConfig={adminConfig}
              setAdminConfig={setAdminConfig}
              activeTab={adminTab}
              setActiveTab={setAdminTab}
              isDemoMode={Boolean(adminConfig.demoMode)}
              onToggleDemo={handleToggleDemoMode}
              onBack={() => setCurrentView(AppView.DASHBOARD)}
            />
          )}
          {currentView === AppView.GLOBAL_SEARCH && (
            <GlobalSearch 
              globalWorkers={publicWorkers.length > 0 ? publicWorkers : globalWorkers} 
              onInviteWorker={handleInviteWorker}
              isLoading={publicWorkersLoading}
              isDemo={publicWorkers.length === 0}
              currentCompany={currentCompany}
            />
          )}
          {currentView === AppView.SETTINGS_COMPANY &&
            (userRole === UserRole.ADMIN ? (
              currentCompany ? (
                <CompanySettings company={currentCompany} jobs={jobs} onUpdateCompany={handleUpdateCompany} />
              ) : (
                <div className="bg-white border border-gray-100 rounded-2xl p-6">
                  <div className="text-lg font-bold text-gray-800 mb-2">Ajustes de Empresa</div>
                  <p className="text-sm text-gray-500 mb-4">
                    Selecciona una empresa para editar sus datos oficiales. La lista usa la misma fuente de
                    “Empresas”.
                  </p>
                  <div className="space-y-2">
                    {companies.map((company) => (
                      <button
                        key={company.id}
                        onClick={() => setCurrentCompany(company)}
                        className="w-full text-left border border-gray-200 rounded-xl px-4 py-3 hover:bg-emerald-50"
                      >
                        <div className="font-semibold text-gray-800">{company.name}</div>
                        <div className="text-xs text-gray-500">{company.region || company.rut || "—"}</div>
                      </button>
                    ))}
                    {companies.length === 0 && (
                      <div className="text-sm text-gray-500">No hay empresas disponibles.</div>
                    )}
                  </div>
                </div>
              )
            ) : currentCompany ? (
              <CompanySettings company={currentCompany} jobs={jobs} onUpdateCompany={handleUpdateCompany} />
            ) : (
              <div className="text-sm text-gray-500">Selecciona una empresa para ver los ajustes.</div>
            ))}
          {currentView === AppView.BROADCASTS && (
            <Broadcasts company={currentCompany} jobs={jobs} workers={workers} />
          )}
          {currentView === AppView.AI_REVIEW && <AIReview />}
          {currentView === AppView.WORKER_PORTAL && <WorkerPortal />}
          {currentView === AppView.WORKER_AUTH && (
            <WorkerAuthScreen onSuccess={() => setCurrentView(AppView.WORKER_PORTAL)} onBack={() => void handleLogout()} />
          )}
        </div>
        </Suspense>
      </main>
    </div>
  );
};

export default App;


