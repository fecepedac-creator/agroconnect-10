import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, db, debugAuthClaims, functions, setSuperadminByEmail } from "../firebase";
import type { CompanyStatus } from "../types";
import { normalizeCompanyStatus } from "../utils/companyStatus";
import TrustOperationsPanel from "./TrustOperationsPanel";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  DollarSign,
  Leaf,
  Mail,
  TrendingUp,
  Users,
} from "lucide-react";

/**
 * AdminPanel (SuperAdmin Dashboard)
 *
 * ✅ No rompe la arquitectura actual (App.tsx usa tabs + props).
 * ✅ Firestore = fuente única de verdad.
 * ✅ Métricas pesadas desde colecciones agregadas:
 *    - stats/global (doc)
 *    - stats_monthly/{YYYY-MM}
 *    - stats_companies/{companyId}
 * ✅ FinOps:
 *    - finops_infra/{YYYY-MM}
 *    - finops_manualExpenses/{expenseId}
 */

type SubscriptionPlan = "Basic" | "Pro" | "Enterprise";
type Address = {
  line1?: string;
  city?: string | null;
  region?: string | null;
  country?: string | null;
};

export type CompanyDoc = {
  name: string;
  rut?: string | null;
  industry?: string | null;
  description?: string | null;
  website?: string | null;
  billingEmail?: string | null;
  legalName?: string | null;
  tags?: string[];
  isPublic?: boolean;

  contactEmail?: string | null;
  phone?: string | null;

  address?: Address;

  adminEmail: string;
  subscriptionPlan?: SubscriptionPlan;
  status?: CompanyStatus;

  createdBy?: { uid?: string; email?: string | null };
  createdAt?: any;
  updatedAt?: any;
};

type CompanyRow = {
  id: string;
  name: string;
  subscriptionPlan?: SubscriptionPlan;
  status?: CompanyStatus;
  contactEmail?: string | null;
  adminEmail: string;
  rut?: string | null;
  industry?: string | null;
  region?: string | null;
  city?: string | null;
};

type LeadStatus = "pending" | "contacted" | "approved" | "rejected";

type LeadDoc = {
  id: string;
  companyName: string;
  rut: string;
  email: string;
  phone?: string;
  region?: string;
  status: LeadStatus;
  createdAt?: any;
  updatedAt?: any;
  notes?: string;
};
type AdminConfig = any;

type AdminPanelProps = {
  companies: any[];
  setCompanies: React.Dispatch<React.SetStateAction<any[]>>;
  adminConfig: AdminConfig;
  setAdminConfig: React.Dispatch<React.SetStateAction<AdminConfig>>;
  activeTab: "OVERVIEW" | "COMPANIES" | "REQUESTS" | "TRUST" | "SETTINGS";
  setActiveTab: React.Dispatch<
    React.SetStateAction<"OVERVIEW" | "COMPANIES" | "REQUESTS" | "TRUST" | "SETTINGS">
  >;
  isDemoMode: boolean;
  onToggleDemo: (v: boolean) => void;
  onBack?: () => void;
};

type GlobalStatsDoc = {
  companiesTotal?: number;
  companiesActive?: number;
  companiesOverdue?: number;
  companiesSuspended?: number;
  jobsTotal?: number;
  jobsActive?: number;
  jobsFuture?: number;
  jobsClosed?: number;
  applicationsTotal?: number;
  matchesTotal?: number;
  matchesConfirmed?: number;
  hiresTotal?: number;
  workersTotal?: number; // si existe en el futuro
  updatedAt?: any;
};

type MonthlyStatsDoc = {
  ym: string; // YYYY-MM
  jobsCreated?: number;
  applicationsCreated?: number;
  matchesCreated?: number;
  matchesConfirmed?: number;
  hiresCreated?: number;
  updatedAt?: any;
};

type CompanyStatsDoc = {
  companyId: string;
  jobsTotal?: number;
  jobsActive?: number;
  jobsFuture?: number;
  jobsClosed?: number;
  applicationsTotal?: number;
  hiresTotal?: number;
  lastJobAt?: any;
  lastApplicationAt?: any;
  updatedAt?: any;
};

type InfraFinOpsDoc = {
  ym: string;
  firestoreReads?: number;
  firestoreWrites?: number;
  firestoreDeletes?: number;
  storageGB?: number;
  functionsInvocations?: number;
  notes?: string;
  updatedAt?: any;
};

type ManualExpenseDoc = {
  category: "Personal" | "Marketing" | "Servicios" | "Licencias" | "Otros";
  vendor?: string;
  amount: number;
  currency: "CLP" | "USD";
  startMonth: string; // YYYY-MM
  recurrence: "once" | "monthly";
  months?: number; // si recurrence=monthly (por defecto 1)
  note?: string;
  createdAt?: any;
  createdBy?: { uid?: string; email?: string | null };
};

type BillingRecordDoc = {
  type: "invoice" | "payment";
  amount: number;
  currency: "CLP" | "USD";
  issuedAt?: string; // YYYY-MM-DD
  dueAt?: string; // YYYY-MM-DD
  paidAt?: string; // YYYY-MM-DD
  status: "paid" | "unpaid" | "overdue";
  reference?: string;
  note?: string;
  createdAt?: any;
  createdBy?: { uid?: string; email?: string | null };
};

type CommsOutboxDoc = {
  companyId: string;
  to: string;
  templateKey: "overdue" | "suspension" | "low_activity" | "holiday" | "custom";
  /** Remitente deseado (para proveedores tipo SendGrid/Mailgun). */
  fromEmail?: string;
  /** Reply-To recomendado: correo del superadmin para que respondan directo. */
  replyTo?: string | null;
  subject: string;
  text: string;
  status: "queued" | "sent" | "error";
  createdAt?: any;
  createdBy?: { uid?: string; email?: string | null };
  errorMessage?: string;
};

type AuthDebugPayload = {
  email: string | null;
  uid: string | null;
  claims: Record<string, unknown>;
  issuedAt: string | null;
  expiresAt: string | null;
};

// --------- Helpers UI ---------
const inputBase =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400";
const labelBase = "text-xs font-semibold text-gray-600";
const helpBase = "mt-1 text-[11px] text-gray-500";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700">
      {children}
    </span>
  );
}


function statusLabel(s?: CompanyStatus) {
  switch (s) {
    case "overdue":
      return "🔴 Morosidad";
    case "suspended":
      return "Suspendida";
    case "pending":
      return "Pendiente";
    case "inactive":
      return "Inactiva";
    case "active":
    default:
      return "🟢 Pagos al día";
  }
}

function statusPillClasses(s?: CompanyStatus) {
  switch (s) {
    case "overdue":
      return "border-red-300 bg-red-100 text-red-800 font-semibold";
    case "suspended":
      return "border-gray-300 bg-gray-100 text-gray-700";
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "inactive":
      return "border-gray-300 bg-gray-100 text-gray-700";
    case "active":
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
}

function StatusBadge({ status }: { status?: CompanyStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusPillClasses(
        status
      )}`}
      title={status || "active"}
    >
      {statusLabel(status)}
    </span>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <div className="text-xs font-semibold text-gray-500">{title}</div>
      <div className="mt-1 text-2xl font-extrabold text-gray-900">{value}</div>
      {subtitle ? <div className="mt-1 text-xs text-gray-600">{subtitle}</div> : null}
    </div>
  );
}

function ymNow(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function ymLabel(ym: string) {
  const [y, m] = ym.split("-");
  const mm = parseInt(m, 10);
  const names = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  return `${names[Math.max(0, Math.min(11, mm - 1))]} ${y}`;
}

function clampInt(n: any, fallback = 0): number {
  const x = Number(n);
  return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

function isPlainObject(v: any) {
  return (
    v !== null &&
    typeof v === "object" &&
    (v.constructor === Object || Object.getPrototypeOf(v) === Object.prototype)
  );
}

function stripUndefinedDeep<T>(input: T): T {
  if (Array.isArray(input)) return input.map(stripUndefinedDeep) as any;
  if (!isPlainObject(input)) return input;

  const out: any = {};
  for (const [k, v] of Object.entries(input as any)) {
    if (v === undefined) continue;
    out[k] = stripUndefinedDeep(v as any);
  }
  return out as T;
}

function normalizeTags(input: string): string[] {
  return (input || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizePhoneCL(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "";
  let cleaned = raw.replace(/[^\d+]/g, "");
  if (/^56\d{8,9}$/.test(cleaned)) cleaned = "+" + cleaned;
  if (/^9\d{8}$/.test(cleaned)) cleaned = "+56" + cleaned;
  return cleaned;
}

function isValidRutFormat(rut: string): boolean {
  const r = (rut || "").trim();
  if (!r) return true;
  return /^\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]$/.test(r) || /^\d{7,8}-[\dkK]$/.test(r);
}

function isValidEmail(email: string): boolean {
  const e = (email || "").trim();
  if (!e) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function formatLeadDate(value: any): string {
  if (!value) return "—";
  const date =
    value instanceof Timestamp
      ? value.toDate()
      : value?.toDate?.()
        ? value.toDate()
        : new Date(value);
  if (!date || Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-CL");
}

// --------- Main component ---------
export default function AdminPanel(props: AdminPanelProps) {
  const { activeTab, setActiveTab } = props;

  const [me, setMe] = useState<User | null>(null);

  // Companies list for Admin CRUD
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  // Leads (solicitudes)
  const [leads, setLeads] = useState<LeadDoc[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [leadNotesDrafts, setLeadNotesDrafts] = useState<Record<string, string>>({});
  const [leadActionLoading, setLeadActionLoading] = useState<string | null>(null);
  const [leadEmailLoading, setLeadEmailLoading] = useState<string | null>(null);
  const [leadNotice, setLeadNotice] = useState<string | null>(null);

  // Selected company + stats
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompanyDoc, setSelectedCompanyDoc] = useState<CompanyDoc | null>(null);
  const [selectedCompanyStats, setSelectedCompanyStats] = useState<CompanyStatsDoc | null>(null);
  const [selectedCompanyLoading, setSelectedCompanyLoading] = useState(false);

  // Company billing history (facturas/pagos)
  const [billingPayments, setBillingPayments] = useState<(BillingRecordDoc & { id: string })[]>([]);
  const [billingInvoices, setBillingInvoices] = useState<(BillingRecordDoc & { id: string })[]>([]);
  const [loadingBilling, setLoadingBilling] = useState(false);

  // Billing record modal
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [billingType, setBillingType] = useState<BillingRecordDoc["type"]>("invoice");
  const [billingAmount, setBillingAmount] = useState<string>("");
  const [billingCurrency, setBillingCurrency] = useState<BillingRecordDoc["currency"]>("CLP");
  const [billingIssuedAt, setBillingIssuedAt] = useState<string>("");
  const [billingDueAt, setBillingDueAt] = useState<string>("");
  const [billingPaidAt, setBillingPaidAt] = useState<string>("");
  const [billingReference, setBillingReference] = useState<string>("");
  const [billingNote, setBillingNote] = useState<string>("");
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  // Comms (outbox) modal
  const [commsModalOpen, setCommsModalOpen] = useState(false);

  const BRAND_FROM_EMAIL = "administracion@agroconnecto.cl";
  const [commsFromMode, setCommsFromMode] = useState<"brand" | "me">("brand");
  const [commsTemplate, setCommsTemplate] = useState<CommsOutboxDoc["templateKey"]>("overdue");
  const [commsQuickTemplate, setCommsQuickTemplate] = useState<CommsOutboxDoc["templateKey"]>("overdue");
  const [commsSubject, setCommsSubject] = useState<string>("");
  const [commsText, setCommsText] = useState<string>("");
  const [commsSending, setCommsSending] = useState(false);

  // Search
  const [search, setSearch] = useState("");

  const notify = (type: "success" | "error" | "info", message: string) => {
    setPanelMessage({ type, message });
  };

  // Global stats + monthly
  const [globalStats, setGlobalStats] = useState<GlobalStatsDoc | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStatsDoc[]>([]);
  const [selectedYm, setSelectedYm] = useState<string>(ymNow());

  // FinOps: infra + manual expenses
  const [infra, setInfra] = useState<InfraFinOpsDoc | null>(null);
  const [manualExpenses, setManualExpenses] = useState<(ManualExpenseDoc & { id: string })[]>([]);

  // Manual expense form
  const [expCategory, setExpCategory] = useState<ManualExpenseDoc["category"]>("Marketing");
  const [expVendor, setExpVendor] = useState("");
  const [expAmount, setExpAmount] = useState<string>("");
  const [expCurrency, setExpCurrency] = useState<ManualExpenseDoc["currency"]>("CLP");
  const [expStartMonth, setExpStartMonth] = useState<string>(ymNow());
  const [expRecurrence, setExpRecurrence] = useState<ManualExpenseDoc["recurrence"]>("once");
  const [expMonths, setExpMonths] = useState<string>("1");
  const [expNote, setExpNote] = useState("");

  // Infra form (editable)
  const [infraReads, setInfraReads] = useState<string>("");
  const [infraWrites, setInfraWrites] = useState<string>("");
  const [infraDeletes, setInfraDeletes] = useState<string>("");
  const [infraStorage, setInfraStorage] = useState<string>("");
  const [infraFnInv, setInfraFnInv] = useState<string>("");
  const [infraNotes, setInfraNotes] = useState<string>("");

  // Company create/edit modal (reusa MVP)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [rut, setRut] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [panelMessage, setPanelMessage] = useState<{ type: "success" | "error" | "info"; message: string } | null>(
    null
  );
  const [legalName, setLegalName] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("Maule");

  const [adminEmail, setAdminEmail] = useState("");
  const [plan, setPlan] = useState<SubscriptionPlan>("Basic");
  const [status, setStatus] = useState<CompanyStatus>("active");
  const [isPublic, setIsPublic] = useState(true);
  const [authDebug, setAuthDebug] = useState<AuthDebugPayload | null>(null);
  const [authDebugLoading, setAuthDebugLoading] = useState(false);
  const [authDebugError, setAuthDebugError] = useState<string | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [superadminEmail, setSuperadminEmail] = useState("");
  const [superadminLoading, setSuperadminLoading] = useState(false);
  const [superadminMessage, setSuperadminMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const isDev = import.meta.env.DEV;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setMe(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    let active = true;
    if (!me) {
      setIsSuperadmin(false);
      return () => {
        active = false;
      };
    }

    me.getIdTokenResult()
      .then((token) => {
        if (!active) return;
        const role = String(token?.claims?.role || "").toLowerCase();
        const superadmin = token?.claims?.superadmin === true || role === "superadmin";
        setIsSuperadmin(superadmin);
      })
      .catch(() => {
        if (!active) return;
        setIsSuperadmin(false);
      });

    return () => {
      active = false;
    };
  }, [me]);

  // --------- Firestore subscriptions ---------
  useEffect(() => {
    setLoadingCompanies(true);
    const q = query(collection(db, "companies"), orderBy("createdAt", "desc"), limit(100));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: CompanyRow[] = snap.docs.map((d) => {
          const data = d.data() as CompanyDoc;
          return {
            id: d.id,
            name: data.name || "(sin nombre)",
            subscriptionPlan: (data.subscriptionPlan || "Basic") as SubscriptionPlan,
            status: normalizeCompanyStatus(data.status, "active"),
            contactEmail: data.contactEmail || "",
            adminEmail: data.adminEmail || "",
            rut: data.rut || "",
            industry: data.industry || "",
            region: (data.address?.region as any) || null,
            city: (data.address?.city as any) || null,
          };
        });
        setCompanies(rows);
        setLoadingCompanies(false);
      },
      (err) => {
        console.error("onSnapshot companies error:", err);
        setLoadingCompanies(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    setLeadsLoading(true);
    setLeadsError(null);
    const q = query(collection(db, "company_leads"), orderBy("createdAt", "desc"), limit(100));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: LeadDoc[] = snap.docs.map((d) => {
          const data = d.data() as Omit<LeadDoc, "id">;
          return {
            id: d.id,
            companyName: data.companyName || "(sin nombre)",
            rut: data.rut || "",
            email: data.email || "",
            phone: data.phone || "",
            region: data.region || "",
            status: (data.status || "pending") as LeadStatus,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            notes: data.notes || "",
          };
        });
        setLeads(rows);
        setLeadsLoading(false);
      },
      (err) => {
        console.error("onSnapshot company_leads error:", err);
        setLeadsError("No se pudieron cargar las solicitudes.");
        setLeadsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const ref = doc(db, "stats", "global");
    const unsub = onSnapshot(
      ref,
      (snap) => setGlobalStats((snap.data() as any) || null),
      (err) => console.error("stats/global error:", err)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "stats_monthly"), orderBy("ym", "asc"), limit(36));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as any) })) as MonthlyStatsDoc[];
        setMonthlyStats(list);
        if (!list.find((x) => x.ym === selectedYm) && list.length) {
          setSelectedYm(list[list.length - 1].ym);
        }
      },
      (err) => console.error("stats_monthly error:", err)
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Infra per selected month
    const ref = doc(db, "finops_infra", selectedYm);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const d = snap.exists() ? (snap.data() as any as InfraFinOpsDoc) : null;
        setInfra(d);
        setInfraReads(d?.firestoreReads != null ? String(d.firestoreReads) : "");
        setInfraWrites(d?.firestoreWrites != null ? String(d.firestoreWrites) : "");
        setInfraDeletes(d?.firestoreDeletes != null ? String(d.firestoreDeletes) : "");
        setInfraStorage(d?.storageGB != null ? String(d.storageGB) : "");
        setInfraFnInv(d?.functionsInvocations != null ? String(d.functionsInvocations) : "");
        setInfraNotes(d?.notes || "");
      },
      (err) => console.error("finops_infra error:", err)
    );
    return () => unsub();
  }, [selectedYm]);

  useEffect(() => {
    // Manual expenses (global)
    const q = query(collection(db, "finops_manualExpenses"), orderBy("createdAt", "desc"), limit(100));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setManualExpenses(list as any);
      },
      (err) => console.error("finops_manualExpenses error:", err)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selectedCompanyId) {
      setSelectedCompanyStats(null);
      return;
    }
    const ref = doc(db, "stats_companies", selectedCompanyId);
    const unsub = onSnapshot(
      ref,
      (snap) => setSelectedCompanyStats((snap.data() as any) || null),
      (err) => console.error("stats_companies error:", err)
    );
    return () => unsub();
  }, [selectedCompanyId]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setBillingPayments([]);
      setBillingInvoices([]);
      setLoadingBilling(false);
      return;
    }
    setLoadingBilling(true);
    const paymentsQuery = query(
      collection(db, "companies", selectedCompanyId, "billing_payments"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const invoicesQuery = query(
      collection(db, "companies", selectedCompanyId, "billing_invoices"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsubPayments = onSnapshot(
      paymentsQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any;
        setBillingPayments(list);
        setLoadingBilling(false);
      },
      (err) => {
        console.error("billing payments error:", err);
        setLoadingBilling(false);
      }
    );
    const unsubInvoices = onSnapshot(
      invoicesQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any;
        setBillingInvoices(list);
        setLoadingBilling(false);
      },
      (err) => {
        console.error("billing invoices error:", err);
        setLoadingBilling(false);
      }
    );
    return () => {
      unsubPayments();
      unsubInvoices();
    };
  }, [selectedCompanyId]);

  // --------- Derived data ---------
  const filteredCompanies = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return companies;
    return companies.filter((c) => {
      return (
        c.name.toLowerCase().includes(s) ||
        (c.rut || "").toLowerCase().includes(s) ||
        (c.adminEmail || "").toLowerCase().includes(s) ||
        (c.contactEmail || "").toLowerCase().includes(s) ||
        (c.industry || "").toLowerCase().includes(s) ||
        (c.region || "").toLowerCase().includes(s) ||
        (c.city || "").toLowerCase().includes(s)
      );
    });
  }, [companies, search]);

  const monthDoc = useMemo(() => monthlyStats.find((x) => x.ym === selectedYm) || null, [monthlyStats, selectedYm]);
  const billingRecords = useMemo(() => {
    const combined = [...billingPayments, ...billingInvoices];
    return combined.sort((a: any, b: any) => {
      const aTime = a?.createdAt?.toMillis?.() || 0;
      const bTime = b?.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
  }, [billingPayments, billingInvoices]);

  const effectiveGlobal = useMemo(() => {
    // Fallback: si stats aún no están creadas, estimar con companies list.
    const fallbackCompaniesTotal = companies.length;
    const fallbackActive = companies.filter((c) => (c.status || "active") === "active").length;
    const fallbackOverdue = companies.filter((c) => (c.status || "") === "overdue").length;
    const fallbackSuspended = companies.filter((c) => (c.status || "") === "suspended").length;

    return {
      companiesTotal: clampInt(globalStats?.companiesTotal, fallbackCompaniesTotal),
      companiesActive: clampInt(globalStats?.companiesActive, fallbackActive),
      companiesOverdue: clampInt(globalStats?.companiesOverdue, fallbackOverdue),
      companiesSuspended: clampInt(globalStats?.companiesSuspended, fallbackSuspended),
      jobsTotal: clampInt(globalStats?.jobsTotal, 0),
      jobsActive: clampInt(globalStats?.jobsActive, 0),
      jobsFuture: clampInt(globalStats?.jobsFuture, 0),
      jobsClosed: clampInt(globalStats?.jobsClosed, 0),
      applicationsTotal: clampInt(globalStats?.applicationsTotal, 0),
      matchesTotal: clampInt(globalStats?.matchesTotal, 0),
      matchesConfirmed: clampInt(globalStats?.matchesConfirmed, 0),
      hiresTotal: clampInt(globalStats?.hiresTotal, 0),
      workersTotal: clampInt(globalStats?.workersTotal, 0),
    };
  }, [globalStats, companies]);

  const placementRate = useMemo(() => {
    const apps = effectiveGlobal.applicationsTotal;
    if (!apps) return 0;
    return Math.round((effectiveGlobal.hiresTotal / apps) * 100);
  }, [effectiveGlobal]);

  const monthlyTotals = useMemo(() => {
    const ym = selectedYm;
    const expensesThisMonth = manualExpenses.filter((e) => isExpenseInMonth(e, ym));
    const total = expensesThisMonth.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

    // Projection: suma recurrencias "monthly" que abarcan ym
    // (ya queda incluido por isExpenseInMonth)
    return { total, count: expensesThisMonth.length, list: expensesThisMonth };
  }, [manualExpenses, selectedYm]);

  function isExpenseInMonth(e: any, ym: string): boolean {
    const start = String(e.startMonth || "");
    if (!start) return false;
    if (e.recurrence === "once") return start === ym;
    // monthly
    const months = clampInt(e.months, 1);
    const [sy, sm] = start.split("-").map((x: string) => parseInt(x, 10));
    const [ty, tm] = ym.split("-").map((x) => parseInt(x, 10));
    if (!sy || !sm || !ty || !tm) return false;
    const startIdx = sy * 12 + (sm - 1);
    const targetIdx = ty * 12 + (tm - 1);
    return targetIdx >= startIdx && targetIdx <= startIdx + Math.max(0, months - 1);
  }

  // --------- Company details ---------
  async function loadCompanyDetails(companyId: string) {
    setSelectedCompanyLoading(true);
    try {
      const ref = doc(db, "companies", companyId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setSelectedCompanyDoc(null);
        return;
      }
      setSelectedCompanyDoc(snap.data() as CompanyDoc);
    } catch (e) {
      console.error("getDoc company error:", e);
      setSelectedCompanyDoc(null);
    } finally {
      setSelectedCompanyLoading(false);
    }
  }

  function openCompany(companyId: string) {
    setSelectedCompanyId(companyId);
    loadCompanyDetails(companyId);
  }

  function openBillingModal(type: BillingRecordDoc["type"]) {
    const today = new Date().toISOString().slice(0, 10);
    setBillingType(type);
    setBillingAmount("");
    setBillingCurrency("CLP");
    setBillingIssuedAt(type === "invoice" ? today : "");
    setBillingDueAt("");
    setBillingPaidAt(type === "payment" ? today : "");
    setBillingReference("");
    setBillingNote("");
    setBillingError(null);
    setBillingModalOpen(true);
  }

  function templateDefaults(key: CommsOutboxDoc["templateKey"], company: CompanyDoc) {
    const companyName = company?.name || "tu empresa";
    switch (key) {
      case "overdue":
        return {
          subject: `AgroConnect: regularización de pago – ${companyName}`,
          text:
            `Hola ${companyName},\n\n` +
            `Te escribimos desde AgroConnect porque tu cuenta figura con estado MOROSO. ` +
            `Si ya realizaste el pago, por favor responde con el comprobante para regularizar. ` +
            `Si necesitas coordinación, podemos ayudarte.\n\n` +
            `Equipo AgroConnect`,
        };
      case "suspension":
        return {
          subject: `AgroConnect: aviso de suspensión preventiva – ${companyName}`,
          text:
            `Hola ${companyName},\n\n` +
            `Este es un aviso automático: si la morosidad se mantiene, ` +
            `la cuenta puede quedar suspendida para publicar nuevas ofertas. ` +
            `Regularizando el pago, se reactivará inmediatamente.\n\n` +
            `Equipo AgroConnect`,
        };
      case "low_activity":
        return {
          subject: `AgroConnect: sugerencias para aumentar postulaciones – ${companyName}`,
          text:
            `Hola ${companyName},\n\n` +
            `Notamos baja actividad reciente (pocas publicaciones/postulaciones). ` +
            `Si quieres, te ayudamos a optimizar tu oferta y difusión para mejorar resultados.\n\n` +
            `Equipo AgroConnect`,
        };
      case "holiday":
        return {
          subject: `¡Felices fiestas! – AgroConnect`,
          text:
            `Hola ${companyName},\n\n` +
            `Queremos desearte felices fiestas y un excelente cierre de año. ` +
            `Gracias por ser parte de AgroConnect.\n\n` +
            `Equipo AgroConnect`,
        };
      default:
        return { subject: "AgroConnect", text: "" };
    }
  }

  function openCommsModal(templateKey: CommsOutboxDoc["templateKey"]) {
    if (!selectedCompanyDoc) return;
    setCommsTemplate(templateKey);
    setCommsFromMode("brand");
    const d = templateDefaults(templateKey, selectedCompanyDoc);
    setCommsSubject(d.subject);
    setCommsText(d.text);
    setCommsModalOpen(true);
  }

  async function handleAddBillingRecord() {
    if (!selectedCompanyId) return;
    const amt = Number(billingAmount);
    if (!amt || !isFinite(amt) || amt <= 0) {
      setBillingError("Monto inválido.");
      return;
    }

    setBillingSaving(true);
    try {
      if (billingCurrency !== "CLP") {
        throw new Error("Por ahora la facturación admite únicamente pesos chilenos.");
      }
      const recordBillingEntry = httpsCallable(functions, "recordBillingEntry");
      await recordBillingEntry({
        companyId: selectedCompanyId,
        type: billingType,
        amount: Math.round(amt),
        issuedAt: billingIssuedAt,
        dueAt: billingDueAt || null,
        paidAt: billingPaidAt || null,
        reference: billingReference.trim() || null,
        note: billingNote.trim() || null,
        idempotencyKey:
          globalThis.crypto?.randomUUID?.() ||
          String(Date.now()) + "_" + Math.random().toString(36).slice(2),
      });

      setBillingModalOpen(false);
      notify("success", `Registro de ${billingType === "payment" ? "pago" : "factura"} guardado.`);
    } catch (e: any) {
      console.error(e);
      setBillingError(`No se pudo guardar registro de facturación: ${e?.message || e}`);
    } finally {
      setBillingSaving(false);
    }
  }

  async function handleSendComms() {
    if (!selectedCompanyId || !selectedCompanyDoc) return;
    const to = (selectedCompanyDoc.billingEmail || selectedCompanyDoc.contactEmail || selectedCompanyDoc.adminEmail || "").trim();
    if (!to) {
      notify("error", "La empresa no tiene email de contacto/facturación.");
      return;
    }
    if (!commsSubject.trim() || !commsText.trim()) {
      notify("error", "Asunto y mensaje no pueden ir vacíos.");
      return;
    }

    setCommsSending(true);
    try {
      await addDoc(collection(db, "comms_outbox"),
        stripUndefinedDeep({
          companyId: selectedCompanyId,
          to,
          templateKey: commsTemplate,
          fromEmail: commsFromMode === "me" ? (me?.email || BRAND_FROM_EMAIL) : BRAND_FROM_EMAIL,
          replyTo: me?.email || null,
          subject: commsSubject.trim(),
          text: commsText.trim(),
          status: "queued",
          createdAt: serverTimestamp(),
          createdBy: { uid: me?.uid, email: me?.email || null },
        } satisfies CommsOutboxDoc)
      );
      setCommsModalOpen(false);
      notify("success", "Mensaje encolado (comms_outbox).");
    } catch (e: any) {
      console.error(e);
      notify("error", `No se pudo encolar el mensaje: ${e?.message || e}`);
    } finally {
      setCommsSending(false);
    }
  }

  // --------- Company CRUD ---------
  function resetForm() {
    setName("");
    setRut("");
    setIndustry("");
    setDescription("");
    setWebsite("");
    setBillingEmail("");
    setLegalName("");
    setTagsInput("");
    setContactEmail("");
    setPhone("");
    setAddressLine1("");
    setCity("");
    setRegion("Maule");
    setAdminEmail("");
    setPlan("Basic");
    setStatus("active");
    setIsPublic(true);
  }

  function openCreateModal() {
    setModalMode("create");
    resetForm();
    setModalOpen(true);
  }

  async function openEditModal(companyId: string) {
    setModalMode("edit");
    setSaving(false);

    let data = selectedCompanyId === companyId ? selectedCompanyDoc : null;
    if (!data) {
      try {
        const snap = await getDoc(doc(db, "companies", companyId));
        if (snap.exists()) data = snap.data() as CompanyDoc;
      } catch (e) {
        console.error("prefill getDoc error:", e);
      }
    }
    if (!data) {
      notify("error", "No se pudo cargar la empresa para editar.");
      return;
    }
    setSelectedCompanyId(companyId);
    setSelectedCompanyDoc(data);

    setName(data.name || "");
    setRut(data.rut || "");
    setIndustry(data.industry || "");
    setDescription(data.description || "");
    setWebsite(data.website || "");
    setBillingEmail(data.billingEmail || "");
    setLegalName(data.legalName || "");
    setTagsInput((data.tags || []).join(", "));

    setContactEmail(data.contactEmail || "");
    setPhone(data.phone || "");

    setAddressLine1(data.address?.line1 || "");
    setCity(data.address?.city || "");
    setRegion(data.address?.region || "Maule");

    setAdminEmail(data.adminEmail || "");
    setPlan((data.subscriptionPlan || "Basic") as SubscriptionPlan);
    setStatus(normalizeCompanyStatus(data.status, "active"));
    setIsPublic(Boolean(data.isPublic ?? false));

    setModalOpen(true);
  }

  function validateForm(): string | null {
    if (!name.trim()) return "Falta el nombre.";
    if (rut && !isValidRutFormat(rut)) return "RUT con formato inválido. Ej: 12345678-5";
    if (adminEmail && !isValidEmail(adminEmail)) return "Admin email inválido.";
    if (contactEmail && !isValidEmail(contactEmail)) return "Email contacto inválido.";
    if (billingEmail && !isValidEmail(billingEmail)) return "Email facturación inválido.";
    if (website && !/^https?:\/\/.+/i.test(website.trim()))
      return "Sitio web debe partir con http:// o https://";
    return null;
  }

  async function handleSaveCompany() {
    const msg = validateForm();
    if (msg) {
      notify("error", msg);
      return;
    }

    const normPhone = normalizePhoneCL(phone);
    const tags = normalizeTags(tagsInput);
    const createdBy = { uid: me?.uid, email: me?.email || undefined };

    setSaving(true);
    try {
      if (modalMode === "create") {
        const ref = await addDoc(
          collection(db, "companies"),
          stripUndefinedDeep({
            name: name.trim(),
            rut: rut.trim() || undefined,
            industry: industry.trim() || undefined,
            description: description.trim() || undefined,
            website: website.trim() || undefined,
            billingEmail: billingEmail.trim() || undefined,
            legalName: legalName.trim() || undefined,
            tags,

            contactEmail: contactEmail.trim() || undefined,
            phone: normPhone || undefined,

            address: {
              line1: addressLine1.trim() || undefined,
              city: city.trim() || undefined,
              region: region.trim() || undefined,
              country: "Chile",
            },

            adminEmail: adminEmail.trim(),
            subscriptionPlan: plan,
            status,
            isPublic,

            createdBy,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          } satisfies CompanyDoc)
        );

        setSelectedCompanyId(ref.id);
        await loadCompanyDetails(ref.id);
        setModalOpen(false);
      } else {
        if (!selectedCompanyId) {
          notify("error", "No hay empresa seleccionada para editar.");
          return;
        }
        const ref = doc(db, "companies", selectedCompanyId);
        await updateDoc(
          ref,
          stripUndefinedDeep({
            name: name.trim(),
            rut: rut.trim() || undefined,
            industry: industry.trim() || undefined,
            description: description.trim() || undefined,
            website: website.trim() || undefined,
            billingEmail: billingEmail.trim() || undefined,
            legalName: legalName.trim() || undefined,
            tags,

            contactEmail: contactEmail.trim() || undefined,
            phone: normPhone || undefined,

            address: {
              line1: addressLine1.trim() || undefined,
              city: city.trim() || undefined,
              region: region.trim() || undefined,
              country: "Chile",
            },

            adminEmail: adminEmail.trim(),
            subscriptionPlan: plan,
            status,
            isPublic,

            updatedAt: serverTimestamp(),
          })
        );

        await loadCompanyDetails(selectedCompanyId);
        setModalOpen(false);
      }
    } catch (e: any) {
      console.error("save company error:", e);
      notify("error", `No se pudo guardar empresa: ${e?.message || "error"}`);
    } finally {
      setSaving(false);
    }
  }

  // --------- FinOps actions ---------
  async function saveInfraForMonth() {
    try {
      const payload: InfraFinOpsDoc = stripUndefinedDeep({
        ym: selectedYm,
        firestoreReads: infraReads ? clampInt(infraReads, 0) : undefined,
        firestoreWrites: infraWrites ? clampInt(infraWrites, 0) : undefined,
        firestoreDeletes: infraDeletes ? clampInt(infraDeletes, 0) : undefined,
        storageGB: infraStorage ? Number(infraStorage) : undefined,
        functionsInvocations: infraFnInv ? clampInt(infraFnInv, 0) : undefined,
        notes: infraNotes?.trim() || undefined,
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "finops_infra", selectedYm), payload as any).catch(async () => {
        // If doc doesn't exist, create it via setDoc
        const { setDoc } = await import("firebase/firestore");
        await setDoc(doc(db, "finops_infra", selectedYm), payload as any, { merge: true });
      });

      notify("success", "FinOps (infra) guardado.");
    } catch (e: any) {
      console.error(e);
      notify("error", `No se pudo guardar FinOps infra: ${e?.message || e}`);
    }
  }

  async function addManualExpense() {
    const amt = Number(expAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      notify("error", "Monto inválido.");
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(expStartMonth)) {
      notify("error", "Mes inválido (YYYY-MM).");
      return;
    }
    const months = expRecurrence === "once" ? 1 : Math.max(1, clampInt(expMonths, 1));

    try {
      await addDoc(
        collection(db, "finops_manualExpenses"),
        stripUndefinedDeep({
          category: expCategory,
          vendor: expVendor.trim() || undefined,
          amount: amt,
          currency: expCurrency,
          startMonth: expStartMonth,
          recurrence: expRecurrence,
          months: expRecurrence === "monthly" ? months : undefined,
          note: expNote.trim() || undefined,
          createdAt: serverTimestamp(),
          createdBy: { uid: me?.uid, email: me?.email || undefined },
        } satisfies ManualExpenseDoc)
      );

      setExpVendor("");
      setExpAmount("");
      setExpNote("");
      setExpRecurrence("once");
      setExpMonths("1");
      setExpStartMonth(selectedYm);

      notify("success", "Gasto registrado.");
    } catch (e: any) {
      console.error(e);
      notify("error", `No se pudo registrar gasto: ${e?.message || e}`);
    }
  }

  // --------- Render sections ---------
  function renderExecutiveAndActivity() {
    return (
      <div className="space-y-6">
        {/* Header row */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-gray-500">SUPERADMIN</div>
              <div className="text-2xl font-extrabold text-gray-900">Resumen global</div>
              <div className="text-sm text-gray-600">
                Estado operativo, actividad de plataforma y control de costos. Fuente: Firestore + agregados <Badge>stats/*</Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge>Usuario: {me?.email || "—"}</Badge>
              <Badge>Actualización: {globalStats?.updatedAt ? "ok" : "pendiente stats"}</Badge>
              <select
                className={inputBase + " w-40"}
                value={selectedYm}
                onChange={(e) => setSelectedYm(e.target.value)}
              >
                {/* si no hay monthly stats aún, al menos muestra current */}
                {monthlyStats.length === 0 ? (
                  <option value={selectedYm}>{ymLabel(selectedYm)}</option>
                ) : (
                  monthlyStats
                    .slice()
                    .reverse()
                    .map((m) => (
                      <option key={m.ym} value={m.ym}>
                        {ymLabel(m.ym)}
                      </option>
                    ))
                )}
              </select>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            title="Empresas totales"
            value={effectiveGlobal.companiesTotal}
            subtitle={
              <span className="flex gap-2 flex-wrap">
                <span>Activas: <b>{effectiveGlobal.companiesActive}</b></span>
                <span>Morosas: <b>{effectiveGlobal.companiesOverdue}</b></span>
              </span>
            }
          />
          <KpiCard
            title="Ofertas totales"
            value={effectiveGlobal.jobsTotal}
            subtitle={
              <span className="flex gap-2 flex-wrap">
                <span>Activos: <b>{effectiveGlobal.jobsActive}</b></span>
                <span>Futuros: <b>{effectiveGlobal.jobsFuture}</b></span>
                <span>Cerrados: <b>{effectiveGlobal.jobsClosed}</b></span>
              </span>
            }
          />
          <KpiCard
            title={`Actividad ${ymLabel(selectedYm)}`}
            value={clampInt(monthDoc?.jobsCreated, 0)}
            subtitle={
              <span className="flex gap-2 flex-wrap">
                <span>Postulaciones: <b>{clampInt(monthDoc?.applicationsCreated, 0)}</b></span>
                <span>Contrataciones: <b>{clampInt(monthDoc?.hiresCreated, 0)}</b></span>
                <span>Matches: <b>{clampInt(monthDoc?.matchesConfirmed, 0)}</b></span>
              </span>
            }
          />
          <KpiCard
            title="Eficiencia de colocación"
            value={`${placementRate}%`}
            subtitle={
              <span className="flex gap-2 flex-wrap">
                <span>Contrataciones: <b>{effectiveGlobal.hiresTotal}</b></span>
                <span>Postulaciones: <b>{effectiveGlobal.applicationsTotal}</b></span>
                <span>Interés mutuo: <b>{effectiveGlobal.matchesConfirmed}</b></span>
              </span>
            }
          />
        </div>

        {/* Activity (simple list + trend) */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-gray-900">Actividad en el tiempo</div>
              <Badge>Mensual</Badge>
            </div>
            <div className="mt-3 text-sm text-gray-600">
              Ofertas y postulaciones por mes (desde <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">stats_monthly</code>).
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs uppercase text-gray-500 bg-gray-50">
                  <tr>
                    <th className="p-3">Mes</th>
                    <th className="p-3">Ofertas</th>
                    <th className="p-3">Postulaciones</th>
                    <th className="p-3">Contrataciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(monthlyStats.length ? monthlyStats.slice(-12) : []).reverse().map((m) => (
                    <tr key={m.ym} className={m.ym === selectedYm ? "bg-emerald-50/40" : ""}>
                      <td className="p-3 font-semibold text-gray-900">{ymLabel(m.ym)}</td>
                      <td className="p-3">{clampInt(m.jobsCreated, 0)}</td>
                      <td className="p-3">{clampInt(m.applicationsCreated, 0)}</td>
                      <td className="p-3">{clampInt(m.hiresCreated, 0)}</td>
                    </tr>
                  ))}
                  {monthlyStats.length === 0 && (
                    <tr>
                      <td className="p-3 text-sm text-gray-600" colSpan={4}>
                        Aún no hay stats mensuales. Cuando despliegues las Functions de agregación, se poblará automáticamente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="text-lg font-semibold text-gray-900">Top empresas (actividad)</div>
            <div className="mt-2 text-sm text-gray-600">
              Ranking básico usando <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">stats_companies</code>.
            </div>

            <TopCompaniesList companies={companies} />
          </div>
        </div>

        {/* FinOps block */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-gray-900">Costos de operación</div>
              <div className="text-sm text-gray-600">
                Costos automáticos (estimados) + costos manuales (operacionales). Preparado para integrar Google Cloud Billing.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge>Mes: {ymLabel(selectedYm)}</Badge>
              <Badge>Gastos manuales: {monthlyTotals.count}</Badge>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Infra */}
            <div className="rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-900">Infra (estimado / editable)</div>
                <button
                  onClick={saveInfraForMonth}
                  className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-black"
                >
                  Guardar
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className={labelBase}>Firestore Reads</div>
                  <input className={inputBase} value={infraReads} onChange={(e) => setInfraReads(e.target.value)} placeholder="ej: 120000" />
                </div>
                <div>
                  <div className={labelBase}>Firestore Writes</div>
                  <input className={inputBase} value={infraWrites} onChange={(e) => setInfraWrites(e.target.value)} placeholder="ej: 25000" />
                </div>
                <div>
                  <div className={labelBase}>Firestore Deletes</div>
                  <input className={inputBase} value={infraDeletes} onChange={(e) => setInfraDeletes(e.target.value)} placeholder="ej: 1200" />
                </div>
                <div>
                  <div className={labelBase}>Storage (GB)</div>
                  <input className={inputBase} value={infraStorage} onChange={(e) => setInfraStorage(e.target.value)} placeholder="ej: 8.5" />
                </div>
                <div>
                  <div className={labelBase}>Functions Invocations</div>
                  <input className={inputBase} value={infraFnInv} onChange={(e) => setInfraFnInv(e.target.value)} placeholder="ej: 9000" />
                </div>
                <div>
                  <div className={labelBase}>Notas</div>
                  <input className={inputBase} value={infraNotes} onChange={(e) => setInfraNotes(e.target.value)} placeholder="ej: cambio de plan / pruebas" />
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-500">
                Este bloque es editable para MVP. Luego podemos reemplazar/llenar automáticamente desde Billing export.
              </div>
            </div>

            {/* Manual expenses */}
            <div className="rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-900">Gastos manuales</div>
                <Badge>Total mes: {formatMoney(monthlyTotals.total, expCurrency)}</Badge>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className={labelBase}>Categoría</div>
                  <select className={inputBase} value={expCategory} onChange={(e) => setExpCategory(e.target.value as any)}>
                    <option value="Personal">Personal</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Servicios">Servicios</option>
                    <option value="Licencias">Licencias / Software</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
                <div>
                  <div className={labelBase}>Proveedor / detalle</div>
                  <input className={inputBase} value={expVendor} onChange={(e) => setExpVendor(e.target.value)} placeholder="ej: Meta Ads" />
                </div>
                <div>
                  <div className={labelBase}>Monto</div>
                  <input className={inputBase} value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="ej: 150000" />
                </div>
                <div>
                  <div className={labelBase}>Moneda</div>
                  <select className={inputBase} value={expCurrency} onChange={(e) => setExpCurrency(e.target.value as any)}>
                    <option value="CLP">CLP</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div>
                  <div className={labelBase}>Mes inicio (YYYY-MM)</div>
                  <input className={inputBase} value={expStartMonth} onChange={(e) => setExpStartMonth(e.target.value)} placeholder="2026-01" />
                </div>
                <div>
                  <div className={labelBase}>Recurrencia</div>
                  <select className={inputBase} value={expRecurrence} onChange={(e) => setExpRecurrence(e.target.value as any)}>
                    <option value="once">Una vez</option>
                    <option value="monthly">Mensual (por N meses)</option>
                  </select>
                </div>
                {expRecurrence === "monthly" && (
                  <div className="md:col-span-2">
                    <div className={labelBase}>Cantidad de meses</div>
                    <input className={inputBase} value={expMonths} onChange={(e) => setExpMonths(e.target.value)} placeholder="ej: 6" />
                    <div className={helpBase}>
                      Si defines 6 meses desde {expStartMonth}, se proyecta automáticamente en el dashboard.
                    </div>
                  </div>
                )}
                <div className="md:col-span-2">
                  <div className={labelBase}>Nota</div>
                  <input className={inputBase} value={expNote} onChange={(e) => setExpNote(e.target.value)} placeholder="ej: campaña verano / contratación" />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  onClick={addManualExpense}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Registrar gasto
                </button>
              </div>

              <div className="mt-4">
                <div className="text-sm font-semibold text-gray-900">Detalle del mes</div>
                <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-gray-200">
                  <table className="w-full text-left">
                    <thead className="text-xs uppercase text-gray-500 bg-gray-50">
                      <tr>
                        <th className="p-2">Categoría</th>
                        <th className="p-2">Detalle</th>
                        <th className="p-2">Tipo</th>
                        <th className="p-2 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {monthlyTotals.list.map((e: any) => (
                        <tr key={e.id}>
                          <td className="p-2 text-sm">{e.category}</td>
                          <td className="p-2 text-sm text-gray-600">{e.vendor || e.note || "—"}</td>
                          <td className="p-2 text-xs">
                            {e.recurrence === "once" ? (
                              <Badge>1 vez</Badge>
                            ) : (
                              <Badge>{clampInt(e.months, 1)} meses</Badge>
                            )}
                          </td>
                          <td className="p-2 text-sm font-semibold text-right">
                            {formatMoney(Number(e.amount) || 0, e.currency || "CLP")}
                          </td>
                        </tr>
                      ))}
                      {monthlyTotals.list.length === 0 && (
                        <tr>
                          <td className="p-3 text-sm text-gray-600" colSpan={4}>
                            No hay gastos manuales registrados para este mes.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-2 text-xs text-gray-500">
                  Nota: los gastos mensuales se incluyen automáticamente en cada mes dentro del rango definido.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ops quick links */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="text-lg font-semibold text-gray-900">Acciones rápidas</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab("COMPANIES")}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Gestionar empresas
            </button>
            <button
              onClick={() => setActiveTab("REQUESTS")}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Revisar solicitudes (leads)
            </button>
            <button
              onClick={() => setActiveTab("SETTINGS")}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Configuración
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderCompanies() {
    return (
      <div className="space-y-4">
        {/* List */}
<div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <input
                className={inputBase + " md:w-96"}
                placeholder="Buscar: empresa, RUT, email, rubro, región…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {loadingCompanies ? <Badge>Cargando…</Badge> : <Badge>{filteredCompanies.length} empresas</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                + Nueva Empresa
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {filteredCompanies.map((c) => (
              <button
                key={c.id}
                onClick={() => openCompany(c.id)}
                className={
                  "w-full text-left p-4 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3 " +
                  (selectedCompanyId === c.id ? "bg-emerald-50/30" : "")
                }
              >
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{c.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge>{c.subscriptionPlan || "Basic"}</Badge>
                    <StatusBadge status={c.status || "active"} />
                    {c.region ? <Badge>{c.region}</Badge> : null}
                    {c.industry ? <span className="text-xs text-gray-600 truncate">{c.industry}</span> : null}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 truncate">
                    {c.adminEmail ? `Admin: ${c.adminEmail} · ` : ""}
                    {c.contactEmail ? `Contacto: ${c.contactEmail}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-400">Ver</span>
                  <span className="text-gray-400">›</span>
                </div>
              </button>
            ))}
            {!loadingCompanies && filteredCompanies.length === 0 && (
              <div className="p-6 text-sm text-gray-600">No hay empresas que coincidan con tu búsqueda.</div>
            )}
          </div>
        </div>

        

        {/* Drawer (detalle empresa) */}
        {selectedCompanyId ? (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedCompanyId(null)} />
            <div className="absolute right-0 top-0 h-full w-full sm:w-[90%] lg:w-[70%] xl:w-[60%] bg-white shadow-2xl border-l border-gray-200 overflow-y-auto">
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-gray-500">Detalle empresa</div>
                  <div className="text-lg font-extrabold text-gray-900">
                    {selectedCompanyDoc?.name || "Empresa"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => selectedCompanyId && openEditModal(selectedCompanyId)}
                    disabled={!selectedCompanyId || !selectedCompanyDoc}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setSelectedCompanyId(null)}
                    className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
<div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-2">
            <div className="font-semibold text-gray-900">Detalle empresa</div>
            <div className="flex items-center gap-2">
              <button
                disabled={!selectedCompanyId || !selectedCompanyDoc}
                onClick={() => selectedCompanyId && openEditModal(selectedCompanyId)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                Editar
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {!selectedCompanyId ? (
              <div className="text-sm text-gray-600">Selecciona una empresa para ver sus datos.</div>
            ) : selectedCompanyLoading ? (
              <div className="text-sm text-gray-600">Cargando…</div>
            ) : !selectedCompanyDoc ? (
              <div className="text-sm text-gray-600">No se encontró el documento en Firestore.</div>
            ) : (
              <>
                <div className="space-y-1">
                  <div className="text-lg font-extrabold text-gray-900">{selectedCompanyDoc.name}</div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{selectedCompanyDoc.subscriptionPlan || "Basic"}</Badge>
                    <StatusBadge status={selectedCompanyDoc.status || "active"} />
                    {selectedCompanyDoc.rut ? <Badge>{selectedCompanyDoc.rut}</Badge> : null}
                    {selectedCompanyDoc.address?.region ? <Badge>{selectedCompanyDoc.address.region}</Badge> : null}
                  </div>
                  {selectedCompanyDoc.industry ? (
                    <div className="text-xs text-gray-600">{selectedCompanyDoc.industry}</div>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <KpiCard title="Jobs totales" value={clampInt(selectedCompanyStats?.jobsTotal, 0)} />
                  <KpiCard title="Postulaciones" value={clampInt(selectedCompanyStats?.applicationsTotal, 0)} />
                  <KpiCard title="Activos" value={clampInt(selectedCompanyStats?.jobsActive, 0)} />
                  <KpiCard title="Contrataciones" value={clampInt(selectedCompanyStats?.hiresTotal, 0)} />
                </div>

                <div className="grid grid-cols-1 gap-3 pt-2 border-t border-gray-100">
                  <div>
                    <div className={labelBase}>Admin email</div>
                    <div className="text-sm text-gray-800 break-all">{selectedCompanyDoc.adminEmail || "—"}</div>
                  </div>
                  <div>
                    <div className={labelBase}>Email contacto</div>
                    <div className="text-sm text-gray-800 break-all">{selectedCompanyDoc.contactEmail || "—"}</div>
                  </div>
                  <div>
                    <div className={labelBase}>Ubicación</div>
                    <div className="text-sm text-gray-800">
                      {[selectedCompanyDoc.address?.city, selectedCompanyDoc.address?.region].filter(Boolean).join(", ") || "—"}
                    </div>
                  </div>
                  <div>
                    <div className={labelBase}>Directorio público</div>
                    <div className="text-sm text-gray-800">
                      {selectedCompanyDoc.isPublic ? "Sí" : "No"}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        try {
                          if (!selectedCompanyId) return;
                          await updateDoc(doc(db, "companies", selectedCompanyId), {
                            status: "overdue",
                            updatedAt: serverTimestamp(),
                          } as any);
                          notify("success", "Empresa marcada como morosa.");
                        } catch (e: any) {
                          console.error(e);
                          notify("error", `No se pudo actualizar estado: ${e?.message || e}`);
                        }
                      }}
                      className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    >
                      Marcar morosa
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          if (!selectedCompanyId) return;
                          await updateDoc(doc(db, "companies", selectedCompanyId), {
                            status: "active",
                            updatedAt: serverTimestamp(),
                          } as any);
                          notify("success", "Empresa marcada al día.");
                        } catch (e: any) {
                          console.error(e);
                          notify("error", `No se pudo actualizar estado: ${e?.message || e}`);
                        }
                      }}
                      className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Marcar al día
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openBillingModal("invoice")}
                      className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                      + Factura
                    </button>
                    <button
                      onClick={() => openBillingModal("payment")}
                      className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    >
                      + Pago
                    </button>
                    

</div>
                </div>

                
                {/* Comunicaciones */}
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-gray-900">Comunicaciones</div>
                    <div className="text-xs text-gray-500">Plantillas + envío</div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={commsQuickTemplate}
                      onChange={(e) => setCommsQuickTemplate(e.target.value as any)}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                      title="Plantilla"
                    >
                      <option value="overdue">Morosidad</option>
                      <option value="suspension">Aviso suspensión</option>
                      <option value="low_activity">Baja actividad</option>
                      <option value="holiday">Felices fiestas</option>
                      <option value="custom">Personalizado</option>
                    </select>

                    <button
                      onClick={() => openCommsModal(commsQuickTemplate)}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                      title="Enviar comunicación"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Mail size={16} />
                        Enviar comunicación
                      </span>
                    </button>
                  </div>
                </div>
{/* Billing history */}
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-gray-900">Historial de pagos / facturas</div>
                    <Badge>{loadingBilling ? "Cargando…" : `Registros: ${billingRecords.length}`}</Badge>
                  </div>
                  <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden bg-white">
                    <table className="w-full text-left">
                      <thead className="text-[11px] uppercase text-gray-500 bg-gray-50">
                        <tr>
                          <th className="p-3">Tipo</th>
                          <th className="p-3">Monto</th>
                          <th className="p-3">Estado</th>
                          <th className="p-3">Fechas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {billingRecords.map((r) => (
                          <tr key={r.id} className="text-sm">
                            <td className="p-3 font-semibold text-gray-900">
                              {r.type === "invoice" ? "Factura" : "Pago"}
                              {r.reference ? <span className="ml-2 text-xs text-gray-500">#{r.reference}</span> : null}
                            </td>
                            <td className="p-3 text-gray-800">
                              {formatMoney(r.amount, r.currency)}
                            </td>
                            <td className="p-3">
                              {r.status === "paid" ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700">
                                  <TrendingUp size={14} /> Pagado
                                </span>
                              ) : r.status === "overdue" ? (
                                <span className="inline-flex items-center gap-1 text-red-700">
                                  <AlertTriangle size={14} /> Vencido
                                </span>
                              ) : (
                                <span className="text-gray-600">Pendiente</span>
                              )}
                            </td>
                            <td className="p-3 text-xs text-gray-600">
                              {r.issuedAt ? `Emisión: ${r.issuedAt}` : ""}
                              {r.dueAt ? ` · Vence: ${r.dueAt}` : ""}
                              {r.paidAt ? ` · Pagado: ${r.paidAt}` : ""}
                            </td>
                          </tr>
                        ))}
                        {!loadingBilling && billingRecords.length === 0 && (
                          <tr>
                            <td className="p-6 text-sm text-gray-600" colSpan={4}>
                              Sin historial aún. Usa <b>+ Factura</b> o <b>+ Pago</b> para comenzar.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Idea: con este historial podrás ver si una empresa es constante o recurrentemente morosa (tendencia de cumplimiento).
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  Nota: si <code className="bg-gray-100 px-1 rounded">stats_companies</code> no existe aún, los KPIs aparecen en 0 hasta que se desplieguen las Functions de agregación.
                </div>
              </>
            )}
          </div>
        </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const handleLeadStatus = async (leadId: string, status: LeadStatus) => {
    setLeadNotice(null);
    setLeadActionLoading(leadId);
    try {
      await updateDoc(doc(db, "company_leads", leadId), {
        status,
        updatedAt: serverTimestamp(),
      });
      setLeadNotice(`Lead actualizado a ${status}.`);
    } catch (e) {
      console.error("update lead status error:", e);
      setLeadNotice("No se pudo actualizar el estado.");
    } finally {
      setLeadActionLoading(null);
    }
  };

  const handleLeadNotesSave = async (leadId: string) => {
    const notes = (leadNotesDrafts[leadId] ?? "").trim();
    setLeadNotice(null);
    setLeadActionLoading(leadId);
    try {
      await updateDoc(doc(db, "company_leads", leadId), {
        notes,
        updatedAt: serverTimestamp(),
      });
      setLeadNotice("Notas guardadas.");
    } catch (e) {
      console.error("update lead notes error:", e);
      setLeadNotice("No se pudieron guardar las notas.");
    } finally {
      setLeadActionLoading(null);
    }
  };

  const handleApproveLead = async (lead: LeadDoc) => {
    setLeadNotice(null);
    setLeadActionLoading(lead.id);
    try {
      const companyRef = doc(collection(db, "companies"));
      const payload = stripUndefinedDeep({
        name: lead.companyName,
        rut: lead.rut || null,
        contactEmail: lead.email || null,
        adminEmail: lead.email || null,
        phone: lead.phone || null,
        region: lead.region || null,
        subscriptionPlan: "Basic",
        status: "active",
        isPublic: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: {
          uid: me?.uid || null,
          email: me?.email || null,
        },
      });
      await setDoc(companyRef, payload, { merge: true });
      await updateDoc(doc(db, "company_leads", lead.id), {
        status: "approved",
        updatedAt: serverTimestamp(),
      });
      setLeadNotice("Lead aprobado y empresa creada.");
    } catch (e) {
      console.error("approve lead error:", e);
      setLeadNotice("No se pudo aprobar la solicitud.");
    } finally {
      setLeadActionLoading(null);
    }
  };

  const handleSendLeadEmail = async (leadId: string, templateKey: "contact" | "approved" | "rejected") => {
    setLeadNotice(null);
    setLeadEmailLoading(`${leadId}:${templateKey}`);
    try {
      const fn = httpsCallable(functions, "sendLeadEmail");
      await fn({ leadId, templateKey });
      setLeadNotice("Correo encolado correctamente.");
    } catch (e: any) {
      console.error("send lead email error:", e);
      setLeadNotice("No se pudo enviar el correo.");
    } finally {
      setLeadEmailLoading(null);
    }
  };

  function renderRequests() {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="text-lg font-semibold text-gray-900">Solicitudes / Leads</div>
        <div className="mt-2 text-sm text-gray-600">
          Listado en tiempo real desde <Badge>company_leads</Badge> en Firestore.
        </div>

        <div className="mt-4">
          <Badge>Total: {leads.length}</Badge>
          {leadNotice && <div className="mt-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 p-3 rounded-xl">{leadNotice}</div>}
          {leadsError && <div className="mt-3 text-sm text-amber-900 bg-amber-50 border border-amber-200 p-3 rounded-xl">{leadsError}</div>}
          {leadsLoading && <div className="mt-3 text-sm text-gray-500 bg-gray-50 border border-gray-100 p-3 rounded-xl">Cargando solicitudes...</div>}
          {!leadsLoading && leads.length === 0 && (
            <div className="mt-3 text-sm text-gray-600 bg-gray-50 border border-gray-100 p-3 rounded-xl">
              Sin solicitudes registradas aún.
            </div>
          )}
          {!leadsLoading && leads.length > 0 && (
            <div className="mt-3 max-h-[60vh] overflow-auto rounded-xl border border-gray-200">
              <table className="w-full text-left">
                <thead className="text-xs uppercase text-gray-500 bg-gray-50">
                  <tr>
                    <th className="p-3">Empresa</th>
                    <th className="p-3">Contacto</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="align-top">
                      <td className="p-3 font-semibold text-gray-900">
                        {lead.companyName || "—"}
                        <div className="text-xs text-gray-500 mt-1">RUT: {lead.rut || "—"}</div>
                        {lead.region ? <div className="text-xs text-gray-500">Región: {lead.region}</div> : null}
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        {lead.email || "—"}
                        {lead.phone ? <div className="text-xs text-gray-500 mt-1">{lead.phone}</div> : null}
                      </td>
                      <td className="p-3 text-sm capitalize">{lead.status || "pending"}</td>
                      <td className="p-3 text-xs text-gray-600">{formatLeadDate(lead.createdAt)}</td>
                      <td className="p-3 text-sm">
                        <div className="flex flex-col gap-2 min-w-[220px]">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => handleLeadStatus(lead.id, "contacted")}
                              disabled={leadActionLoading === lead.id}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-60"
                            >
                              Contactar
                            </button>
                            <button
                              onClick={() => handleApproveLead(lead)}
                              disabled={leadActionLoading === lead.id}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-60"
                            >
                              Aprobar
                            </button>
                            <button
                              onClick={() => handleLeadStatus(lead.id, "rejected")}
                              disabled={leadActionLoading === lead.id}
                              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-60"
                            >
                              Rechazar
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => handleSendLeadEmail(lead.id, "contact")}
                              disabled={leadEmailLoading === `${lead.id}:contact`}
                              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-60"
                            >
                              Enviar contacto
                            </button>
                            <button
                              onClick={() => handleSendLeadEmail(lead.id, "approved")}
                              disabled={leadEmailLoading === `${lead.id}:approved`}
                              className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-bold hover:bg-slate-600 disabled:opacity-60"
                            >
                              Enviar aprobación
                            </button>
                            <button
                              onClick={() => handleSendLeadEmail(lead.id, "rejected")}
                              disabled={leadEmailLoading === `${lead.id}:rejected`}
                              className="px-3 py-1.5 rounded-lg bg-slate-600 text-white text-xs font-bold hover:bg-slate-500 disabled:opacity-60"
                            >
                              Enviar rechazo
                            </button>
                          </div>
                          <div>
                            <textarea
                              value={leadNotesDrafts[lead.id] ?? lead.notes ?? ""}
                              onChange={(e) =>
                                setLeadNotesDrafts((prev) => ({
                                  ...prev,
                                  [lead.id]: e.target.value,
                                }))
                              }
                              placeholder="Notas internas..."
                              className="w-full text-xs border border-gray-200 rounded-lg p-2 min-h-[70px]"
                            />
                            <button
                              onClick={() => handleLeadNotesSave(lead.id)}
                              disabled={leadActionLoading === lead.id}
                              className="mt-2 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 disabled:opacity-60"
                            >
                              Guardar notas
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderSettings() {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
        <div>
          <div className="text-lg font-semibold text-gray-900">Configuración</div>
          <div className="mt-2 text-sm text-gray-600">
            Ajustes operativos del SuperAdmin. En MVP, estos viven en estado local.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-gray-200 p-4">
            <div className="font-semibold text-gray-900">Modo Demo</div>
            <div className="mt-2 text-sm text-gray-600">
              Esto afecta datasets mock del UI (no Firestore).
            </div>
            <button
              onClick={() => props.onToggleDemo(!props.isDemoMode)}
              className={
                "mt-3 w-full rounded-xl px-4 py-2 text-sm font-semibold " +
                (props.isDemoMode
                  ? "bg-gray-900 text-white hover:bg-black"
                  : "bg-gray-100 text-gray-800 hover:bg-gray-200")
              }
            >
              {props.isDemoMode ? "Demo ACTIVO" : "Demo INACTIVO"}
            </button>
          </div>

          <div className="rounded-2xl border border-gray-200 p-4 md:col-span-2">
            <div className="font-semibold text-gray-900">Contactos operativos</div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className={labelBase}>WhatsApp</div>
                <input
                  className={inputBase}
                  value={props.adminConfig?.whatsappNumber || ""}
                  onChange={(e) =>
                    props.setAdminConfig((prev: any) => ({ ...(prev || {}), whatsappNumber: e.target.value }))
                  }
                />
              </div>
              <div>
                <div className={labelBase}>Email notificaciones</div>
                <input
                  className={inputBase}
                  value={props.adminConfig?.notificationEmail || ""}
                  onChange={(e) =>
                    props.setAdminConfig((prev: any) => ({ ...(prev || {}), notificationEmail: e.target.value }))
                  }
                />
              </div>
              <div className="md:col-span-2">
                <div className={labelBase}>Soporte</div>
                <input
                  className={inputBase}
                  value={props.adminConfig?.supportTeam || ""}
                  onChange={(e) =>
                    props.setAdminConfig((prev: any) => ({ ...(prev || {}), supportTeam: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Si quieres persistir esto en Firestore (y versionarlo), lo dejamos en <code className="bg-gray-100 px-1 rounded">admin/config</code>.
            </div>
          </div>
        </div>

        {isSuperadmin ? (
          <div className="rounded-2xl border border-gray-200 p-4 space-y-3">
            <div>
              <div className="font-semibold text-gray-900">Gestionar Superadmins</div>
              <div className="text-xs text-gray-600">Agrega o quita permisos por email.</div>
            </div>
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <input
                className={inputBase}
                value={superadminEmail}
                onChange={(e) => setSuperadminEmail(e.target.value)}
                placeholder="superadmin@agroconnect.cl"
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const email = superadminEmail.trim().toLowerCase();
                    if (!email) {
                      setSuperadminMessage({ type: "error", text: "Ingresa un email válido." });
                      return;
                    }
                    setSuperadminLoading(true);
                    setSuperadminMessage(null);
                    try {
                      await setSuperadminByEmail(email, true);
                      setSuperadminMessage({ type: "success", text: "Superadmin agregado correctamente." });
                    } catch (error: any) {
                      setSuperadminMessage({
                        type: "error",
                        text: error?.message || "No se pudo agregar el superadmin.",
                      });
                    } finally {
                      setSuperadminLoading(false);
                    }
                  }}
                  disabled={superadminLoading}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-70"
                >
                  Agregar
                </button>
                <button
                  onClick={async () => {
                    const email = superadminEmail.trim().toLowerCase();
                    if (!email) {
                      setSuperadminMessage({ type: "error", text: "Ingresa un email válido." });
                      return;
                    }
                    setSuperadminLoading(true);
                    setSuperadminMessage(null);
                    try {
                      await setSuperadminByEmail(email, false);
                      setSuperadminMessage({ type: "success", text: "Superadmin removido correctamente." });
                    } catch (error: any) {
                      setSuperadminMessage({
                        type: "error",
                        text: error?.message || "No se pudo remover el superadmin.",
                      });
                    } finally {
                      setSuperadminLoading(false);
                    }
                  }}
                  disabled={superadminLoading}
                  className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-black disabled:opacity-70"
                >
                  Quitar
                </button>
              </div>
            </div>
            {superadminMessage ? (
              <div
                className={
                  "text-xs rounded-xl px-3 py-2 " +
                  (superadminMessage.type === "success"
                    ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                    : "text-rose-700 bg-rose-50 border border-rose-200")
                }
              >
                {superadminMessage.text}
              </div>
            ) : null}
          </div>
        ) : null}

        {isDev && isSuperadmin ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div>
              <div className="font-semibold text-gray-900">Auth Debug</div>
              <div className="text-xs text-gray-600">
                Disponible solo en desarrollo para superadmin.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={async () => {
                  setAuthDebugLoading(true);
                  setAuthDebugError(null);
                  try {
                    const payload = await debugAuthClaims();
                    if (!payload) {
                      setAuthDebug(null);
                      setAuthDebugError("No hay usuario autenticado o modo producción.");
                      return;
                    }
                    setAuthDebug(payload);
                  } catch (error) {
                    setAuthDebugError("No se pudieron cargar los claims.");
                  } finally {
                    setAuthDebugLoading(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-black disabled:opacity-70"
                disabled={authDebugLoading}
              >
                {authDebugLoading ? "Cargando..." : "Refrescar claims"}
              </button>
              {authDebugError ? <span className="text-xs text-rose-600">{authDebugError}</span> : null}
            </div>
            {authDebug ? (
              <pre className="whitespace-pre-wrap text-xs text-gray-800 bg-white border border-amber-200 rounded-xl p-3 overflow-x-auto">
                {JSON.stringify(authDebug, null, 2)}
              </pre>
            ) : (
              <div className="text-xs text-gray-500">Sin datos aún.</div>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  // --------- Layout with tabs ---------
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white font-sans">
      {/* Header */}
      <header className="border-b border-emerald-100/60 bg-white/70 backdrop-blur">
        <div className="h-1 w-full bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-500" />
        <div className="mx-auto max-w-7xl px-4 py-5 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-sm">
              <Leaf className="text-white" size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-xl md:text-2xl font-black tracking-tight text-gray-900">
                  Agro<span className="text-emerald-700">Connect</span>
                </div>
                <span className="hidden sm:inline-flex text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                  SUPERADMIN
                </span>
                {props.isDemoMode && (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    DEMO
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600">
                Administración global · seguridad · empresas · costos
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {props.onBack ? (
              <button
                onClick={props.onBack}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Volver
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {panelMessage && (
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              panelMessage.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : panelMessage.type === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {panelMessage.message}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-emerald-100 bg-white/90 p-1 shadow-sm" aria-label="Secciones de SuperAdmin">
          <button
            onClick={() => setActiveTab("OVERVIEW")}
            className={
              "px-4 py-2 rounded-xl text-sm font-semibold transition " +
              (activeTab === "OVERVIEW" ? "bg-emerald-600 text-white shadow" : "text-gray-700 hover:bg-emerald-50")
            }
          >
            Resumen
          </button>
          <button
            onClick={() => setActiveTab("COMPANIES")}
            className={
              "px-4 py-2 rounded-xl text-sm font-semibold transition " +
              (activeTab === "COMPANIES" ? "bg-emerald-600 text-white shadow" : "text-gray-700 hover:bg-emerald-50")
            }
          >
            Empresas
          </button>
          <button
            onClick={() => setActiveTab("REQUESTS")}
            className={
              "px-4 py-2 rounded-xl text-sm font-semibold transition " +
              (activeTab === "REQUESTS" ? "bg-emerald-600 text-white shadow" : "text-gray-700 hover:bg-emerald-50")
            }
          >
            Solicitudes
          </button>
          <button
            onClick={() => setActiveTab("TRUST")}
            className={
              "px-4 py-2 rounded-xl text-sm font-semibold transition " +
              (activeTab === "TRUST" ? "bg-emerald-600 text-white shadow" : "text-gray-700 hover:bg-emerald-50")
            }
          >
            Seguridad y confianza
          </button>
          <button
            onClick={() => setActiveTab("SETTINGS")}
            className={
              "px-4 py-2 rounded-xl text-sm font-semibold transition " +
              (activeTab === "SETTINGS" ? "bg-emerald-600 text-white shadow" : "text-gray-700 hover:bg-emerald-50")
            }
          >
            Configuración
          </button>
        </div>

        <div className="mt-4">
          {activeTab === "OVERVIEW" && renderExecutiveAndActivity()}
          {activeTab === "COMPANIES" && renderCompanies()}
          {activeTab === "REQUESTS" && renderRequests()}
          {activeTab === "TRUST" && <TrustOperationsPanel />}
          {activeTab === "SETTINGS" && renderSettings()}
        </div>
      </div>

      {/* Modal (Create/Edit Company) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full md:w-[70vw] max-w-5xl rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="font-semibold text-gray-900">
                {modalMode === "create" ? "Crear nueva empresa" : "Editar empresa"}
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <div className={labelBase}>NOMBRE</div>
                  <input
                    className={inputBase}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Agrícola Los Andes"
                  />
                </div>

                <div>
                  <div className={labelBase}>RUT (FACTURACIÓN)</div>
                  <input
                    className={inputBase}
                    value={rut}
                    onChange={(e) => setRut(e.target.value)}
                    placeholder="Ej: 12.345.678-5"
                  />
                  <div className={helpBase}>Se valida formato (no DV).</div>
                </div>

                <div>
                  <div className={labelBase}>RUBRO</div>
                  <input
                    className={inputBase}
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="Ej: Frutícola / Packing"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className={labelBase}>DESCRIPCIÓN BREVE</div>
                  <textarea
                    className={inputBase}
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ej: Empresa dedicada a cosecha y packing en la Región del Maule."
                  />
                </div>

                <div>
                  <div className={labelBase}>RAZÓN SOCIAL (OPCIONAL)</div>
                  <input
                    className={inputBase}
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Ej: Agrícola Los Andes SpA"
                  />
                </div>

                <div>
                  <div className={labelBase}>SITIO WEB (OPCIONAL)</div>
                  <input
                    className={inputBase}
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="Ej: https://empresa.cl"
                  />
                </div>

                <div>
                  <div className={labelBase}>EMAIL FACTURACIÓN (OPCIONAL)</div>
                  <input
                    className={inputBase}
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    placeholder="Si vacío, usa email contacto"
                  />
                </div>

                <div>
                  <div className={labelBase}>TAGS (OPCIONAL)</div>
                  <input
                    className={inputBase}
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="Ej: packing, cosecha"
                  />
                </div>

                <div>
                  <div className={labelBase}>EMAIL CONTACTO</div>
                  <input
                    className={inputBase}
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="contacto@empresa.cl"
                  />
                </div>

                <div>
                  <div className={labelBase}>TELÉFONO</div>
                  <input
                    className={inputBase}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+56912345678"
                  />
                  <div className={helpBase}>Se normaliza a +56 cuando aplica.</div>
                </div>

                <div className="md:col-span-2">
                  <div className={labelBase}>DIRECCIÓN</div>
                  <input
                    className={inputBase}
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    placeholder="Ej: Camino a Pencahue km 3, Parcela 12"
                  />
                </div>

                <div>
                  <div className={labelBase}>CIUDAD/COMUNA</div>
                  <input
                    className={inputBase}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ej: Talca"
                  />
                </div>

                <div>
                  <div className={labelBase}>REGIÓN</div>
                  <input
                    className={inputBase}
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="Ej: Maule"
                  />
                </div>

                <div>
                  <div className={labelBase}>ADMIN EMAIL (EMPRESA)</div>
                  <input
                    className={inputBase}
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@empresa.cl"
                  />
                </div>

                <div>
                  <div className={labelBase}>PLAN</div>
                  <select className={inputBase} value={plan} onChange={(e) => setPlan(e.target.value as SubscriptionPlan)}>
                    <option value="Basic">Basic</option>
                    <option value="Pro">Pro</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>

                <div>
                  <div className={labelBase}>ESTADO</div>
                  <select className={inputBase} value={status} onChange={(e) => setStatus(normalizeCompanyStatus(e.target.value, "active"))}>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                    <option value="overdue">Morosa</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <div className={labelBase}>DIRECTORIO PÚBLICO</div>
                  <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Publicar esta empresa en el directorio público.
                  </label>
                  <div className={helpBase}>
                    Si está activo, la empresa aparecerá en la vista pública (tarjetas).
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  disabled={saving}
                  onClick={handleSaveCompany}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? "Guardando..." : modalMode === "create" ? "Crear" : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal (Billing record) */}
      {billingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="font-semibold text-gray-900">
                {billingType === "invoice" ? "Registrar factura" : "Registrar pago"}
              </div>
              <button
                onClick={() => setBillingModalOpen(false)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className={labelBase}>Monto</div>
                  <input className={inputBase} value={billingAmount} onChange={(e) => setBillingAmount(e.target.value)} placeholder="ej: 250000" />
                </div>
                <div>
                  <div className={labelBase}>Moneda</div>
                  <select className={inputBase} value={billingCurrency} onChange={(e) => setBillingCurrency(e.target.value as any)}>
                    <option value="CLP">CLP</option>
                    <option value="USD">USD</option>
                  </select>
                </div>

                {billingType === "invoice" ? (
                  <>
                    <div>
                      <div className={labelBase}>Fecha emisión</div>
                      <input className={inputBase} value={billingIssuedAt} onChange={(e) => setBillingIssuedAt(e.target.value)} placeholder="YYYY-MM-DD" />
                    </div>
                    <div>
                      <div className={labelBase}>Fecha vencimiento</div>
                      <input className={inputBase} value={billingDueAt} onChange={(e) => setBillingDueAt(e.target.value)} placeholder="YYYY-MM-DD" />
                    </div>
                  </>
                ) : (
                  <div className="md:col-span-2">
                    <div className={labelBase}>Fecha pago</div>
                    <input className={inputBase} value={billingPaidAt} onChange={(e) => setBillingPaidAt(e.target.value)} placeholder="YYYY-MM-DD" />
                  </div>
                )}

                <div>
                  <div className={labelBase}>Referencia</div>
                  <input className={inputBase} value={billingReference} onChange={(e) => setBillingReference(e.target.value)} placeholder="opcional" />
                </div>
                <div>
                  <div className={labelBase}>Nota</div>
                  <input className={inputBase} value={billingNote} onChange={(e) => setBillingNote(e.target.value)} placeholder="opcional" />
                </div>
              </div>

              {billingError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {billingError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => setBillingModalOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  disabled={billingSaving}
                  onClick={handleAddBillingRecord}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {billingSaving ? "Guardando..." : "Guardar"}
                </button>
              </div>

              <div className="text-xs text-gray-500">
                Consejo: registra facturas con fecha de vencimiento; si queda vencida, la empresa se marca como morosa automáticamente.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal (Comms outbox) */}
      {commsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="font-semibold text-gray-900">Enviar comunicación</div>
              <button
                onClick={() => setCommsModalOpen(false)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className={labelBase}>Plantilla</div>
                  <select
                    className={inputBase}
                    value={commsTemplate}
                    onChange={(e) => {
                      const k = e.target.value as any;
                      setCommsTemplate(k);
                      if (selectedCompanyDoc) {
                        const d = templateDefaults(k, selectedCompanyDoc);
                        setCommsSubject(d.subject);
                        setCommsText(d.text);
                      }
                    }}
                  >
                    <option value="overdue">Morosidad</option>
                    <option value="suspension">Aviso suspensión</option>
                    <option value="low_activity">Baja actividad</option>
                    <option value="holiday">Felices fiestas</option>
                    <option value="custom">Personalizado</option>
                  </select>
                </div>
                <div>
                  <div className={labelBase}>Destinatario</div>
                  <input
                    className={inputBase}
                    value={(selectedCompanyDoc?.billingEmail || selectedCompanyDoc?.contactEmail || selectedCompanyDoc?.adminEmail || "") as any}
                    readOnly
                  />
                </div>
                <div>
                  <div className={labelBase}>Remitente</div>
                  <select className={inputBase} value={commsFromMode} onChange={(e) => setCommsFromMode(e.target.value as any)}>
                    <option value="brand">administracion@agroconnecto.cl</option>
                    <option value="me">{me?.email || "tu usuario"}</option>
                  </select>
                  <div className="mt-1 text-xs text-gray-500">
                    Se encola en <code>comms_outbox</code>. El proveedor de correo debe autorizar el <b>From</b>.
                  </div>
                </div>

              </div>

              <div>
                <div className={labelBase}>Asunto</div>
                <input className={inputBase} value={commsSubject} onChange={(e) => setCommsSubject(e.target.value)} />
              </div>
              <div>
                <div className={labelBase}>Mensaje</div>
                <textarea className={inputBase} rows={8} value={commsText} onChange={(e) => setCommsText(e.target.value)} />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => setCommsModalOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  disabled={commsSending}
                  onClick={handleSendComms}
                  className="rounded-xl bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {commsSending ? "Encolando..." : "Enviar"}
                </button>
              </div>

              <div className="text-xs text-gray-500">
                Esto crea un registro en <code className="bg-gray-100 px-1 rounded">comms_outbox</code>. Luego lo conectamos a un servicio de email (SendGrid / Trigger Email).
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatMoney(amount: number, currency: "CLP" | "USD") {
  try {
    const fmt = new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "CLP",
      maximumFractionDigits: currency === "USD" ? 2 : 0,
    });
    return fmt.format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/**
 * TopCompaniesList: versión MVP sin dependencias extra.
 * Nota: para ranking real, usamos stats_companies si está poblado.
 * Si aún no, muestra últimas empresas creadas como proxy.
 */
function TopCompaniesList({ companies }: { companies: CompanyRow[] }) {
  const top = useMemo(() => companies.slice(0, 10), [companies]);
  return (
    <div className="mt-3 space-y-2">
      {top.map((c) => (
        <div key={c.id} className="rounded-xl border border-gray-200 p-3 bg-white">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 truncate">{c.name}</div>
              <div className="text-xs text-gray-600 truncate">
                {(c.region || "—") + (c.industry ? " · " + c.industry : "")}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={c.status || "active"} />
            </div>
          </div>
        </div>
      ))}
      {top.length === 0 && <div className="text-sm text-gray-600">Sin empresas.</div>}
    </div>
  );
}
